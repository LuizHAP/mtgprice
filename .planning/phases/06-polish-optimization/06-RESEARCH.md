# Phase 6: Polish & Optimization - Research

**Researched:** 2026-05-09
**Domain:** Performance, reliability, observability — TypeScript/Node.js scraping system
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Health Monitoring:**
- D-01: Alertas de saúde entregues exclusivamente via Telegram bot. Nenhum endpoint `/health` HTTP obrigatório — o canal já existente do bot é o único destino de alertas ativos.
- D-02: Trigger de alerta = quando o circuit breaker de qualquer fonte abre (100% offline para aquela fonte após atingir o error threshold). Não falhas transitórias que o retry já cobre.
- D-03: Formato dos alertas segue o padrão texto puro com emoji já estabelecido nas fases anteriores (Phase 3/4). Exemplo: `⚠️ Circuit breaker aberto: TCGPlayer está offline (60s reset). Últimas tentativas falharam.`
- D-04: Alerta enviado ao `chatId` da whitelist existente (single-user mode). Usa `bot.api.sendMessage` do `src/lib/telegram.ts`.

**Retry Logic:**
- D-05: Falhas individuais de coleta retentadas até 3 vezes com exponential backoff antes de serem contadas como falha definitiva. Delays sugeridos: 1s, 2s, 4s.
- D-06: Retry acontece ANTES de o circuit breaker registrar a falha. Sequência: `fetch → falha → retry 1 → falha → retry 2 → falha → retry 3 → ainda falha → circuit breaker conta como 1 failure`.
- D-07: Circuit breaker existente (`src/scraper/circuit-breaker.ts`) e seus parâmetros (50% error threshold, 60s reset) são mantidos.

**Concorrência:**
- D-08: Orquestrador de coleta deve usar controle de concorrência por fonte (ex: `p-limit` com ~5 requests simultâneos por fonte). Atualmente é sequencial.
- D-09: Concorrência é por fonte (não global), pois cada fonte tem seu próprio rate limit e circuit breaker.

### Claude's Discretion
- Valor exato do concurrency limit por fonte (sugestão: 5 para TCGPlayer/CardMarket/CardKingdom, pode ser maior para Liga Magic se scraping permite).
- Se adicionar endpoint `/api/health` como bonus de observabilidade passiva (se for simples, pode incluir).
- Otimizações de dashboard (Redis caching de queries frequentes, índices adicionais no TimescaleDB) — Claude tem discrição se o benchmark mostrar necessidade.
- Implementação da biblioteca de retry (p-retry, axios-retry, ou implementação manual com setTimeout).
- Resumo de saúde diário via Telegram (não foi solicitado, mas Claude pode adicionar se simples).
- Per-format enable/disable via env var (simples, pode incluir como bonus).

### Deferred Ideas (OUT OF SCOPE)
- Price charts / visualizations (v2 — ANALY-01, ANALY-02)
- Per-format enable/disable toggle (se complexo, fica para v2)
- Dashboard Redis caching (não selecionado; Claude tem discrição)
- Endpoint /health HTTP (não priorizado; Claude pode adicionar como bônus se simples)
- Multi-user support (OOS v1)
- Retry-After header handling (bônus opcional)
- Resumo de saúde diário (bônus opcional)
</user_constraints>

---

## Summary

Phase 6 is a reliability and performance hardening phase for a system that is already functionally complete. Three distinct improvements are needed: (1) a retry layer wrapping each price fetch before the circuit breaker sees the failure — achieving the >95% success rate target; (2) concurrency control with `p-limit` to process 1000+ cards without exceeding per-source rate limits; and (3) Telegram health alerts triggered by circuit breaker `open` events.

All three improvements are additive — they wrap or extend existing code without replacing it. The circuit breaker in `src/scraper/circuit-breaker.ts` already emits `open` events; the orchestrator in `src/scraper/orchestrator.ts` already has the sequential loop; and `bot.api.sendMessage` in `src/lib/telegram.ts` is already wired and tested. The core risk is the ESM-only nature of `p-limit` v7 and `p-retry` v8 — but the project already successfully imports `cheerio` (also ESM-only) using `import * as`, which establishes the pattern works under Next.js bundler + tsx.

