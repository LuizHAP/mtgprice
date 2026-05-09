# MTG Price Monitor Roadmap

**Created:** 2026-03-05
**Granularity:** Standard
**Phases:** 11 (v1.0: 1–6, v1.1: 7–11)
**Coverage:** 24/24 v1.0 requirements + 13/13 v1.1 requirements mapped

---

## Milestone v1.0 — Core System

### Phases

- [x] **Phase 1: Foundation & Infrastructure** - Database, authentication, and base infrastructure (completed 2026-03-05)
- [x] **Phase 2: Core Data Collection** - Multi-source price collection with currency conversion (completed 2026-03-06, verified ✓)
- [x] **Phase 3: User Interface & Wishlist** - Web dashboard and Telegram bot for wishlist management
- [x] **Phase 4: Opportunity Detection & Notifications** - Alert system with batching and smart thresholds
- [x] **Phase 5: Metagame Integration** - Automatic format-based monitoring
- [x] **Phase 6: Polish & Optimization** - Performance, UX improvements, and monitoring

### Progress

| Phase | Plans Complete | Status | Completed | Verified |
|-------|----------------|--------|-----------|----------|
| 1. Foundation & Infrastructure | 6/6 | Complete   | 2026-03-05 | ✓ |
| 2. Core Data Collection | 5/5 | Complete   | 2026-03-06 | ✓ |
| 3. User Interface & Wishlist | 5/5 | Complete   | — | — |
| 4. Opportunity Detection & Notifications | 5/5 | Complete   | — | — |
| 5. Metagame Integration | 5/5 | Complete   | — | — |
| 6. Polish & Optimization | 3/3 | Complete   | — | ✓ |

### Phase Details

#### Phase 1: Foundation & Infrastructure

**Goal:** Sistema possui base de dados otimizada para séries temporais, autenticação de usuários funcionando, e infraestrutura de rate limiting implementada

**Depends on:** Nothing (first phase)

**Requirements:** AUTH-01, AUTH-02, PRICE-06, PRICE-08

**Success Criteria** (what must be TRUE):
1. User pode criar conta e vincular ao Telegram para receber notificações
2. User permanece logado no dashboard web entre sessões
3. Sistema respeita rate limits de APIs externas (ex: Scryfall 10 req/sec)
4. Sistema armazena histórico de preços com schema otimizado para consultas temporais

**Plans:** 6/6 plans complete

**Wave 1 (Parallel):**
- [x] 01-01-PLAN.md — Initialize Next.js project with TypeScript, Biome, Vitest, and monorepo structure
- [x] 01-02-PLAN.md — Create database schema with Drizzle ORM, TimescaleDB hypertables, and indexes

**Wave 2 (Parallel):**
- [x] 01-03-PLAN.md — Implement Redis-backed token bucket rate limiting (TDD)
- [x] 01-04-PLAN.md — Implement JWT authentication system with bcrypt and Telegram linking (TDD)

**Wave 3 (Sequential):**
- [x] 01-05-PLAN.md — Implement Telegram bot with grammY, chat ID whitelist, and /start authentication

---

#### Phase 2: Core Data Collection

**Goal:** Sistema coleta preços de múltiplas fontes (BR + internacional) automaticamente 2-3x ao dia com conversão de moeda correta

**Depends on:** Phase 1 (database schema, rate limiting infrastructure)

**Requirements:** PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05, PRICE-07, PRICE-08, NOTIF-03

**Success Criteria** (what must be TRUE):
1. Sistema coleta preços da Liga Magic, TCGPlayer, CardMarket, e CardKingdom
2. Preços internacionais são convertidos para BRL com IOF de 6.38% (cartão de crédito)
3. Sistema realiza checagens de preços 2-3x ao dia de forma agendada
4. Histórico de preços é armazenado para cada carta e fonte

**Plans:** 5/5 plans complete

**Wave 0 (Parallel):**
- [x] 02-00-PLAN.md — Test infrastructure setup (Vitest config + test stubs)

**Wave 1 (Parallel):**
- [x] 02-01-PLAN.md — Scryfall card metadata & Liga Magic foundation

