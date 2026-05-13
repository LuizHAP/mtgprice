# Phase 11: Orchestrator Functions & Tests - Research

**Researched:** 2026-05-13
**Domain:** TypeScript function implementation + Vitest test activation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Activate all 24 stubs — the 21 function stubs (TEST-12 + TEST-13) AND the 3 `Integration scenarios` stubs at the bottom of the test file.
  > NOTE: The actual file has 20 `test.skip` stubs (verified by grep count). CONTEXT.md says 24 because it includes the 3 already-passing integration stubs. The planner should treat the authoritative source as the test file itself. `[VERIFIED: grep -c 'test.skip' src/scraper/__tests__/orchestrator.test.ts]`
- **D-02:** Phase split into 2 plans: Plan 11-01 handles TEST-12 (orchestrateFetch, handleSourceFailure, applyRateLimiting), Plan 11-02 handles TEST-13 + Integration scenarios (aggregateResults, batchOrchestrateFetch, integration stubs).
- **D-03:** `orchestrateFetch` is an alias export: `export const orchestrateFetch = fetchCardPriceFromAllSources`. No logic duplication.
- **D-04:** `handleSourceFailure(source: string, oracleId: string, error: unknown): SourceFetchResult` — calls `logger.error`, returns `{ success: false, error: errorMsg }`. No in-function failure-count state.
- **D-05:** `applyRateLimiting(source: string): Promise<void>` — delegates to the rate limiter. (See critical finding in Architecture Patterns about the actual API signature.)
- **D-06:** `aggregateResults(oracleId: string, results: AllSourcesResult): PriceRecord[]` — pure function. Filters `success: false` entries, returns flat array of `{ oracleId, source, priceBrl }`. Returns `[]` when all sources fail.
- **D-07:** `PriceRecord` shape: `{ oracleId: string, source: string, priceBrl: number }`. Define in orchestrator.ts if not already present.
- **D-08:** `batchOrchestrateFetch` is an alias export: `export const batchOrchestrateFetch = fetchAllPrices`.
- **D-09:** Follow established test patterns: `vi.mock(...)` at top, `vi.clearAllMocks()` in `beforeEach`, dynamic imports inside `it()` only when module-level state must be reset.
- **D-10:** Mock targets per function group: `applyRateLimiting` → mock `@/lib/ratelimit/rate-limiter`; `handleSourceFailure` → mock `@/lib/logger`; `aggregateResults` → no mocks (pure); integration scenarios → same mocks as existing passing tests.

### Claude's Discretion

- Exact `PriceRecord` type name (could be `PriceEntry` or inline type) — whichever matches any existing price record type in the codebase.
- Whether `applyRateLimiting` awaits `checkRateLimitPreset` or just calls it — depends on the rate limiter's async API.
- Exact error message format in `handleSourceFailure` — consistent with existing `logger.error` calls in orchestrator.ts.
- Whether integration scenario stubs test via the `orchestrateFetch` alias or the underlying `fetchCardPriceFromAllSources` directly.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-12 | Implement `orchestrateFetch`, `handleSourceFailure`, `applyRateLimiting` + activate their test stubs | D-03, D-04, D-05 define each function; rate-limiter API verified; logger API verified |
| TEST-13 | Implement `aggregateResults`, `batchOrchestrateFetch` + activate their test stubs + Integration scenarios | D-06, D-07, D-08 define each function; AllSourcesResult/SourceFetchResult types already exist |

</phase_requirements>

---

## Summary

Phase 11 is a focused codebase extension: add 5 named exports to `src/scraper/orchestrator.ts` and activate 20 `test.skip` stubs in its test file. Two of the exports are trivial one-line alias re-exports (`orchestrateFetch = fetchCardPriceFromAllSources`, `batchOrchestrateFetch = fetchAllPrices`). Two more are simple new functions (`handleSourceFailure` logs + returns `SourceFetchResult`, `applyRateLimiting` wraps the rate limiter). One is a pure transformation function (`aggregateResults`).

The primary implementation risk is `applyRateLimiting`: CONTEXT.md describes calling `checkRateLimitPreset(source)` with one argument, but the actual `checkRateLimitPreset` signature requires two arguments — `(key: string, preset: RateLimitConfig, tokens?: number)`. The implementation must pass both the key string and the matching `RATE_LIMITS.*` preset constant. Both are exported from `src/lib/ratelimit/rate-limiter.ts`.

