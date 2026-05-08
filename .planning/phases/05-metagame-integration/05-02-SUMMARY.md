---
phase: 05-metagame-integration
plan: "02"
subsystem: scraper-metagame
tags: [edhrec, mtgtop8, cheerio, axios, tdd, metagame-fetchers, circuit-breaker]
dependency_graph:
  requires:
    - 05-01 (isAutoAdded column, SCRYFALL_HEAVY preset, Wave 0 test stubs)
  provides:
    - fetchEDHRECTopCards() — Commander top 50 names from EDHREC JSON API
    - fetchMTGTop8TopCards('ST'|'MO') — Standard/Modern top 50 names from MTGTop8 HTML
    - MTGTop8Format type union exported from mtgtop8.ts
    - Full vitest suites for both fetchers (14 passing tests, replacing 11 it.todo() stubs)
  affects:
    - Plan 03 (scryfall-resolver consumes string[] from both fetchers)
    - Plan 04 (orchestrator composes fetchEDHRECTopCards + fetchMTGTop8TopCards)
tech_stack:
  added: []
  patterns:
    - TDD RED-GREEN cycle (vitest + vi.mock for axios + logger)
    - Circuit-breaker resilience pattern: try/catch returns [] never throws
    - Cheerio HTML scraping (same pattern as liga-magic.ts from Phase 2)
    - Stale meta ID guard: MIN_EXPECTED_ROWS=20 threshold before trusting parsed rows
    - Fallback JSON path traversal for EDHREC endpoint shape variation
key_files:
  created:
    - src/scraper/metagame/edhrec.ts
    - src/scraper/metagame/mtgtop8.ts
  modified:
    - src/scraper/metagame/__tests__/edhrec.test.ts (replaced 5 it.todo() stubs with 7 real tests)
    - src/scraper/metagame/__tests__/mtgtop8.test.ts (replaced 6 it.todo() stubs with 7 real tests)
decisions:
  - "Running vitest from worktree directory via `npx vitest run` (not `pnpm test:run`) to target worktree files — main project pnpm test:run resolves vitest.config.ts from the main project root which reads the main project src/, not the worktree"
  - "Pre-existing TypeScript errors in auth.test.ts, tailwind.config.ts, wishlist/actions.test.ts confirmed baseline (present on base commit f59de94 before any changes) — not introduced by this plan"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
  commits: 2
---

# Phase 05 Plan 02: EDHREC Commander + MTGTop8 Standard/Modern Fetchers Summary

Two metagame fetcher modules with TDD-verified circuit-breaker resilience: `fetchEDHRECTopCards()` reading Commander top 50 from EDHREC's JSON API and `fetchMTGTop8TopCards('ST'|'MO')` scraping Standard/Modern top 50 from MTGTop8 HTML via cheerio, both returning empty array on failure.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement fetchEDHRECTopCards (EDHREC Commander) with full test suite | 108f07d | src/scraper/metagame/edhrec.ts, src/scraper/metagame/__tests__/edhrec.test.ts |
| 2 | Implement fetchMTGTop8TopCards (Standard + Modern) with full test suite | 806390d | src/scraper/metagame/mtgtop8.ts, src/scraper/metagame/__tests__/mtgtop8.test.ts |

## Verification Results

- `src/scraper/metagame/edhrec.ts` exports `fetchEDHRECTopCards` — PASS
- `edhrec.ts` hits `https://json.edhrec.com/pages/top/week.json` — PASS
- `edhrec.ts` implements fallback to `container.json_dict.cardlists[0].cardviews` — PASS
- `edhrec.ts` caps names at 255 chars, returns [] on failure — PASS
- `src/scraper/metagame/mtgtop8.ts` exports `fetchMTGTop8TopCards` and `MTGTop8Format` — PASS
- `mtgtop8.ts` hits `https://www.mtgtop8.com/topcards` with meta IDs ST=52, MO=51 — PASS
- `mtgtop8.ts` contains `MIN_EXPECTED_ROWS = 20` stale meta ID guard — PASS
- `mtgtop8.ts` sets `User-Agent: MTGPrice-Monitor/1.0` — PASS
- `mtgtop8.ts` caps names at 255 chars, returns [] on failure — PASS
- `pnpm test:run` (in worktree): 14 passed, 0 failed across both test files — PASS
- Pre-existing TypeScript errors confirmed baseline (not introduced by this plan) — PASS

## Deviations from Plan

### Worktree vs Main Project Vitest Invocation

**Found during:** Task 1 verification (GREEN step)
**Issue:** `pnpm test:run` from any directory resolves vitest.config.ts from the main project root (`/Users/.../mtgprice`), which reads the main project's `src/` tree — not the worktree's files. The new test files in the worktree appeared to still be running the old `it.todo()` stubs.
**Fix:** Used `npx vitest run <file>` from within the worktree directory, which correctly resolves vitest.config.ts from the worktree and picks up the updated test files.
**Files modified:** None — invocation-only fix.

## Known Stubs

None — both fetcher modules are fully implemented. The remaining `it.todo()` stubs in `scryfall-resolver.test.ts` and `orchestrator.test.ts` belong to Plans 03 and 04 respectively and are intentionally left for those plans.

## Threat Flags

None — both modules are read-only scrapers hitting public endpoints with no new network listener surfaces, no auth paths, and no DB writes. All STRIDE threats T-5-02-01 through T-5-02-08 from the plan's threat_model are mitigated as designed.

## Self-Check: PASSED

- `src/scraper/metagame/edhrec.ts` — FOUND
- `src/scraper/metagame/mtgtop8.ts` — FOUND
- `src/scraper/metagame/__tests__/edhrec.test.ts` — FOUND (7 it() blocks, 0 it.todo())
- `src/scraper/metagame/__tests__/mtgtop8.test.ts` — FOUND (7 it() blocks, 0 it.todo())
- Commit 108f07d — FOUND
- Commit 806390d — FOUND