**Wave 2 (Sequential):**
- [x] 02-02-PLAN.md — International price sources with circuit breaker (TCGPlayer, CardMarket, CardKingdom)

**Wave 3 (Sequential):**
- [x] 02-03-PLAN.md — Currency conversion & smart refresh logic

**Wave 4 (Sequential):**
- [x] 02-04-PLAN.md — Orchestration, scheduling & price storage

**Verification:** ✓ PASSED (8/8 must-haves verified, 2026-03-06)

---

#### Phase 3: User Interface & Wishlist

**Goal:** User pode gerenciar wishlist e visualizar dados de preços através de dashboard web e bot do Telegram

**Depends on:** Phase 2 (price data available to display)

**Requirements:** WISH-01, WISH-02, WISH-03, WISH-04, WISH-05, DASH-01, DASH-02

**Success Criteria** (what must be TRUE):
1. User pode adicionar e remover cartas da wishlist via interface web
2. User pode adicionar e remover cartas da wishlist via comandos do Telegram bot
3. User pode buscar cartas por nome no sistema
4. User pode comparar preços da mesma carta entre múltiplas fontes (Liga Magic, TCGPlayer, CardMarket, CardKingdom)
5. User pode visualizar lista de cartas monitoradas via interface web

**Plans:** 5/5 plans complete

**Wave 0 (Parallel):**
- [x] 03-00-PLAN.md — Test infrastructure setup (Vitest config + test stubs for UI and bot commands)

**Wave 1 (Parallel):**
- [x] 03-01-PLAN.md — Wishlist API endpoints (GET list, POST add, DELETE remove) with authentication and price enrichment
- [x] 03-02-PLAN.md — Card search API and price comparison endpoints (autocomplete, card details, all sources)

**Wave 2 (Parallel):**
- [x] 03-03-PLAN.md — Web dashboard UI (wishlist page, search bar, card grid, price table, Shadcn/ui setup)
- [x] 03-04-PLAN.md — Telegram bot commands (/add, /remove, /list, /price) with conversational flows and rate limiting

**Gap Closure (Wave 3):**
- [x] 03-05-PLAN.md — Fix DELETE endpoint 500 error and add unique constraint for duplicate detection

**UI hint**: yes

---

#### Phase 4: Opportunity Detection & Notifications

**Goal:** Sistema detecta oportunidades de compra e envia alertas via Telegram sem causar alert fatigue

**Depends on:** Phase 2 (price history data), Phase 3 (user preferences exist)

**Requirements:** DETECT-01, DETECT-02, DETECT-03, DETECT-04, NOTIF-01, NOTIF-02

**Success Criteria** (what must be TRUE):
1. Sistema detecta quando preço caiu X% na última semana E está abaixo da média histórica
2. Sistema gera alertas quando preço cai X% (threshold-based)
3. Sistema envia alertas de oportunidade via Telegram bot
4. Alertas são agrupados em batches para evitar spam (múltiplas cartas em uma mensagem)
5. Alertas contêm: nome da carta, preço atual, preço médio, % queda, fonte(s)
6. Telegram bot responde a comandos: /price (consultar preço), /history (histórico de alertas), /config (configurações)

**Plans:** 5/5 plans complete

**Wave 1 (Parallel):**
- [x] 04-01-PLAN.md — Opportunities schema + migration + [BLOCKING] schema push + .env.example DETECT_* vars
- [x] 04-02-PLAN.md — Detection config loader (TDD) — validates DETECT_* env vars with safe defaults

**Wave 2 (Sequential):**
- [x] 04-03-PLAN.md — Detection algorithm (pure detector + DB queries + wishlist orchestrator with cooldown and outlier guard)

**Wave 3 (Parallel):**
- [x] 04-04-PLAN.md — Digest builder + Telegram sender + executePriceCollection hook (D-14/D-22/D-23/D-24)
- [x] 04-05-PLAN.md — /history and /config bot commands + register in bot.api.setMyCommands

---

#### Phase 5: Metagame Integration

**Goal:** Sistema automaticamente monitora top cartas de formatos populares sem intervenção manual do usuário

**Depends on:** Phase 2 (data collection working), Phase 3 (wishlist infrastructure exists)