The test activation pattern is well-established by phases 8–10. The orchestrator test file already has 5 passing tests at the top that must not be touched. The 20 `test.skip` stubs to activate are organized into 5 describe blocks inside a parent `describe('Fetch orchestration')`.

**Primary recommendation:** Follow the CONTEXT.md decisions exactly. The only gap to resolve before implementation is the `applyRateLimiting` rate limiter API mismatch (two-arg call, not one-arg). Use `RATE_LIMITS.LIGAMAGIC` / `RATE_LIMITS.TCGPLAYER` / `RATE_LIMITS.CARDMARKET` / `RATE_LIMITS.CARDKINGDOM` constants already exported from rate-limiter.ts.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| orchestrateFetch | API/Scraper layer | — | Alias for existing fetch orchestration; already in scraper tier |
| handleSourceFailure | API/Scraper layer | — | Error normalization for scraper failures; no persistence, no UI |
| applyRateLimiting | API/Scraper layer | Redis (rate limiter) | Delegates to existing Redis token bucket; scraper layer enforces before requests |
| aggregateResults | API/Scraper layer | — | Pure data transformation within orchestration pipeline; no I/O |
| batchOrchestrateFetch | API/Scraper layer | — | Alias for existing batch orchestration; already in scraper tier |
| Test stubs activation | Test layer | — | Vitest test file only; no production tier change |

---

## Standard Stack

### Core (already in use — no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | `^3.1.4` | Test runner | Project standard — already configured and used in phases 7–10 `[VERIFIED: package.json]` |
| winston | `^3.17.0` | Logging (logger.ts) | Project standard — `logger.error/info/warn` already used in orchestrator.ts `[VERIFIED: src/lib/logger.ts]` |
| ioredis | `^5.6.1` | Rate limiter backing | Project standard — already powers `checkRateLimitPreset` in rate-limiter.ts `[VERIFIED: src/lib/ratelimit/rate-limiter.ts]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `RATE_LIMITS` constant | n/a | Preset config objects for each source | Required for 2nd arg to `checkRateLimitPreset` |
| `SourceFetchResult` type | n/a | Return type for `handleSourceFailure` | Already exported from orchestrator.ts |
| `AllSourcesResult` type | n/a | Input type for `aggregateResults` | Already exported from orchestrator.ts |
| `FetchAllPricesStats` type | n/a | Return type for `batchOrchestrateFetch` alias | Already exported from orchestrator.ts |

**Installation:** None required. All dependencies already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
Test file activates stubs
         │
         ▼
src/scraper/__tests__/orchestrator.test.ts
  [20 test.skip → test]
         │
         │ imports
         ▼
src/scraper/orchestrator.ts
  ┌─────────────────────────────────────┐
  │  EXISTING (untouched)               │
  │  fetchCardPriceFromAllSources()     │──── Liga Magic (sequential)
  │  fetchAllPrices()                   │──── International sources (parallel, p-limit)
  ├─────────────────────────────────────┤
  │  NEW (Phase 11 additions)           │
  │  orchestrateFetch = [alias above]   │
  │  batchOrchestrateFetch = [alias]    │
  │  handleSourceFailure()              │──── logger.error → returns SourceFetchResult
  │  applyRateLimiting()                │──── checkRateLimitPreset(key, RATE_LIMITS.X)
  │  aggregateResults()                 │──── pure: AllSourcesResult → PriceRecord[]
  └─────────────────────────────────────┘
         │
         ├── src/lib/ratelimit/rate-limiter.ts
         │     checkRateLimitPreset(key, preset)
         │     RATE_LIMITS.{LIGAMAGIC, TCGPLAYER, CARDMARKET, CARDKINGDOM}
         │
         └── src/lib/logger.ts
               logger.error(message)
```

### Recommended Project Structure

No new files or directories. All changes are within:
```
src/scraper/
├── orchestrator.ts          # ADD 5 exports + PriceRecord type
└── __tests__/
    └── orchestrator.test.ts # ACTIVATE 20 test.skip stubs
```

### Pattern 1: Alias Export

