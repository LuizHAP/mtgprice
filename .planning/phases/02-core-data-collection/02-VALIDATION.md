---
phase: 02
slug: core-data-collection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured from Phase 1) |
| **Config file** | vitest.config.ts (from Phase 1) |
| **Quick run command** | `pnpm test:run` |
| **Full suite command** | `pnpm test:coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run src/scraper/**/*.test.ts`
- **After every plan wave:** Run `pnpm test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-00-01 | 00 | 0 | All | unit | `pnpm test:run` | ✅ W0 | ⬜ pending |
| 02-01-01 | 01 | 1 | PRICE-08 | unit | `pnpm test:run src/scraper/providers/scryfall.test.ts` | ✅ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | PRICE-08 | unit | `pnpm test:run src/scraper/providers/liga-magic.test.ts` | ✅ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | PRICE-01 | integration | `pnpm test:run src/scraper/providers/tcgplayer.test.ts` | ✅ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | PRICE-02 | integration | `pnpm test:run src/scraper/providers/cardmarket.test.ts` | ✅ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | PRICE-03 | integration | `pnpm test:run src/scraper/providers/cardkingdom.test.ts` | ✅ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | PRICE-05 | unit | `pnpm test:run src/lib/currency.test.ts` | ✅ W0 | ⬜ pending |
| 02-04-01 | 04 | 4 | PRICE-07 | integration | `pnpm test:run src/scraper/scheduler.test.ts` | ✅ W0 | ⬜ pending |
| 02-04-02 | 04 | 4 | All | integration | `pnpm test:run src/scraper/orchestrator.test.ts` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/scraper/__tests__/scryfall.test.ts` — stubs for Scryfall bulk data import
- [ ] `src/scraper/__tests__/liga-magic.test.ts` — stubs for Liga Magic scraping
- [ ] `src/scraper/__tests__/tcgplayer.test.ts` — stubs for TCGPlayer API/scraping
- [ ] `src/scraper/__tests__/cardmarket.test.ts` — stubs for CardMarket API/scraping
- [ ] `src/scraper/__tests__/cardkingdom.test.ts` — stubs for CardKingdom API/scraping
- [ ] `src/scraper/__tests__/scheduler.test.ts` — stubs for node-corchestrator scheduling
- [ ] `src/scraper/__tests__/orchestrator.test.ts` — stubs for fetch orchestration
- [ ] `src/lib/__tests__/currency.test.ts` — stubs for currency conversion with IOF
- [ ] `src/scraper/__tests__/circuit-breaker.test.ts` — stubs for Opossum circuit breaker
- [ ] `src/scraper/__tests__/refresh-tracker.test.ts` — stubs for 8-hour smart refresh state

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Actual price collection from real sources | PRICE-01,02,03,04 | Requires real API keys and live network calls | Run collection manually with 2-3 test cards, verify prices in database |
| Currency conversion accuracy | PRICE-05 | Requires real exchange rate API | Verify BRL prices match expected conversion with 6.38% IOF |
| Scheduled execution timing | PRICE-07, NOTIF-03 | Requires real time passage | Start node-cron job, verify it runs 2-3x daily at correct times |
| Circuit breaker activation | All | Requires triggering actual source failures | Mock source failures, verify circuit breaker opens after 50% failure rate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