**Requirements:** META-01, META-02, META-03

**Success Criteria** (what must be TRUE):
1. Sistema auto-adiciona top cartas mais jogadas de Standard ao monitoramento
2. Sistema auto-adiciona top cartas mais jogadas de Modern ao monitoramento
3. Sistema auto-adiciona top X cartas mais populares de Commander ao monitoramento

**Plans:** 5/5 plans complete

**Wave 1 (Foundation):**
- [x] 05-01-PLAN.md — Wishlists is_auto_added column + SCRYFALL_HEAVY rate limit preset + Wave 0 test stubs + [BLOCKING] schema push

**Wave 2 (Parallel — fetchers + resolver):**
- [x] 05-02-PLAN.md — EDHREC Commander fetcher + MTGTop8 Standard/Modern fetcher (cheerio) with TDD
- [x] 05-03-PLAN.md — Scryfall /cards/collection batch resolver with SCRYFALL_HEAVY rate limit + retry

**Wave 3 (Sequential — orchestrator):**
- [x] 05-04-PLAN.md — Metagame orchestrator: compose fetchers + resolver, upsert cards (D-06), insert wishlists with isAutoAdded=true (D-07), remove stale auto-added rows (D-05)

**Wave 4 (Sequential — scheduler integration):**
- [x] 05-05-PLAN.md — Weekly Sunday cron registration (scheduleMetagameRefresh) + .env.example CRON_METAGAME_REFRESH

---

#### Phase 6: Polish & Optimization

**Goal:** Sistema é performático, confiável, e preparado para escalonamento

**Depends on:** All previous phases (core functionality complete)

**Requirements:** (None - optimization phase)

**Success Criteria** (what must be TRUE):
1. Sistema suporta monitoramento de 1000+ cartas sem degradação de performance
2. Taxa de sucesso de coleta de preços > 95% (com retry logic)
3. Dashboard carrega em < 2 segundos para consultas comuns
4. Sistema possui monitoramento de saúde e alertas de falhas

**Plans:** 3/3 plans complete

**Wave 1 (Parallel):**
- [x] 06-01-PLAN.md — withRetry helper (TDD): exponential-backoff retry wrapper for D-05/D-06
- [x] 06-03-PLAN.md — Telegram health alert on circuit breaker open (D-01..D-04)

**Wave 2 (Sequential):**
- [x] 06-02-PLAN.md — Wire withRetry + p-limit concurrency into orchestrator (D-06/D-07/D-08/D-09)

---

---

## Milestone v1.1 — Test Coverage & Quality Hardening

**Goal:** Ativar os 200 testes skipped implementando as features que os stubs prometem cobrir, sem adicionar novas funcionalidades.

### Phases

- [ ] **Phase 7: Auth & Rate Limit Tests** - Activate bcrypt, JWT, and Redis rate limiter test suites
- [ ] **Phase 8: Circuit Breaker Tests** - Implement 18 test.skip stubs for circuit breaker behavior
- [ ] **Phase 9: API & DB Integration Tests** - Activate card search and wishlist server action tests with real DB helpers
- [ ] **Phase 10: Scheduler Tests** - Activate schedulePriceCollection and executePriceCollection test stubs
- [ ] **Phase 11: Orchestrator Functions & Tests** - Implement missing orchestrator functions and activate their tests

### Progress

| Phase | Plans Complete | Status | Completed | Verified |
|-------|----------------|--------|-----------|----------|
| 7. Auth & Rate Limit Tests | 0/? | Not started | - | - |
| 8. Circuit Breaker Tests | 0/? | Not started | - | - |
| 9. API & DB Integration Tests | 0/? | Not started | - | - |
| 10. Scheduler Tests | 0/? | Not started | - | - |
| 11. Orchestrator Functions & Tests | 0/? | Not started | - | - |

### Phase Details

#### Phase 7: Auth & Rate Limit Tests

**Goal:** All auth and rate limit test stubs are active and passing — existing bcrypt, JWT, and Redis rate limiter code is fully verified by tests

**Depends on:** Phase 6 (all v1.0 code complete and stable)

**Requirements:** TEST-01, TEST-02, TEST-03