**Primary recommendation:** Implement `withRetry` as a custom function (avoids ESM friction), use `p-limit` v7 with `import()` pattern if needed (or fall back to p-limit v6.x which is CJS-compatible), and hook health alerts directly on `breaker.on('open', ...)` in `wrapWithCircuitBreaker`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| opossum | 9.0.0 (already installed) | Circuit breaker — already in use | Existing; no change |
| p-limit | 7.3.0 (latest) | Concurrency limiter — cap simultaneous requests per source | Industry standard; 47M weekly downloads; sinuhe's goldilocks API: `const limit = pLimit(5); limit(fn)` |
| node-cron | 3.0.3 (already installed) | Cron scheduling — already in use | Existing; no change |
| grammY (grammy) | 1.36.2 (already installed) | Telegram bot — `bot.api.sendMessage` for health alerts | Existing; no change |
| Winston | 3.17.0 (already installed) | Logging — already in use | Existing; no change |

**Version verification:** [VERIFIED: npm registry 2026-05-09]
- `p-limit` latest: 7.3.0, published 2026-02-03
- `p-retry` latest: 8.0.0, published 2026-03-26
- `opossum` installed: 9.0.0 (latest confirmed)

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-retry | 8.0.0 (optional) | Exponential backoff retry — configurable attempts + delays | Use if `withRetry` custom implementation needs battle-tested edge cases (AbortError passthrough, etc.) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| p-limit (ESM v7) | p-limit v6.2.0 (CJS compatible) | v6 is CJS-compatible and avoids any ESM module resolution edge cases in older test contexts; v7 works with bundler resolution |
| p-limit | bottleneck | Bottleneck is heavier (Redis-backed, queuing), overkill for per-source 5-concurrency |
| p-retry | custom `withRetry` | Custom function is 20 lines, no new dependency, no ESM risk, full control over 429 handling |
| Custom `withRetry` | p-retry | p-retry handles AbortError passthrough, type-safe, tested — worth it if ESM is not a concern |

**Installation (only new package):**
```bash
pnpm add p-limit
```

**Note on ESM:** `p-limit` v7 is ESM-only (`"type": "module"` in its package.json). The project already uses `import * as cheerio from 'cheerio'` (also ESM-only) successfully in `src/scraper/providers/*.ts`, tsx scripts, and Vitest. The TypeScript config uses `"module": "esnext"` and `"moduleResolution": "bundler"` — this is fully compatible. [VERIFIED: codebase grep 2026-05-09]

**If ESM becomes an issue in Vitest tests:** Fall back to `pnpm add p-limit@6.2.0` (last CJS version, verified available on npm registry 2026-05-09). [VERIFIED: npm registry]

---

## Architecture Patterns

### Pattern 1: Retry Layer — `withRetry` wrapping raw fetchers

**What:** A pure higher-order function that retries a failing async call up to N times with exponential backoff. It wraps the raw fetcher BEFORE the circuit breaker wrapper — so the circuit breaker only counts exhausted retries as a single failure (per D-06).

**Placement:** `src/lib/retry.ts` (new file) — reusable across scrapers and future features.

**Interface:**
```typescript
// Source: design derived from D-05/D-06 decisions in 06-CONTEXT.md
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = Number(process.env.SCRAPER_RETRY_ATTEMPTS) || 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1) // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError!
}
```

**Wrapping sequence (per D-06):**
```typescript
// Integration point in orchestrator.ts or providers
const fetchWithRetry = (oracleId: string) =>
  withRetry(() => rawFetchTCGPlayerPrice(oracleId), 3, 1000)

const fetchWithRetryAndBreaker = wrapWithCircuitBreaker(fetchWithRetry, 'tcgplayer')
```

**When to use:** Every external fetcher call inside `fetchCardPriceFromAllSources`. The retry wraps the inner `source.fetch(oracleId)` call.

---

### Pattern 2: Concurrency Control — `p-limit` per source in `fetchAllPrices`

**What:** Replace the sequential `for` loop in `fetchAllPrices` with a `p-limit`-controlled Promise queue. Each source gets its own limiter (per D-09) calibrated to its rate limit preset.

**Current state:** `fetchAllPrices` iterates 1 card at a time sequentially. For 1000 cards × 4 sources = 4000 calls. At ~1 req/sec effective rate, this is 4000 seconds (66 minutes). Unacceptable.

**Target:** 5 concurrent per source × 4 sources = up to 20 simultaneous requests. Respects LIGAMAGIC (30 req/min) and TCGPLAYER (40 req/min) rate limits at 5 concurrent. [VERIFIED: rate-limiter.ts presets]

