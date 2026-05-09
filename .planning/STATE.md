---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: test-coverage-quality-hardening
current_phase: 7
current_plan: —
status: roadmap ready
last_updated: "2026-05-09T00:00:00Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# MTG Price Monitor - Project State

**Last updated:** 2026-05-09
**Current phase:** Phase 7 — Auth & Rate Limit Tests
**Current plan:** —
**Status:** Roadmap ready — awaiting first plan

## Project Reference

**Core Value:** Jogadores de MTG compram cartas no momento ideal baseado em análise de tendências de preço e comparação entre múltiplas fontes (BR + internacional).

**What we're building:**
Milestone v1.1 — Test Coverage & Quality Hardening: ativar os 200 testes skipped implementando as features que os stubs prometem cobrir. Fases 7–11 cobrem auth/rate-limit tests, circuit breaker tests, API/DB integration tests, scheduler tests, e implementação das funções de orquestração ausentes.

## Current Position

**Milestone:** v1.1 — Test Coverage & Quality Hardening
**Phase:** 7 — Auth & Rate Limit Tests
**Status:** Not started
**Last activity:** 2026-05-09 — Roadmap created (phases 7–11)

## Progress Bar

```
v1.1:  [ ] Phase 7  [ ] Phase 8  [ ] Phase 9  [ ] Phase 10  [ ] Phase 11
       0/5 phases complete
```

## Accumulated Context

### Key Decisions Made (v1.0)

1. **Telegram bot vs Discord bot:** Telegram selected — user preference, simpler para notificações
2. **Checagem 2-3x ao dia vs tempo real:** 2-3x daily selected — balances opportunity detection with API limits
3. **Lógica de oportunidade:** queda + abaixo da média — combines recent trend with historical context
4. **Interface web + bot:** Dual interface selected — flexibility for different use cases
5. **Package manager:** pnpm — faster, disk-efficient, native monorepo support
6. **Code quality:** Biome — single tool for linting + formatting (noDelete rule affects process.env teardown patterns)
7. **Database:** PostgreSQL 16 + TimescaleDB — 65% lower storage, 7-day chunk hypertables
8. **Telegram:** grammY 1.36+ — fully async, chat ID whitelist middleware

### Known Constraints (v1.1 specific)

1. **Biome noDelete rule:** `delete process.env.X` requires `// biome-ignore lint/performance/noDelete` comment in test teardown — assigning `undefined` coerces to string, pollutes env
2. **Vitest 3.x fake timers:** `vi.useFakeTimers()` + async mock functions causes unhandled rejection warnings — use `vi.spyOn(globalThis, 'setTimeout')` instead
3. **Test stubs only — no new files:** All test files already exist with `test.skip` stubs; work is replacing stubs with real implementations
4. **TEST-08/09 require real DB:** `seedTestCard`, `seedTestWishlist`, `truncateTable` helpers must be created; tests run against an actual test database, not mocks
5. **TEST-12/13 require new source code:** `orchestrateFetch`, `handleSourceFailure`, `applyRateLimiting`, `aggregateResults`, `batchOrchestrateFetch` must be implemented in `src/scraper/orchestrator.ts` without breaking existing `fetchCardPriceFromAllSources` and `fetchAllPrices`
6. **Cotação de câmbio:** IOF 6.38% (cartão de crédito) nas conversões dólar/euro → real
7. **Rate limiting:** Scryfall 10 req/sec, Telegram 100 req/60sec

### Milestone v1.0 Summary

All 6 phases complete (30/30 plans):
- Phase 1: Foundation & Infrastructure (auth, DB, rate limiting, Telegram bot)
- Phase 2: Core Data Collection (4 price sources, circuit breakers, currency conversion)
- Phase 3: User Interface & Wishlist (dashboard, search API, bot commands)
- Phase 4: Opportunity Detection & Notifications (detection algorithm, digest, /history, /config)
- Phase 5: Metagame Integration (EDHREC, MTGTop8, Scryfall resolver, weekly cron)
- Phase 6: Polish & Optimization (withRetry, p-limit concurrency, Telegram health alerts)

**Test suite state at v1.0 end:** 127 passing | 200 skipped | 54 todo

### v1.1 Phase Map

| Phase | Scope | Requirements | Key constraint |
|-------|-------|--------------|----------------|
| 7 | Auth & Rate Limit Tests | TEST-01, TEST-02, TEST-03 | biome-ignore on delete process.env.* |
| 8 | Circuit Breaker Tests | TEST-04–07 | 18 test.skip stubs to implement |
| 9 | API & DB Integration Tests | TEST-08, TEST-09 | Needs seedTestCard/seedTestWishlist/truncateTable helpers |
| 10 | Scheduler Tests | TEST-10, TEST-11 | Mock all side effects; no real DB/network |
| 11 | Orchestrator Functions & Tests | TEST-12, TEST-13 | Implement 5 new functions; preserve existing API |

### Blockers

*None currently*

### Active Todos

*None — roadmap ready, awaiting `/gsd-plan-phase 7`*

---
*State initialized: 2026-05-09*
*Last updated: 2026-05-09 (v1.1 roadmap complete)*