**Success Criteria** (what must be TRUE):
1. `pnpm test:run` shows 0 skipped tests in `hash.test.ts` — bcrypt hash/compare/salt-uniqueness cases all pass
2. `pnpm test:run` shows 0 skipped tests in `jwt.test.ts` — sign, verify, invalid token, expired token, and iat/exp claims cases all pass
3. `pnpm test:run` shows 0 skipped tests in `ratelimit/redis.test.ts` — Lua script atomicity, connection error handling, memory pressure, and cluster HA cases all pass
4. No `biome-ignore` comment is missing where `delete process.env.*` is used in test teardown

**Plans:** TBD

---

#### Phase 8: Circuit Breaker Tests

**Goal:** All 18 circuit breaker test stubs are active and passing — state machine transitions, fallback behavior, event emission, and per-source isolation are verified

**Depends on:** Phase 7 (baseline test suite green)

**Requirements:** TEST-04, TEST-05, TEST-06, TEST-07

**Success Criteria** (what must be TRUE):
1. `pnpm test:run` shows 0 skipped tests for state transition cases — closed→open→half-open→closed lifecycle passes
2. `pnpm test:run` shows 0 skipped tests for fallback cases — fallback function executes, cached data is returned, fallback errors are handled
3. `pnpm test:run` shows 0 skipped tests for event emission cases — open, close, halfOpen, and fallback events fire at the right moments
4. `pnpm test:run` shows 0 skipped tests for per-source isolation cases — independent breaker instances, per-source timeouts, and per-source stats verified

**Plans:** TBD

---

#### Phase 9: API & DB Integration Tests

**Goal:** Card search endpoint and wishlist server action tests are active with real database helpers — integration-level coverage confirms DB queries and FK constraints behave correctly

**Depends on:** Phase 7 (baseline test suite green)

**Requirements:** TEST-08, TEST-09

**Success Criteria** (what must be TRUE):
1. `pnpm test:run` shows 0 skipped tests in `cards/search.test.ts` — name match, empty result, case-insensitive, limit-10, and minimum-2-chars cases all pass against a real test DB
2. `pnpm test:run` shows 0 skipped tests in `wishlist/actions.test.ts` — addCard, FK violation, removeCard, and searchCards variant cases all pass against a real test DB
3. `seedTestCard`, `seedTestWishlist`, and `truncateTable` test helpers exist and are used by both test files
4. Tests clean up after themselves — no data bleeds between test runs

**Plans:** TBD

---

#### Phase 10: Scheduler Tests

**Goal:** All scheduler test stubs are active and passing — cron registration, custom schedules, invalid expression handling, orchestration execution, error handling, and concurrency guard are verified

**Depends on:** Phase 7 (baseline test suite green)

**Requirements:** TEST-10, TEST-11

**Success Criteria** (what must be TRUE):
1. `pnpm test:run` shows 0 skipped tests for `schedulePriceCollection` — cron registration, custom schedule override, and invalid expression rejection all pass
2. `pnpm test:run` shows 0 skipped tests for `executePriceCollection` — successful orchestration run, error handling (no unhandled rejection), duration metrics, and concurrency guard all pass
3. No real network calls or DB writes occur during scheduler tests — all side effects are mocked

**Plans:** TBD

---

#### Phase 11: Orchestrator Functions & Tests

**Goal:** Missing orchestrator functions are implemented in `src/scraper/orchestrator.ts` and their tests are active and passing — fetch orchestration, failure handling, rate limiting application, result aggregation, and batch processing are verified end-to-end

**Depends on:** Phase 8 (circuit breaker tests green), Phase 9 (DB integration tests green), Phase 10 (scheduler tests green)

**Requirements:** TEST-12, TEST-13

**Success Criteria** (what must be TRUE):
1. `orchestrateFetch`, `handleSourceFailure`, and `applyRateLimiting` exist in `src/scraper/orchestrator.ts` and are exported
2. `aggregateResults` and `batchOrchestrateFetch` exist in `src/scraper/orchestrator.ts` and are exported
3. `pnpm test:run` shows 0 skipped tests for orchestrator function tests — all TEST-12 stubs (orchestrateFetch, handleSourceFailure, applyRateLimiting) pass
4. `pnpm test:run` shows 0 skipped tests for batch orchestrator tests — all TEST-13 stubs (aggregateResults, batchOrchestrateFetch) pass
5. New functions integrate without breaking existing `fetchCardPriceFromAllSources` and `fetchAllPrices` contracts