**Pattern:**
```typescript
// Source: p-limit v7 docs + orchestrator.ts refactor
import pLimit from 'p-limit'

const CONCURRENCY_PER_SOURCE = Number(process.env.SCRAPER_CONCURRENCY_PER_SOURCE) || 5

export async function fetchAllPrices(oracleIds: string[]): Promise<FetchAllPricesStats> {
  const limit = pLimit(CONCURRENCY_PER_SOURCE)
  const tasks = oracleIds.map((oracleId) =>
    limit(() => fetchCardPriceFromAllSources(oracleId))
  )
  const results = await Promise.allSettled(tasks)
  // aggregate stats from results...
}
```

**Calibration reasoning:** [ASSUMED — verified against rate-limiter.ts presets]
- LIGAMAGIC: 30 req/min = 0.5 req/sec. 5 concurrent × 1 req/card = safely within limit.
- TCGPLAYER: 40 req/min. 5 concurrent × short requests = well within limit.
- LigaMagic (scraping) may need lower limit (2-3) due to scraping fragility — Claude has discretion.

**Important:** `fetchCardPriceFromAllSources` internally already uses `Promise.allSettled` for parallel source fetching (all 4 sources per card run in parallel). The `p-limit` layer controls card-level concurrency, not source-level. This is correct behavior.

---

### Pattern 3: Health Alerts — Circuit Breaker `open` event hook

**What:** Add a callback to the `breaker.on('open', ...)` event inside `wrapWithCircuitBreaker` that sends a Telegram message when the circuit opens.

**Integration point:** `src/scraper/circuit-breaker.ts` — the `open` event listener already logs via Winston. Add `bot.api.sendMessage` as a side-effect callback.

**Challenge:** `circuit-breaker.ts` cannot directly import `bot` from `src/lib/telegram.ts` without a circular dependency risk (telegram.ts → grammy → no scraper deps = safe). Confirm: `telegram.ts` only imports `grammy`. The `bot` object is safe to import in `circuit-breaker.ts`. [VERIFIED: telegram.ts source 2026-05-09 — only imports grammy `Bot` class]

**Pattern:**
```typescript
// In wrapWithCircuitBreaker, after existing open event logging
breaker.on('open', async () => {
  logger.warn(`Circuit breaker opened for ${sourceName}`, { source: sourceName, state: 'OPEN' })

  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) return // graceful no-op if not configured

  try {
    await bot.api.sendMessage(
      Number(chatId),
      `⚠️ Circuit breaker aberto: ${sourceName} está offline (60s reset). Últimas tentativas falharam.`
    )
  } catch (alertError) {
    // Never let alert failure crash the circuit breaker machinery
    logger.error(`Failed to send circuit breaker health alert for ${sourceName}: ${alertError}`)
  }
})
```

**Format (per D-03):** Plain text with emoji — no `parse_mode` parameter. Consistent with Phase 4 digest pattern.

**Delivery target (per D-04):** `TELEGRAM_CHAT_ID` env var already defined in `.env.example`. Same pattern used in `src/lib/opportunities/digest.ts`. [VERIFIED: digest.ts source 2026-05-09]

---

### Pattern 4: Env Vars for Tunables

Following existing project pattern (Phase 1/2/4 all use `.env` for thresholds), new tunable env vars:

```bash
# Phase 6 (to add to .env.example)
SCRAPER_CONCURRENCY_PER_SOURCE=5     # p-limit concurrency per source (D-09)
SCRAPER_RETRY_ATTEMPTS=3             # withRetry max attempts (D-05)
SCRAPER_RETRY_BASE_DELAY_MS=1000     # withRetry base delay in ms (D-05)
```

---

### Anti-Patterns to Avoid