**What:** Re-export an existing function under a new name without duplicating logic.
**When to use:** When a new public API name must map to existing behavior (D-03, D-08).

```typescript
// Source: CONTEXT.md D-03, D-08 — confirmed with src/scraper/orchestrator.ts
export const orchestrateFetch = fetchCardPriceFromAllSources
export const batchOrchestrateFetch = fetchAllPrices
```

These are placed at the bottom of orchestrator.ts after the existing exports.

### Pattern 2: handleSourceFailure Implementation

**What:** Normalize source failures into `SourceFetchResult` and log with context.
**When to use:** Called when a price source fails during orchestration (D-04).

```typescript
// Source: CONTEXT.md D-04 + src/scraper/orchestrator.ts (existing logger.error pattern)
export function handleSourceFailure(
  source: string,
  oracleId: string,
  error: unknown,
): SourceFetchResult {
  const errorMsg = error instanceof Error ? error.message : String(error)
  logger.error(`✗ ${source}: ${oracleId} - ${errorMsg}`)
  return { success: false, error: errorMsg }
}
```

Error message format follows the existing `logger.error` calls in orchestrator.ts (lines 136, 175).

### Pattern 3: applyRateLimiting — CRITICAL API MISMATCH

**What:** Enforce rate limit for a source before making a fetch request.
**Critical finding:** CONTEXT.md D-05 says `checkRateLimitPreset(source)` with one argument. The actual exported function signature is `checkRateLimitPreset(key: string, preset: RateLimitConfig, tokens?: number)` — two required arguments. [VERIFIED: src/lib/ratelimit/rate-limiter.ts lines 179-185]

The function must map source names to their `RATE_LIMITS` preset constants:

```typescript
// Source: CONTEXT.md D-05 + verified against src/lib/ratelimit/rate-limiter.ts
import { RATE_LIMITS, checkRateLimitPreset } from '@/lib/ratelimit/rate-limiter'

const SOURCE_RATE_LIMIT_MAP: Record<string, typeof RATE_LIMITS[keyof typeof RATE_LIMITS]> = {
  ligamagic: RATE_LIMITS.LIGAMAGIC,
  tcgplayer: RATE_LIMITS.TCGPLAYER,
  cardmarket: RATE_LIMITS.CARDMARKET,
  cardkingdom: RATE_LIMITS.CARDKINGDOM,
}

export async function applyRateLimiting(source: string): Promise<void> {
  const preset = SOURCE_RATE_LIMIT_MAP[source.toLowerCase()]
  if (preset) {
    await checkRateLimitPreset(source, preset)
  }
}
```

The Claude's Discretion item "whether to await" is resolved: `checkRateLimitPreset` returns `Promise<RateLimitResult>`, so it must be awaited. [VERIFIED: src/lib/ratelimit/rate-limiter.ts line 183]

### Pattern 4: aggregateResults — Pure Function

**What:** Flatten `AllSourcesResult` map into array of price records for successful sources only.
**When to use:** D-06 — no DB writes, no async, no mocks needed in tests.

```typescript
// Source: CONTEXT.md D-06, D-07 + src/scraper/orchestrator.ts AllSourcesResult type
export interface PriceRecord {
  oracleId: string
  source: string
  priceBrl: number
}

export function aggregateResults(
  oracleId: string,
  results: AllSourcesResult,
): PriceRecord[] {
  return Object.entries(results)
    .filter(([, result]) => result.success && result.price !== undefined)
    .map(([source, result]) => ({
      oracleId,
      source,
      priceBrl: result.price as number,
    }))
}
```

No existing `PriceRecord` type found in the codebase [VERIFIED: grep -rn 'PriceRecord|PriceEntry' src/]. Safe to define inline in orchestrator.ts.

### Pattern 5: Test Activation

**What:** Change `test.skip(...)` to `test(...)` and replace the stub body with real assertions.
**When to use:** Every stub in the test file (D-01).

For orchestrateFetch tests — mock same modules as existing passing tests at top of file, then verify alias behavior via `orchestrateFetch` import:

```typescript
// Source: orchestrator.test.ts lines 29-67 (existing passing pattern)
describe('orchestrateFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should fetch Liga Magic first (BR data priority)', async () => {
    vi.resetModules()
    vi.doMock('@/scraper/smart-refresh', () => ({
      shouldFetchPrice: vi.fn().mockResolvedValue(true),
    }))
    vi.doMock('@/scraper/providers/liga-magic', () => ({
      fetchCardPrice: vi.fn().mockResolvedValue(10),
    }))
    vi.doMock('@/scraper/providers/tcgplayer', () => ({
      fetchCardPrice: vi.fn().mockResolvedValue(null),
    }))
    vi.doMock('@/scraper/providers/cardmarket', () => ({
      fetchCardPrice: vi.fn().mockResolvedValue(null),
    }))
    vi.doMock('@/scraper/providers/cardkingdom', () => ({
      fetchCardPrice: vi.fn().mockResolvedValue(null),
    }))
    vi.doMock('@/db/queries/prices', () => ({
      insertPrice: vi.fn().mockResolvedValue(undefined),
    }))
    vi.doMock('@/lib/currency', () => ({
      convertToBRL: vi.fn().mockResolvedValue(50),
    }))
    const { orchestrateFetch } = await import('@/scraper/orchestrator')
    const results = await orchestrateFetch('test-id')
    expect(results.ligamagic.success).toBe(true)
    vi.resetModules()
  })
})
```

For handleSourceFailure tests — mock logger at describe level, not inside each test:

```typescript
// Source: CONTEXT.md D-10 + jobs.test.ts top-level mock pattern
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
```

For applyRateLimiting tests — mock rate-limiter at describe level:

```typescript
vi.mock('@/lib/ratelimit/rate-limiter', () => ({
  checkRateLimitPreset: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  RATE_LIMITS: {
    LIGAMAGIC: { limit: 30, interval: 60 },
    TCGPLAYER: { limit: 40, interval: 60 },
    CARDMARKET: { limit: 40, interval: 60 },
    CARDKINGDOM: { limit: 40, interval: 60 },
  },
}))
```

### Anti-Patterns to Avoid

- **Replacing `test.skip` entirely:** Just change `test.skip` to `test` and replace `expect(true).toBe(false)` with real assertions. Do not delete the surrounding `describe` structure.
- **Calling `checkRateLimitPreset(source)` with one arg:** The function requires two args — `(key, preset)`. Single-arg call will TypeScript-error and always use `interval: undefined` at runtime.
- **Duplicating fetchCardPriceFromAllSources logic in orchestrateFetch:** The alias pattern `export const orchestrateFetch = fetchCardPriceFromAllSources` is the correct approach — no body needed.
- **Touching the 5 existing passing tests:** The `fetchAllPrices concurrency` and `retry-then-circuit-breaker ordering` describe blocks at lines 4–99 must not be modified.
- **Using `vi.mock` inside a `test()` block:** Top-level module mocks belong at the top of the file or in `beforeEach` with `vi.resetModules()`. Dynamic `vi.doMock` inside tests is only needed when fresh module state is required.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limit enforcement | Custom delay/sleep loops | `checkRateLimitPreset` + `RATE_LIMITS.*` | Redis token bucket already handles atomic counting, presets already defined for all 4 sources |
| Error logging format | Custom error formatting | `logger.error` with existing format `✗ ${source}: ${oracleId} - ${errorMsg}` | Consistent with existing orchestrator.ts error messages (lines 136, 175) |
| Result aggregation | Complex dedup logic | Simple `Object.entries().filter().map()` | AllSourcesResult has one entry per source by construction — no real dedup needed |
| Circuit breaker state | Manual failure counters in handleSourceFailure | Opossum via `wrapWithCircuitBreaker` (already in place) | D-04 explicitly says no counter; circuit breaker already handles threshold logic |

---

## Common Pitfalls

### Pitfall 1: checkRateLimitPreset One-Arg Call

**What goes wrong:** `applyRateLimiting` calls `checkRateLimitPreset(source)` without a preset — TypeScript error, `preset.limit` crashes at runtime.
**Why it happens:** CONTEXT.md D-05 describes the intent abstractly ("calls `checkRateLimitPreset(source)`") but the actual API needs two args.
**How to avoid:** Import `RATE_LIMITS` alongside `checkRateLimitPreset`. Build a source-name → preset map. Pass both.
**Warning signs:** TypeScript compiler error "Expected 2-3 arguments, but got 1."

