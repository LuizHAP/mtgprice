---
phase: 05-metagame-integration
plan: "03"
subsystem: scraper, metagame, ratelimit
tags: [scryfall, rate-limiting, batch-resolution, oracle-id, vitest, tdd]
dependency_graph:
  requires:
    - 05-01 (RATE_LIMITS.SCRYFALL_HEAVY preset at 2 req/s)
    - src/scraper/providers/scryfall.ts (ScryfallCard interface)
    - src/lib/ratelimit/rate-limiter.ts (checkRateLimitPreset)
  provides:
    - resolveNamesToOracleIds() — batched Scryfall name→oracle_id resolution
    - ResolvedCard interface — { name, oracleId, metadata: ScryfallCard }
  affects:
    - Plan 04 orchestrator (consumes resolveNamesToOracleIds for wishlist upsert)
    - META-01, META-02, META-03 (all three formats resolved through this module)
tech_stack:
  added: []
  patterns:
    - TDD (RED→GREEN): tests written and confirmed failing before implementation
    - Partial-success batch processing (continue on single-batch failure)
    - Rate-limit gate with single retry + sleep backoff
    - Defensive input filtering (empty/whitespace names filtered before HTTP call)
key_files:
  created:
    - src/scraper/metagame/scryfall-resolver.ts
  modified:
    - src/scraper/metagame/__tests__/scryfall-resolver.test.ts (replaced Plan 01 Wave 0 stubs with 8 real assertions)
decisions:
  - "BATCH_SIZE=75 hardcoded per Scryfall /cards/collection documented limit — not configurable to prevent silent 429s"
  - "RETRY_SLEEP_MS=500 with single retry: matches rate-limit window (2 req/s = 500ms between refills); second denial skips batch rather than looping"
  - "Partial-success semantics: single batch failure logs and continues rather than aborting — aligns with D-06 non-blocking failure policy"
  - "logger.info summary at end (resolved N/M names) provides per-run observability without per-card noise"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 1
  commits: 1
---

# Phase 05 Plan 03: Scryfall Name-to-Oracle-ID Resolver Summary

Batched Scryfall /cards/collection resolver (75 names/request, SCRYFALL_HEAVY rate limit at 2 req/s) with partial-failure tolerance, retry-on-throttle, and full ScryfallCard metadata returned alongside oracle_ids — enabling Plan 04 orchestrator to upsert cards and wishlist rows in a single pass without extra Scryfall round-trips.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement resolveNamesToOracleIds with batching, rate limiting, and partial-failure tolerance | c7d0a21 | src/scraper/metagame/scryfall-resolver.ts (new), src/scraper/metagame/__tests__/scryfall-resolver.test.ts (updated) |

## Verification Results

- `src/scraper/metagame/scryfall-resolver.ts` exists — PASS
- `export async function resolveNamesToOracleIds` present — PASS
- `export interface ResolvedCard` present — PASS
- `RATE_LIMITS.SCRYFALL_HEAVY` used for rate limit gate — PASS
- `BATCH_SIZE = 75` hardcoded — PASS
- Endpoint `https://api.scryfall.com/cards/collection` hardcoded — PASS
- Imports `ScryfallCard` from `@/scraper/providers/scryfall` — PASS
- `RETRY_SLEEP_MS` with 2-call retry pattern present — PASS
- `not_found` logging via `logger.warn` present — PASS
- No `it.todo(` entries in test file — PASS
- 8 `it()` blocks in test file — PASS
- All 8 tests pass (vitest output: 8 ✓, 0 ×, 0 failed) — PASS
- No TypeScript errors in new files (`pnpm tsc --noEmit` for metagame/* clean) — PASS

## TDD Execution

**RED:** Wrote 8 test assertions replacing Plan 01 Wave 0 stubs. Confirmed failure: `ERR_MODULE_NOT_FOUND` for `../scryfall-resolver` — all 8 tests failed as expected.

**GREEN:** Implemented `scryfall-resolver.ts`. Re-ran tests: 8/8 passing in 506ms (rate-limit retry test accounts for 500ms sleep). No refactor phase needed — implementation was clean.

## Deviations from Plan

### Worktree Branch State Issue (auto-fixed, Rule 3)

**Found during:** Pre-execution setup
**Issue:** `git merge-base` showed worktree at `ffd46c4` (dashboard design commit), not the expected base `f59de94`. The `git reset --soft` from the worktree_branch_check left the working tree files in the old state (metagame directory missing, many files showing as deleted in `git status`).
**Fix:** Ran `git checkout HEAD -- .` to restore all working tree files to match HEAD (f59de94). This brought the metagame stub files back.
**Files modified:** None (git tree restoration only)

### Test Execution from Worktree vs Main Project

**Found during:** RED step
**Issue:** `pnpm test:run` from the main project (`/Users/luizpansarini/Documents/Projetos/mtgprice`) runs vitest against the main project's `src/`, not the worktree's `src/`. The stub file in the main project still had `it.todo()` entries, so tests appeared as skipped (not failed) when invoked via `pnpm test:run` from main.
**Fix:** Used absolute path to vitest binary with worktree as cwd: `/Users/luizpansarini/Documents/Projetos/mtgprice/node_modules/.bin/vitest --run` — this uses the worktree's `vitest.config.ts` and `src/` directory. Node modules are shared via pnpm symlink.
**Impact:** No code changes needed; just different invocation path. Tests correctly showed FAIL (RED) and then PASS (GREEN).

### Pre-existing TypeScript Errors (out of scope, Rule scope boundary)

**Found during:** TypeScript verification
**Issue:** `pnpm tsc --noEmit` shows pre-existing errors in `src/lib/auth.test.ts`, `src/lib/wishlist/__tests__/actions.test.ts`, and `tailwind.config.ts` — none caused by this plan's changes.
**Fix:** Not fixed — out of scope. New files (`scryfall-resolver.ts` and updated test) have zero TypeScript errors.

## Known Stubs

None — `resolveNamesToOracleIds` is fully implemented and wired to the real Scryfall endpoint. No placeholder values or hardcoded empty returns.

## Threat Flags

None — no new network endpoints or auth paths beyond what the plan's threat model covers. The only new surface is `POST https://api.scryfall.com/cards/collection` which is the explicitly planned call in T-5-03-01.

## Self-Check: PASSED

- `src/scraper/metagame/scryfall-resolver.ts` — FOUND
- `src/scraper/metagame/__tests__/scryfall-resolver.test.ts` — FOUND (8 real assertions, 0 todos)
- Commit c7d0a21 — FOUND