- **Wrapping circuit breaker inside retry (wrong order):** Per D-06, retry MUST wrap raw fetch. Then circuit breaker wraps the retry-wrapped function. Wrong order: retry re-opens the circuit breaker on each attempt instead of shielding it.
- **Global concurrency limit (wrong scope):** A single global limiter across all sources would let TCGPlayer's 5 slots block LigaMagic. Per D-09, limits are per-source.
- **Fire-and-forget health alert:** The `bot.api.sendMessage` call inside `breaker.on('open')` MUST be in a try-catch. A Telegram API failure must NEVER propagate and crash the circuit breaker event pipeline.
- **Importing `bot` before bot initialization:** `circuit-breaker.ts` uses `bot` from `src/lib/telegram.ts`. The `bot` instance creation throws if `TELEGRAM_BOT_TOKEN` is not set. For tests and environments without the token, the try-catch in the alert handler + the `if (!chatId) return` guard handle this gracefully.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency limiting | Custom semaphore/queue | `p-limit` | p-limit handles edge cases: queue drain, error propagation, pending count tracking — 47M weekly downloads, well-tested |
| Exponential backoff | `withRetry` (if using a library) | `p-retry` | p-retry handles AbortError passthrough (so circuit breakers can abort), type-safe, configurable onFailedAttempt hook |
| Circuit breaker | Custom state machine | `opossum` (already used) | Already installed and working; no reason to reconsider |

**Key insight:** The retry helper is simple enough (20 lines) that a custom `withRetry` is acceptable. The value of `p-retry` is mainly the `AbortError` passthrough feature — useful if opossum aborts pending requests when circuit opens. For this project, since the circuit breaker wraps the retry-wrapped function, opossum never sees individual retry attempts, so AbortError passthrough is irrelevant. Custom `withRetry` is recommended.

---

## Common Pitfalls

### Pitfall 1: Wrong Retry-Circuit Breaker Ordering
**What goes wrong:** If retry wraps the circuit-breaker-wrapped function, each retry attempt is a separate circuit breaker invocation. After 3 retries × 50% error threshold, the circuit can open from a single card's flaky fetch.
**Why it happens:** Intuitive to "retry the already-safe wrapped version."
**How to avoid:** Always: raw fetch → `withRetry` → `wrapWithCircuitBreaker`. The circuit breaker should only see one failure per exhausted retry sequence.
**Warning signs:** Circuit breaker opens after only 2-3 card failures instead of sustained multi-card failures.

### Pitfall 2: p-limit ESM in Vitest Tests
**What goes wrong:** Vitest (which runs in Node.js without Next.js bundler) may fail to import ESM-only `p-limit` if the module resolution context is different.
**Why it happens:** The project uses `"module": "esnext"` + `"moduleResolution": "bundler"` for TSC (Next.js context), but Vitest uses its own Vite-based bundler.
**How to avoid:** Check test runs immediately after installing p-limit. If import fails, downgrade to `p-limit@6.2.0` (CJS-compatible). The project already imports `cheerio` (ESM-only) in production code without test issues — this pattern should hold.
**Warning signs:** `ERR_REQUIRE_ESM` in test output, or `Cannot use import statement in a module` errors.

### Pitfall 3: Health Alert Importing `bot` Before Token Is Set
**What goes wrong:** `src/lib/telegram.ts` throws at module load time if `TELEGRAM_BOT_TOKEN` is not set. In unit tests mocking circuit-breaker, importing the module may cause the test setup to throw.
**Why it happens:** `new Bot(token)` runs at module initialization, not on first use.
**How to avoid:** In `circuit-breaker.ts`, import `bot` lazily (inside the event handler function body) OR mock `src/lib/telegram` in the circuit-breaker test file (same pattern used in `scheduler/__tests__/jobs.test.ts` which mocks `@/scraper/metagame`).
**Warning signs:** Test suite fails with `Error: TELEGRAM_BOT_TOKEN environment variable is not set` when running circuit-breaker tests.

### Pitfall 4: N+1 Query Pattern in Wishlist API (Dashboard Performance)
**What goes wrong:** `GET /api/wishlist` calls `getLatestPricesForCard` per card — which itself runs 4 DB queries (one per source). For a 50-card wishlist, that's 200+ queries per page load.
**Why it happens:** Current implementation uses `Promise.all(wishlist.map(async (item) => getLatestPricesForCard(item.oracleId)))` — not a single batched query.
**How to avoid:** If dashboard load times exceed 2s target, add a `(card_id, source, timestamp DESC)` index to prices table and/or add a batch query. With TimescaleDB and the existing `prices_card_timestamp_idx`, this is likely fast enough for realistic wishlist sizes (50-200 cards). Monitor before adding complexity.
**Warning signs:** Dashboard response time > 2s for wishlists > 50 cards.

### Pitfall 5: Alert Fatigue from Circuit Breaker Flapping
**What goes wrong:** Circuit breaker opens → recovery probe succeeds → closes → flaps again → multiple alerts in quick succession.
**Why it happens:** The `open` event fires on every open transition, including after half-open probe fails.
**How to avoid:** The 60s reset timeout naturally limits flapping frequency. For this single-user system, this is acceptable. The CONTEXT.md decision explicitly chose not to deduplicate alerts (not mentioned as a concern). Note the message text clarifies "60s reset" so the user knows recovery is automatic.