### Pitfall 2: Stub Body Not Replaced

**What goes wrong:** Test is no longer skipped but still runs `expect(true).toBe(false)` — immediately fails.
**Why it happens:** Only `test.skip` is changed to `test` without updating the body.
**How to avoid:** Replace the entire comment block + `expect(true).toBe(false)` with real assertions when activating each stub.
**Warning signs:** `pnpm test:run` shows tests failing (not skipping) with "expected true to equal false."

### Pitfall 3: Module-Level Mock Bleeding

**What goes wrong:** A mock set up in one test affects subsequent tests within the same describe block.
**Why it happens:** `vi.doMock` + `vi.resetModules()` not paired correctly, or `vi.clearAllMocks()` not in `beforeEach`.
**How to avoid:** Always call `vi.resetModules()` at the end of any test that uses `vi.doMock`. Keep `vi.clearAllMocks()` in every `beforeEach`.
**Warning signs:** Tests pass in isolation but fail when run together.

### Pitfall 4: allSourcesResult.price Undefined on Success

**What goes wrong:** `aggregateResults` maps a successful entry but `result.price` is `undefined` — `priceBrl: undefined` in the output array.
**Why it happens:** The `SourceFetchResult.price` field is optional (`price?: number`). A result can be `{ success: true, price: undefined }` in theory.
**How to avoid:** Filter with `result.success && result.price !== undefined` before mapping.
**Warning signs:** Tests asserting `priceBrl` as a number get `undefined` values.

### Pitfall 5: Touching Passing Tests

**What goes wrong:** Accidentally modifying the existing `preserves FetchAllPricesStats return shape` test or the retry-ordering tests.
**Why it happens:** These tests use `vi.resetModules()` + `vi.doMock()` at the bottom of the describe block — the same pattern needed for new tests. It's easy to edit the wrong test.
**How to avoid:** Start editing from line 101 (`describe('Fetch orchestration')`). Leave lines 1–99 unchanged.
**Warning signs:** `pnpm test:run` shows the concurrency or retry tests failing after changes.

---

## Code Examples

### Existing error message pattern (lines 136, 175 of orchestrator.ts)

```typescript
// Source: [VERIFIED: src/scraper/orchestrator.ts:135-136]
const errorMsg = error instanceof Error ? error.message : String(error)
logger.error(`✗ ${ligaMagicKey}: ${oracleId} - ${errorMsg}`)
```

`handleSourceFailure` should follow this exact pattern so log output is consistent.

### Existing type definitions to reuse

```typescript
// Source: [VERIFIED: src/scraper/orchestrator.ts:75-83]
export interface SourceFetchResult {
  success: boolean
  price?: number
  error?: string
}

export type AllSourcesResult = {
  [K in 'ligamagic' | 'tcgplayer' | 'cardmarket' | 'cardkingdom']: SourceFetchResult
}
```

`aggregateResults` accepts `AllSourcesResult` as second parameter and `handleSourceFailure` returns `SourceFetchResult`.

### checkRateLimitPreset actual signature

