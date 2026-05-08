---
phase: 05-metagame-integration
plan: "05"
subsystem: scheduler
tags: [scheduler, cron, metagame, node-cron, tdd, weekly-job, D-02]
dependency_graph:
  requires:
    - 05-04 (executeMetagameRefresh orchestrator)
  provides:
    - scheduleMetagameRefresh() -- weekly Sunday 2AM cron registration
    - CRON_METAGAME_REFRESH env var documented in .env.example
  affects:
    - src/bot/index.ts (will call scheduleMetagameRefresh().start() on bot startup)
    - META-01, META-02, META-03 (transition from code-complete to operational)
tech_stack:
  added: []
  patterns:
    - TDD RED->GREEN (vitest + vi.mock for node-cron, @/scraper/metagame, @/lib/logger)
    - vi.mock factory with biome-ignore lint comment for process.env delete
    - Cron callback defensive try/catch (separate from orchestrator's internal try/catch)
    - scheduleMetagameRefresh mirrors schedulePriceCollection start/stop shape
key_files:
  created: []
  modified:
    - src/scheduler/jobs.ts (added import, metagameJob variable, scheduleMetagameRefresh function)
    - src/scheduler/index.ts (added scheduleMetagameRefresh to named exports)
    - src/scheduler/__tests__/jobs.test.ts (added 5 new tests for scheduleMetagameRefresh)
    - .env.example (added CRON_METAGAME_REFRESH=0 2 * * 0 to Scheduler section)
decisions:
  - "biome-ignore lint/performance/noDelete used for process.env cleanup in tests -- process.env requires delete (not undefined assignment) to truly unset a variable"
  - "vi.mock factory pattern for node-cron chosen over vi.spyOn to avoid dynamic import issues in vitest ESM environment"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 4
  commits: 2
---

# Phase 05 Plan 05: Weekly Metagame Cron Registration Summary

`scheduleMetagameRefresh()` wired as a dedicated weekly Sunday 2AM cron job that invokes `executeMetagameRefresh()` from `@/scraper/metagame`, with defensive try/catch, env-var override support, and start/stop control surface matching `schedulePriceCollection` — completing Phase 5 and making META-01, META-02, META-03 operational.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add scheduleMetagameRefresh to jobs.ts, update barrel exports, add TDD tests | 5e89471 | src/scheduler/jobs.ts, src/scheduler/index.ts, src/scheduler/__tests__/jobs.test.ts |
| 2 | Document CRON_METAGAME_REFRESH in .env.example | 358ee8e | .env.example |

## Verification Results

- `src/scheduler/jobs.ts` contains `import { executeMetagameRefresh } from '@/scraper/metagame'` -- PASS
- `src/scheduler/jobs.ts` contains `export function scheduleMetagameRefresh` -- PASS
- `src/scheduler/jobs.ts` contains `process.env.CRON_METAGAME_REFRESH` -- PASS
- `src/scheduler/jobs.ts` contains `'0 2 * * 0'` (Sunday 2AM default) -- PASS
- `src/scheduler/jobs.ts` contains `metagameJob: cron.ScheduledTask | null` -- PASS
- `src/scheduler/jobs.ts` callback contains `try` and `catch` (defensive) -- PASS
- `src/scheduler/jobs.ts` callback contains `JSON.stringify(summary)` -- PASS
- `src/scheduler/jobs.ts` STILL contains `export function schedulePriceCollection` -- PASS
- `src/scheduler/jobs.ts` STILL contains `export async function executePriceCollection` -- PASS
- `src/scheduler/jobs.ts` STILL contains `export { executePriceCollection as default }` -- PASS
- D-02 verified: `executeMetagameRefresh` NOT called inside `executePriceCollection` body -- PASS
- `src/scheduler/index.ts` contains `scheduleMetagameRefresh` in named exports -- PASS
- `src/scheduler/index.ts` STILL contains `schedulePriceCollection` and `executePriceCollection` -- PASS
- `src/scheduler/__tests__/jobs.test.ts` contains `describe('scheduleMetagameRefresh'` -- PASS
- 5 new `it()` blocks covering: registration, env override, start/stop shape, callback invocation, defensive try/catch -- PASS
- `pnpm test:run -- src/scheduler/__tests__/jobs.test.ts` exits 0: 5 passed, 17 skipped -- PASS
- `pnpm tsc --noEmit` exits 0 for scheduler files -- PASS
- `.env.example` contains literal line `CRON_METAGAME_REFRESH=0 2 * * 0` -- PASS
- `.env.example` CRON_METAGAME_REFRESH positioned after CRON_EVENING, before `# Opportunity Detection (Phase 4)` -- PASS

## TDD Execution

**RED:** Appended `describe('scheduleMetagameRefresh', ...)` with 5 `it()` blocks to `jobs.test.ts`. Ran tests — `TypeError: scheduleMetagameRefresh is not a function` for 5 tests confirmed RED step.

**GREEN:** Added `import { executeMetagameRefresh } from '@/scraper/metagame'`, `metagameJob` variable, and `scheduleMetagameRefresh()` function to `jobs.ts`. Updated `index.ts` barrel. Ran tests: 5/5 passing.

**REFACTOR:** One fix required by Biome linter — replaced `delete process.env.CRON_METAGAME_REFRESH` with a `biome-ignore` comment + `delete` (the unsafe auto-fix `= undefined` coerces to string `"undefined"` and breaks the env-override test). Added comment explaining the suppression is intentional for `process.env` teardown.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome lint/performance/noDelete on process.env cleanup**
- **Found during:** Task 1, commit step (pre-commit hook)
- **Issue:** Biome flagged `delete process.env.CRON_METAGAME_REFRESH` in `beforeEach`. Its auto-fix (`= undefined`) coerces the env var to the string `"undefined"`, causing the env-override test to pass `"undefined"` as the cron schedule instead of the default `'0 2 * * 0'`.
- **Fix:** Added `// biome-ignore lint/performance/noDelete: process.env requires delete to truly unset a var` comment above the `delete` statement. Tests pass, linter passes.
- **Files modified:** `src/scheduler/__tests__/jobs.test.ts`
- **Commit:** 5e89471

**2. [Rule 3 - Blocking] vi.mock factory required instead of vi.spyOn**
- **Found during:** Task 1, test design
- **Issue:** The plan's suggested test template used `vi.spyOn(cronModule.default, 'schedule')` with dynamic imports. In vitest's ESM environment, `vi.spyOn` on a default-exported object from a dynamic import is unreliable because the mock is applied after module evaluation. The existing test file had no cron mocking to reference.
- **Fix:** Used `vi.mock('node-cron', factory)` at the top of the test file to replace the module with a controlled mock, then asserted on `vi.mocked(cronModule.default.schedule).mock.calls`. This is the standard vitest pattern for module-level mocking.
- **Files modified:** `src/scheduler/__tests__/jobs.test.ts`
- **Commit:** 5e89471

## Known Stubs

None — `scheduleMetagameRefresh()` is fully implemented. The weekly cron is registered and will fire automatically once `scheduleMetagameRefresh().start()` is called from the bot/server bootstrap. META-01, META-02, META-03 are operational after this plan.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. All threats from the plan's threat register are mitigated:

- T-5-05-01 (malformed CRON_METAGAME_REFRESH): node-cron validates at registration; default `'0 2 * * 0'` is hardcoded fallback
- T-5-05-07 (unhandled rejection in cron callback): outer try/catch verified by "does NOT throw" test
- T-5-05-05 (no repudiation log): three log points present (registration, trigger, completion)

## Self-Check: PASSED

- `src/scheduler/jobs.ts` -- FOUND (contains scheduleMetagameRefresh)
- `src/scheduler/index.ts` -- FOUND (exports scheduleMetagameRefresh)
- `src/scheduler/__tests__/jobs.test.ts` -- FOUND (5 passing tests)
- `.env.example` -- FOUND (contains CRON_METAGAME_REFRESH=0 2 * * 0)
- Commit 5e89471 -- FOUND
- Commit 358ee8e -- FOUND