---

## Code Examples

Verified patterns from existing codebase:

### Existing: How `breaker.on('open')` Is Used (to extend)
```typescript
// Source: src/scraper/circuit-breaker.ts (lines 69-74)
breaker.on('open', () => {
  logger.warn(`Circuit breaker opened for ${sourceName}`, {
    source: sourceName,
    state: 'OPEN',
  })
})
// ADD: Telegram health alert callback here
```

### Existing: How `bot.api.sendMessage` Is Used (pattern to follow)
```typescript
// Source: src/lib/opportunities/digest.ts (Phase 4 pattern)
// Uses TELEGRAM_CHAT_ID from env, Number(chatIdRaw), no parse_mode
await bot.api.sendMessage(Number(chatId), messageText)
```

### Existing: Sequential Loop to Refactor in `fetchAllPrices`
```typescript
// Source: src/scraper/orchestrator.ts (lines 220-243)
// Currently: for (let i = 0; i < oracleIds.length; i++) { await fetchCardPriceFromAllSources(...) }
// Refactor: p-limit wraps the inner function
```

### Existing: How Mocks Are Done in jobs.test.ts (pattern for new tests)
```typescript
// Source: src/scheduler/__tests__/jobs.test.ts
vi.mock('@/scraper/metagame', () => ({ executeMetagameRefresh: vi.fn() }))
vi.mock('@/lib/telegram', () => ({ bot: { api: { sendMessage: vi.fn() } } }))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parallel source fetch per card | Keep — already uses `Promise.allSettled` for 4 sources per card | Phase 2 | No change needed |
| Sequential card-level loop (current) | p-limit concurrent card queue (Phase 6) | Phase 6 | 5x-10x throughput for 1000+ cards |
| No retry before circuit breaker (current) | 3-attempt exponential backoff before circuit registers failure | Phase 6 | >95% success rate |
| No health alerts (current) | Telegram alert on circuit open | Phase 6 | Operational visibility |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 5 concurrent per source respects LigaMagic's rate limit (scraping, 30 req/min budget) | Standard Stack / Calibration | Could trigger 429 or IP block on LigaMagic; Claude should start with 3 for LigaMagic |
| A2 | ESM `p-limit` v7 imports cleanly in Vitest without special config (consistent with cheerio) | Standard Stack / ESM | Test suite failures; fallback: p-limit@6.2.0 |
| A3 | `circuit-breaker.ts` importing `src/lib/telegram.ts` does not create circular deps | Architecture Patterns | Import errors at runtime; mitigated by lazy import inside event handler |
| A4 | Wishlist dashboard with TimescaleDB index stays < 2s for typical wishlist sizes (20-100 cards) | Common Pitfalls | If load > 2s, need batch price query optimization in Phase 6 plan |

---

## Open Questions

1. **p-limit import in Vitest tests**
   - What we know: Project imports cheerio (ESM-only) successfully; TypeScript uses bundler resolution.
   - What's unclear: Whether Vitest's Vite bundler also handles ESM-only p-limit without explicit config.
   - Recommendation: Implement with p-limit v7, run tests immediately; if `ERR_REQUIRE_ESM` appears, downgrade to p-limit@6.2.0 (no API change).

2. **LigaMagic concurrency limit**
   - What we know: LIGAMAGIC rate limit preset is 30 req/min (conservative, scraping-based). Scraping is fragile.
   - What's unclear: Whether LigaMagic blocks on concurrent requests from same IP more aggressively than the rate limit suggests.
   - Recommendation: Start with concurrency=3 for LigaMagic specifically (instead of 5). Claude has discretion per D-09.

3. **Dashboard performance baseline**
   - What we know: `GET /api/wishlist` runs 4 queries × N cards + 1 history query per card. No cache currently.
   - What's unclear: Whether this exceeds 2s for realistic wishlist sizes without optimization.
   - Recommendation: Add a plan step to benchmark with 50-card wishlist before deciding on Redis caching (which Claude has discretion to add per CONTEXT.md).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v22.18.0 | — |
| pnpm | Package manager | ✓ | 10.33.2 | — |
| p-limit (to install) | Concurrency control | ✗ (not installed) | — | p-limit@6.2.0 (CJS) if ESM issues |
| opossum | Circuit breaker | ✓ | 9.0.0 (installed) | — |
| grammy | Telegram health alerts | ✓ | 1.36.2 (installed) | — |
| TELEGRAM_BOT_TOKEN | Health alert delivery | [env-dependent] | — | Alert skips silently if not set |
| TELEGRAM_CHAT_ID | Health alert delivery | [env-dependent] | — | Alert skips silently if not set |

**Missing dependencies with no fallback:** None that block execution.

**Missing dependencies with fallback:** `p-limit` — not installed, must be added via `pnpm add p-limit`. If ESM import fails in tests, fallback to `p-limit@6.2.0`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test:run` |
| Full suite command | `pnpm test:run` (no e2e separation currently) |