```typescript
// Source: [VERIFIED: src/lib/ratelimit/rate-limiter.ts:179-185]
export async function checkRateLimitPreset(
  key: string,
  preset: RateLimitConfig,
  tokens = 1,
): Promise<RateLimitResult>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All orchestrator tests as stubs | Activate 20 stubs by implementing 5 new exports | Phase 11 | 0 skipped tests in orchestrator describe |
| No named `orchestrateFetch` export | Alias export `= fetchCardPriceFromAllSources` | Phase 11 | Same behavior, new public API name |
| No named `batchOrchestrateFetch` export | Alias export `= fetchAllPrices` | Phase 11 | Same behavior, new public API name |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `applyRateLimiting` test for "should handle rate limit errors (429)" will assert `checkRateLimitPreset` is called and returns `{ allowed: false }` — not actual HTTP 429 handling | Architecture Patterns / Pattern 3 | Test may need exponential backoff logic if stub comment is taken literally |

**Note on stub count discrepancy:** CONTEXT.md states "24 skipped stubs." The actual file has 20 `test.skip` stubs [VERIFIED: grep count]. CONTEXT.md appears to count 24 by adding the 4 tests in already-active describe blocks that were part of the original discussion. The planner should rely on the actual file count (20) and verify against the test file before writing tasks.

---

## Open Questions (RESOLVED)

1. **applyRateLimiting test for "should handle rate limit errors (429)"**
   - What we know: The test stub comment says "detect 429 status, implement exponential backoff." But D-05 says `applyRateLimiting` just calls `checkRateLimitPreset`.
   - What's unclear: Should this test verify exponential backoff, or just verify that when `checkRateLimitPreset` returns `{ allowed: false }`, the function handles it (e.g., throws or returns)?
   - Recommendation: The function signature is `Promise<void>` — have it throw when `allowed: false`, and the test asserts the throw. The name "rate limit errors (429)" is metaphorical — the actual test should just verify that a denied request is surfaced as an error, not that HTTP 429 status codes are parsed.

2. **Integration scenario stub "should complete large batch within time budget"**
   - What we know: The stub says "processes 1000 cards, completes within 30 minutes." At test time this is impractical.
   - What's unclear: Should this be mocked so it runs fast, or kept as a placeholder?
   - Recommendation: Mock all providers to return immediately (same as other integration tests). Assert that `batchOrchestrateFetch(['a', 'b', 'c'])` returns a `FetchAllPricesStats` shape — do not literally process 1000 cards or enforce a wall-clock time assertion.

---

## Environment Availability

Step 2.6: SKIPPED — this phase makes no new external dependencies. All changes are within existing TypeScript source files and their Vitest test file. No new packages, CLI tools, databases, or services are required.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-12 | `orchestrateFetch` alias resolves and fetches Liga Magic first | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ (stubs) |
| TEST-12 | `handleSourceFailure` logs error and returns SourceFetchResult | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ (stubs) |
| TEST-12 | `applyRateLimiting` calls rate limiter with correct source | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ (stubs) |
| TEST-13 | `aggregateResults` filters failures and returns PriceRecord[] | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ (stubs) |
| TEST-13 | `batchOrchestrateFetch` alias resolves and returns FetchAllPricesStats | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ (stubs) |
| TEST-13 | Integration: single card fetch from all sources | integration | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ (stubs) |

### Sampling Rate
- **Per task commit:** `pnpm test:run src/scraper/__tests__/orchestrator.test.ts`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. Test file already exists with all 20 stubs in place. Vitest configured. No new fixtures or config needed.

---

## Security Domain

This phase introduces no authentication, session management, access control, cryptographic operations, or HTTP endpoints. All additions are internal pure functions and alias exports within the scraper layer.

ASVS V5 (Input Validation): `handleSourceFailure` accepts `error: unknown` and safely normalizes via `error instanceof Error ? error.message : String(error)` — this pattern already used in orchestrator.ts.

No further security analysis required for this phase.

---

## Sources

### Primary (HIGH confidence)
- `src/scraper/orchestrator.ts` — verified existing exports, types (`SourceFetchResult`, `AllSourcesResult`, `FetchAllPricesStats`), logger.error message format, alias pattern feasibility
- `src/scraper/__tests__/orchestrator.test.ts` — verified actual stub count (20), describe block structure, existing passing test patterns
- `src/lib/ratelimit/rate-limiter.ts` — verified `checkRateLimitPreset` two-arg signature, `RATE_LIMITS` constants for all 4 sources
- `src/lib/logger.ts` — verified `logger.error` API (winston, no special args needed)
- `src/scheduler/__tests__/jobs.test.ts` — verified established test activation patterns (vi.mock at top, vi.clearAllMocks in beforeEach, dynamic import in tests)
- `.planning/phases/11-orchestrator-functions-tests/11-CONTEXT.md` — locked decisions D-01 through D-10

### Secondary (MEDIUM confidence)
- `.planning/phases/10-scheduler-tests/10-CONTEXT.md` — corroborates test activation pattern, confirms `vi.resetModules()` + `vi.doMock()` approach

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, verified in package.json and source files
- Architecture: HIGH — implementation files read directly; exact function signatures verified
- Pitfalls: HIGH — checkRateLimitPreset signature mismatch verified directly from source; other pitfalls derived from established patterns in phases 8–10

**Research date:** 2026-05-13
**Valid until:** Stable — this is internal codebase; no external dependency changes expected
