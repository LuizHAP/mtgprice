---
phase: 10
plan: "01"
subsystem: scheduler
tags: [testing, scheduler, node-cron, vitest, test-activation]
dependency_graph:
  requires: []
  provides: [TEST-10, TEST-11]
  affects: [src/scheduler/jobs.ts, src/scheduler/__tests__/jobs.test.ts]
tech_stack:
  added: []
  patterns: [dynamic-import-test-pattern, vi.resetModules-concurrency-isolation, vi.doMock-after-resetModules]
key_files:
  created: []
  modified:
    - src/scheduler/jobs.ts
    - src/scheduler/__tests__/jobs.test.ts
decisions:
  - "durationMs on early isRunning return is literal 0 (not Date.now()-startTime) so concurrency test can use exact equality assertion"
  - "concurrency test uses vi.resetModules() + vi.doMock() in nested describe to reset module-level isRunning flag"
  - "findMany mock uses as any cast to avoid strict TypeScript requirement for full card object shape"
metrics:
  duration_seconds: 469
  completed_date: "2026-05-13"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
  commits: 4
---

# Phase 10 Plan 01: Scheduler Test Activation Summary

**One-liner:** Activated 7 test.skip stubs for schedulePriceCollection and executePriceCollection with cron.validate guard and durationMs tracking in jobs.ts.

## What Was Built

Phase 10 plan 01 delivers TEST-10 and TEST-11 by:

1. **Two minimal additions to `src/scheduler/jobs.ts`** that make the tests verifiable without behavioral regression:
   - `cron.validate()` guard in `schedulePriceCollection`: iterates morning/afternoon/evening schedule expressions before any `cron.schedule` call and throws `Error("Invalid cron expression: ${expr}")` on first invalid expression
   - `durationMs` tracking in `executePriceCollection`: captures `Date.now()` at function entry, computes elapsed on each of the 4 return paths, adds `durationMs: number` to the return type

2. **Extended test mocks** in `src/scheduler/__tests__/jobs.test.ts`:
   - Added `validate: mockValidate` to the node-cron mock's `default` object
   - Added top-level `vi.mock('@/lib/opportunities', ...)` factory with all 3 exports (detectOpportunitiesForWishlist, sendDigestAndPersist, loadDetectionConfig)

3. **Activated 7 test.skip stubs** with real assertion bodies:
   - `schedulePriceCollection`: cron registration (3x daily, default expressions), custom schedule override, invalid expression rejection
   - `executePriceCollection`: full fetch orchestration with durationMs, error handling with durationMs, duration metrics type assertion, concurrency guard with exact-equality return shape

## Test Count Delta

| State | Passed | Skipped | Total (this file) |
|-------|--------|---------|-------------------|
| Before (baseline) | 5 | 17 | 22 |
| After (phase 10) | 12 | 10 | 22 |
| Delta | +7 | -7 | 0 |

Full suite: 172 passed / 171 skipped → 179 passed / 164 skipped (+7 each direction)

## Implementation Deltas in src/scheduler/jobs.ts

| Addition | Location | Description |
|----------|----------|-------------|
| Return type widening | Line 74-79 | `durationMs: number` added to executePriceCollection return type |
| `const startTime = Date.now()` | Line 80 (new) | First statement of executePriceCollection, before isRunning guard |
| `durationMs: 0` early return | Lines 83-91 | isRunning early-return path uses literal 0 (not elapsed) |
| No-cards durationMs | Lines 103-109 | `Date.now() - startTime` + log + return field |
| Success durationMs | Lines ~150-157 | `Date.now() - startTime` + log + return field |
| Error catch durationMs | Lines ~161-169 | `Date.now() - startTime` + log + return field |
| `cron.validate` guard | Lines 200-205 (new) | for...of loop before logger.info + cron.schedule calls |

## D-01 Boundary Enforcement

The following 10 stubs remain as `test.skip` per decision D-01 (require functions not yet in jobs.ts):

| Group | Stubs | Reason for staying skipped |
|-------|-------|---------------------------|
| `validateScheduleTimes` | 3 | Function does not exist in jobs.ts |
| `stopScheduler` | 3 | Function does not exist in jobs.ts |
| `Integration scenarios` | 4 | Require multi-function integration (validateScheduleTimes + stopScheduler) |

Note: The plan's `must_haves` stated "9 remaining stubs" but the actual file has 10 remaining (Integration scenarios has 4 stubs, not 3). This was a counting discrepancy in the plan document. The correct count is 10 remaining = 3+3+4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed concurrency test `resolveFirst is not a function`**
- **Found during:** Task 3 initial test run
- **Issue:** The plan's concurrency test template assigned `resolveFirst` inside `mockImplementationOnce` but the mock wasn't invoked (and therefore `resolveFirst` not assigned) before `resolveFirst()` was called. `executePriceCollection` first awaits `getMonitoredCardIds()` before reaching `fetchAllPrices`.
- **Fix:** Added `await Promise.resolve()` x3 to yield micro-task queue and allow the first `executePriceCollection` call to progress through `findMany` to `fetchAllPrices`. Changed `resolveFirst` type to match the actual resolve function signature rather than a bare `() => void`.
- **Files modified:** `src/scheduler/__tests__/jobs.test.ts`
- **Commit:** 5e112a6 (initial) + a6e6018 (type fix)

**2. [Rule 1 - Bug] Fixed TypeScript error — findMany mock partial object**
- **Found during:** Task 3 TypeScript verification
- **Issue:** `mockResolvedValueOnce([{ oracleId: 'test-id' }])` caused TS2740 because the full card type requires id, name, set, rarity, color, imageUrl, lastFetched. Tests only need `oracleId` since `getMonitoredCardIds` only accesses `.oracleId` on each card.
- **Fix:** Added `as any` cast with biome-ignore comment to both `findMany.mockResolvedValueOnce` calls in the test file.
- **Files modified:** `src/scheduler/__tests__/jobs.test.ts`
- **Commit:** a6e6018

## Decisions Made

1. **durationMs: 0 on isRunning early return** — literal 0 (not `Date.now() - startTime`) so the concurrency test can use `toEqual({ ..., durationMs: 0 })` for exact equality assertion per D-09.
2. **Nested `describe('concurrent executions')` with dedicated `beforeEach`** — uses `vi.resetModules()` + `vi.doMock()` to reset the module-level `isRunning` flag independently of the other 3 executePriceCollection tests (which use lighter `vi.clearAllMocks()` only).
3. **`as any` cast for findMany mocks** — test mocks only need `oracleId` for the function path being tested; strict TypeScript would require the full card shape which adds unnecessary noise to test code.

## Self-Check: PASSED

- [x] `src/scheduler/jobs.ts` modified: cron.validate guard + durationMs tracking present
- [x] `src/scheduler/__tests__/jobs.test.ts` modified: 7 stubs activated, 10 remain skipped
- [x] Commits: ee13ec7, e83fb1f, 5e112a6, a6e6018 all exist
- [x] `pnpm test:run src/scheduler/__tests__/jobs.test.ts`: 12 passed / 10 skipped (22 total)
- [x] `pnpm test:run` (full suite): 179 passed / 164 skipped / 38 todo — no regressions
- [x] No scheduler-specific TypeScript errors
- [x] D-01 boundary: 10 out-of-scope stubs remain `test.skip`
- [x] No real network, DB, or Telegram calls during scheduler tests (all mocked)
