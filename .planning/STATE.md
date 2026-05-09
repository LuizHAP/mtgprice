---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: test-coverage-quality-hardening
current_phase: not started
current_plan: —
status: defining requirements
last_updated: "2026-05-09T00:00:00Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# MTG Price Monitor - Project State

**Last updated:** 2026-05-09
**Current phase:** Not started
**Current plan:** —
**Status:** Defining requirements

## Project Reference

**Core Value:** Jogadores de MTG compram cartas no momento ideal baseado em análise de tendências de preço e comparação entre múltiplas fontes (BR + internacional).

**What we're building:**
Milestone v1.1 — Test Coverage & Quality Hardening: ativar os 200 testes skipped implementando as features que os stubs prometem cobrir.

## Current Position

**Milestone:** v1.1 — Test Coverage & Quality Hardening
**Phase:** Not started (defining requirements)
**Status:** Defining requirements
**Last activity:** 2026-05-09 — Milestone v1.1 started

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

### Known Constraints

1. **Biome noDelete rule:** `delete process.env.X` requires `// biome-ignore lint/performance/noDelete` comment in test teardown — assigning `undefined` coerces to string, pollutes env
2. **Cotação de câmbio:** IOF 6.38% (cartão de crédito) nas conversões dólar/euro → real
3. **Rate limiting:** Scryfall 10 req/sec, Telegram 100 req/60sec
4. **Vitest 3.x:** `vi.useFakeTimers()` + async mock functions causes unhandled rejection warnings — use `vi.spyOn(globalThis, 'setTimeout')` instead

### Milestone v1.0 Summary

All 6 phases complete (30/30 plans):
- Phase 1: Foundation & Infrastructure (auth, DB, rate limiting, Telegram bot)
- Phase 2: Core Data Collection (4 price sources, circuit breakers, currency conversion)
- Phase 3: User Interface & Wishlist (dashboard, search API, bot commands)
- Phase 4: Opportunity Detection & Notifications (detection algorithm, digest, /history, /config)
- Phase 5: Metagame Integration (EDHREC, MTGTop8, Scryfall resolver, weekly cron)
- Phase 6: Polish & Optimization (withRetry, p-limit concurrency, Telegram health alerts)

**Test suite state at v1.0 end:** 127 passing | 200 skipped | 54 todo

### Blockers

*None currently*

### Active Todos

*None — milestone v1.1 requirements being defined*

---
*State initialized: 2026-05-09*
*Last updated: 2026-05-09*