### Phase Requirements → Test Map

No formal requirement IDs for this phase — success criteria are the targets. Tests map to behaviors:

| Behavior | Test Type | Automated Command | File |
|----------|-----------|-------------------|------|
| `withRetry` retries N times before throwing | unit | `pnpm test:run -- src/lib/__tests__/retry.test.ts` | Wave 0 gap |
| `withRetry` uses exponential backoff delays | unit | same | Wave 0 gap |
| `withRetry` propagates error after max attempts | unit | `pnpm test:run -- src/lib/__tests__/retry.test.ts` | Wave 0 gap |
| `fetchAllPrices` respects concurrency limit (p-limit) | unit | `pnpm test:run -- src/scraper/__tests__/orchestrator.test.ts` | Existing (skipped stubs) |
| Circuit breaker `open` triggers Telegram alert | unit | `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts` | Existing (skipped stubs) |
| Health alert uses correct chatId and message format | unit | same | Existing (skipped stubs) |
| Health alert failure does not propagate | unit | same | Existing (skipped stubs) |

### Sampling Rate
- **Per task commit:** `pnpm test:run`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/retry.test.ts` — covers withRetry behavior (new file needed)
- [ ] Existing `src/scraper/__tests__/orchestrator.test.ts` stubs need implementation for concurrency tests
- [ ] Existing `src/scraper/__tests__/circuit-breaker.test.ts` stubs need implementation for health alert tests

*(Existing test infrastructure: 13 test files pass, 200 skipped stubs. No framework setup needed — Vitest is fully configured.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth flows |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | No access control changes |
| V5 Input Validation | no | No new user inputs; env vars are server-controlled |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Log injection via `sourceName` in alert message | Tampering | `sourceName` is a hardcoded string literal in provider definitions (not user input) — no risk |
| Telegram message flooding (circuit flap) | Denial of Service | 60s reset timeout limits flap frequency; acceptable for single-user system |
| Retry amplifying load on already-struggling source | Denial of Service | Max 3 retries × 1000 cards = bounded; exponential backoff ensures time spread |

**Security assessment:** This phase adds no user-facing inputs, authentication changes, or new external connections beyond the already-authorized Telegram bot token. Security posture unchanged. Retry logic and health alerts are server-internal operations.

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection (2026-05-09): `src/scraper/circuit-breaker.ts`, `src/scraper/orchestrator.ts`, `src/scheduler/jobs.ts`, `src/lib/telegram.ts`, `src/lib/ratelimit/rate-limiter.ts`, `src/lib/wishlist/queries.ts`, `src/lib/opportunities/digest.ts`, `src/db/schema/prices.ts`, `drizzle/0002_indexes.sql`, `vitest.config.ts`, `package.json`
- npm registry (2026-05-09): p-limit@7.3.0, p-retry@8.0.0, opossum@9.0.0

### Secondary (MEDIUM confidence)
- Project patterns: ESM cheerio import (`import * as cheerio from 'cheerio'`) confirmed working in TSC bundler context — extrapolated to p-limit v7

### Tertiary (LOW confidence — see Assumptions Log)
- A1-A4: Calibration values and dashboard performance estimates are ASSUMED based on rate-limiter.ts presets and typical TimescaleDB performance characteristics

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against npm registry; versions confirmed
- Architecture patterns: HIGH — derived directly from existing codebase code patterns
- Pitfalls: HIGH (ESM pitfall) / MEDIUM (calibration) — based on verified code + ASSUMED rate limits
- Test infrastructure: HIGH — Vitest config and existing test files directly inspected

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable domain — retry/concurrency patterns don't change rapidly)
