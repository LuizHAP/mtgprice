# Phase 10: Scheduler Tests - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Activate the 7 skipped test stubs in `src/scheduler/__tests__/jobs.test.ts` — specifically the `schedulePriceCollection` describe block (3 tests: cron registration, custom schedule override, invalid expression rejection) and the `executePriceCollection` describe block (4 tests: run orchestration, error handling, duration metrics, concurrency guard).

Two small implementation additions to `src/scheduler/jobs.ts` are in scope to support the tests:
1. `cron.validate()` guard in `schedulePriceCollection` (enables invalid expression rejection test)
2. Duration tracking in `executePriceCollection` (start time → compute elapsed → log → include `durationMs` in return value)

**Explicitly out of scope for Phase 10:**
- The 9 remaining stubs in the file (`validateScheduleTimes` ×3, `stopScheduler` ×3, `Integration scenarios` ×3) — stay as `test.skip`
- New scheduler features or behavior changes beyond the two additions above
- Orchestrator function implementations (Phase 11)

</domain>

<decisions>
## Implementation Decisions

### Test Scope

- **D-01:** Only activate the 7 stubs covered by TEST-10 and TEST-11. The remaining 9 stubs (`validateScheduleTimes`, `stopScheduler`, `Integration scenarios`) require functions that don't exist in `jobs.ts` yet — they stay skipped.
- **D-02:** The 7 required stubs live in two describe blocks: `describe('schedulePriceCollection')` and `describe('executePriceCollection')`. All stubs within those blocks are activated (not cherry-picked).

### schedulePriceCollection — Cron Validation

- **D-03:** Add a `cron.validate()` guard at the top of `schedulePriceCollection`, one call per schedule expression (`morningSchedule`, `afternoonSchedule`, `eveningSchedule`). If **any** expression fails validation, throw `new Error(\`Invalid cron expression: \${expr}\`)` before any `cron.schedule` call is made.
- **D-04:** The test "should handle invalid cron expressions" sets one of the env vars (e.g., `CRON_MORNING`) to an invalid string, calls `schedulePriceCollection()`, and asserts that an `Error` is thrown.

### executePriceCollection — Duration Tracking

- **D-05:** Capture `const startTime = Date.now()` at the start of `executePriceCollection` (before the `isRunning` guard early return). Compute `durationMs = Date.now() - startTime` just before each return path (including the early "already running" return). Log it via `logger.info(\`Price collection took \${durationMs}ms\`)`.
- **D-06:** Add `durationMs: number` to the return type `{ total, fetched, skipped, failed, durationMs }`. All return paths (early return, no-cards path, success path, error path) include `durationMs`.
- **D-07:** The test "should record execution duration" asserts that the returned stats object includes a `durationMs` field that is `>= 0`.

### Test Infrastructure

- **D-08:** Follow the established test setup pattern: `vi.clearAllMocks()` in `beforeEach`. The existing `vi.mock(...)` declarations at the top of the test file (node-cron, @/scraper/orchestrator, @/db, @/lib/logger) are reused as-is.
- **D-09:** For the concurrency guard test ("should handle concurrent executions"), the approach is: use `vi.resetModules()` in `beforeEach` to get a fresh module instance (resetting the `isRunning` module-level flag), then hold an unresolved `fetchAllPrices` mock to simulate an in-progress run, start a second `executePriceCollection`, and verify it returns `{ total: 0, fetched: 0, skipped: 0, failed: 0, durationMs: 0 }` immediately.
- **D-10:** The `@/lib/opportunities` module (called inside `executePriceCollection`) must be added to the `vi.mock(...)` declarations so `detectOpportunitiesForWishlist` and `sendDigestAndPersist` don't run during scheduler tests.
- **D-11:** The `db.query.cards.findMany` mock must return at least one card for the "should run full fetch orchestration" test (otherwise `executePriceCollection` short-circuits with empty stats before calling `fetchAllPrices`).

### Claude's Discretion

- Exact duration logging format (e.g., `"Price collection complete: 0 fetched, 0 skipped, 0 failed (120ms)"` vs separate log line) — consistent with existing `logger.info` calls in the function.
- Whether the `durationMs` on the "already running" early return is `0` or the actual elapsed few milliseconds — either is valid as long as the field exists.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal & Success Criteria
- `.planning/ROADMAP.md` §"Phase 10: Scheduler Tests" — success criteria, requirements TEST-10 and TEST-11