**Plans:** TBD

---

## Traceability

### v1.0 Requirements

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| AUTH-01 | 1 | 01-04, 01-05 | Complete (2026-03-05) |
| AUTH-02 | 1 | 01-04 | Complete (2026-03-05) |
| PRICE-01 | 2 | 02-01 | Complete (2026-03-06) |
| PRICE-02 | 2 | 02-02 | Complete (2026-03-06) |
| PRICE-03 | 2 | 02-02 | Complete (2026-03-06) |
| PRICE-04 | 2 | 02-02 | Complete (2026-03-06) |
| PRICE-05 | 2 | 02-03 | Complete (2026-03-06) |
| PRICE-06 | 1 | 01-03 | Complete (2026-03-05) |
| PRICE-07 | 2 | 02-04 | Complete (2026-03-06) |
| PRICE-08 | 1, 2 | 01-02, 02-04 | Complete (2026-03-06) |
| WISH-01 | 3 | 03-01, 03-03, 03-04, 03-05 | Complete |
| WISH-02 | 3 | 03-01, 03-03, 03-04, 03-05 | Complete |
| WISH-03 | 3 | 03-02, 03-03 | Complete |
| WISH-04 | 3 | 03-04 | Complete |
| WISH-05 | 3 | 03-03 | Complete |
| DETECT-01 | 4 | 04-03 | Complete |
| DETECT-02 | 4 | 04-03 | Complete |
| DETECT-03 | 4 | 04-03, 04-04 | Complete |
| DETECT-04 | 4 | 04-03, 04-04 | Complete |
| NOTIF-01 | 4 | 04-04 | Complete |
| NOTIF-02 | 4 | 04-05 | Complete |
| NOTIF-03 | 2 | 02-04 | Complete (2026-03-06) |
| META-01 | 5 | 05-02, 05-04, 05-05 | Complete |
| META-02 | 5 | 05-02, 05-04, 05-05 | Complete |
| META-03 | 5 | 05-02, 05-04, 05-05 | Complete |
| DASH-01 | 3 | 03-02, 03-03 | Complete |
| DASH-02 | 3 | 03-03 | Complete |

### v1.1 Requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | 7 | Pending |
| TEST-02 | 7 | Pending |
| TEST-03 | 7 | Pending |
| TEST-04 | 8 | Pending |
| TEST-05 | 8 | Pending |
| TEST-06 | 8 | Pending |
| TEST-07 | 8 | Pending |
| TEST-08 | 9 | Pending |
| TEST-09 | 9 | Pending |
| TEST-10 | 10 | Pending |
| TEST-11 | 10 | Pending |
| TEST-12 | 11 | Pending |
| TEST-13 | 11 | Pending |

**Coverage v1.0:** 24/24 requirements mapped, all complete
**Coverage v1.1:** 13/13 requirements mapped, 0/13 complete

---

## Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (Data Collection)
    ↓
    ├─→ Phase 3 (User Interface)
    └─→ Phase 4 (Notifications)
        ↓
    Phase 5 (Metagame)
        ↓
    Phase 6 (Polish)
        ↓
    Phase 7 (Auth & Rate Limit Tests)        ← v1.1 starts here
        ↓
    Phase 8 (Circuit Breaker Tests)
    Phase 9 (API & DB Integration Tests)     ← parallel with Phase 8
    Phase 10 (Scheduler Tests)               ← parallel with Phase 8 & 9
        ↓
    Phase 11 (Orchestrator Functions & Tests)
```

**Key v1.1 dependencies:**
- Phases 8, 9, 10 all depend on Phase 7 (baseline test suite green before adding more tests)
- Phase 11 depends on Phases 8, 9, 10 (orchestrator wires together circuit breakers, DB, and scheduler concerns)

---

*Roadmap created: 2026-03-05*
*Last updated: 2026-05-09 (v1.1 phases 7–11 appended)*