### Test File to Activate
- `src/scheduler/__tests__/jobs.test.ts` — full file; activate only the `schedulePriceCollection` and `executePriceCollection` describe blocks (7 stubs); leave the rest as `test.skip`

### Implementation Files to Modify
- `src/scheduler/jobs.ts` — add `cron.validate()` guard to `schedulePriceCollection`; add `durationMs` tracking to `executePriceCollection`
- `src/scheduler/index.ts` — re-exports from `jobs.ts`; check if return type re-export needs updating

### Existing Mocks to Extend
- `vi.mock('@/lib/opportunities', ...)` — must be added to the test file's top-level mocks to prevent real opportunity detection from running
- `vi.mock('@/db', ...)` — already present; extend `findMany` mock to return `[{ oracleId: 'test-id' }]` in the orchestration test

### Prior Phase Context & Patterns
- `.planning/phases/09-api-db-integration-tests/09-CONTEXT.md` — most recent context; same test activation pattern
- `.planning/phases/08-circuit-breaker-tests/08-01-PLAN.md` — plan format reference for test activation phases
- `src/scheduler/__tests__/jobs.test.ts` §`scheduleMetagameRefresh` describe — **already passing** tests for the same function family; follow their pattern exactly (vi.mock at top, vi.clearAllMocks in beforeEach, dynamic import inside each test)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/scheduler/jobs.ts` `schedulePriceCollection()`** — creates 3 cron jobs (morning/afternoon/evening) via `CRON_MORNING`, `CRON_AFTERNOON`, `CRON_EVENING` env vars; returns `{ start, stop }`. The validation guard slots in before the `cron.schedule` calls.
- **`src/scheduler/jobs.ts` `executePriceCollection()`** — full implementation with `isRunning` concurrency guard, `getMonitoredCardIds()`, `fetchAllPrices()`, opportunity detection, and error handling. Duration tracking slots in around the existing try/finally.
- **`src/scheduler/jobs.ts` `scheduleMetagameRefresh()`** — already-passing tests for this function live in the same test file; they are the canonical pattern reference.

### Established Patterns
- **Dynamic import in tests** — the passing `scheduleMetagameRefresh` tests use `await import('../jobs')` inside each `it()` block after setting env vars. `schedulePriceCollection` tests must use the same dynamic-import pattern (not a top-level import) so env vars set per-test are picked up.
- **`vi.mock` at top of file** — node-cron, @/scraper/orchestrator, @/db, @/lib/logger are already declared. Add `@/lib/opportunities` to this list.
- **`vi.clearAllMocks()` in beforeEach** — already present in the file; new describe blocks follow the same teardown.
- **`cron.validate(expr)` from node-cron** — `node-cron` exports `validate` alongside `schedule`. Import it as `import cron from 'node-cron'` (already in scope); call `cron.validate(expr)`.

### Integration Points
- **`fetchAllPrices` mock** — already mocked as `vi.mock('@/scraper/orchestrator', () => ({ default: vi.fn().mockResolvedValue({ fetched: 0, skipped: 0, failed: 0, errors: [] }) }))`. For the concurrency test, override with `mockImplementationOnce` to return an unresolved promise.
- **`db.query.cards.findMany` mock** — already mocked to return `[]`. For the orchestration test, override with `mockResolvedValueOnce([{ oracleId: 'test-id' }])` so `executePriceCollection` proceeds past the empty-cards early return.

</code_context>

<specifics>
## Specific Ideas

- The "invalid cron expressions" test should set `CRON_MORNING` to something like `'not-a-cron'` and assert `expect(() => schedulePriceCollection()).toThrow('Invalid cron expression')`.
- Duration tracking in `executePriceCollection` uses `Date.now()` (not `performance.now()`) for consistency with how the existing logger calls work.
- `durationMs` on the early "already running" return can be `0` — the important thing is the field exists so callers don't get a type error.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-Scheduler Tests*
*Context gathered: 2026-05-13*
