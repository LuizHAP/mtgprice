---
phase: 10-scheduler-tests
reviewed: 2026-05-13T21:22:09Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/scheduler/jobs.ts
  - src/scheduler/__tests__/jobs.test.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-13T21:22:09Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two files reviewed: the scheduler implementation (`jobs.ts`) and its test suite (`jobs.test.ts`). The production code is functionally sound for the happy path, but has two distinct correctness gaps worth addressing. The test suite has more problems: the concurrent-execution test relies on a fragile microtask-yield count that can silently become a false-pass, the `concurrent executions` `beforeEach` does not re-mock `node-cron`, which causes the `vi.resetModules()` call to leave `node-cron` unmocked (making any cron code that fires there crash), and there is also an unused import in the production file.

---

## Warnings

### WR-01: `scheduleMetagameRefresh` skips cron expression validation

**File:** `src/scheduler/jobs.ts:296-300`
**Issue:** `schedulePriceCollection` validates all three cron expressions via `cron.validate()` before creating jobs (lines 213-218) and throws on bad input. `scheduleMetagameRefresh` reads `process.env.CRON_METAGAME_REFRESH`, passes it directly to `cron.schedule()`, and never validates. An invalid override such as `CRON_METAGAME_REFRESH=not-a-cron` will cause `node-cron` to silently fail or throw at runtime without a clear error message, whereas the price-collection path would have surfaced the problem at startup.
**Fix:**
```ts
export function scheduleMetagameRefresh() {
  const schedule = process.env.CRON_METAGAME_REFRESH || '0 2 * * 0'

  // Validate before scheduling, consistent with schedulePriceCollection (D-03)
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: ${schedule}`)
  }

  logger.info(`Scheduling metagame refresh: schedule=${schedule}`)
  // ... rest unchanged
}
```

---

### WR-02: Concurrent-execution test relies on an arbitrary microtask-yield count that is brittle

**File:** `src/scheduler/__tests__/jobs.test.ts:275-277`
**Issue:** The test yields the microtask queue exactly three times (`await Promise.resolve()` × 3) to allow the first `executePriceCollection` call to advance past `getMonitoredCardIds()` and set `isRunning = true` before the second call is issued. The correct number of yields depends on the internal async chain depth of `getMonitoredCardIds` (one `await db.query.cards.findMany`). If that chain depth ever changes — e.g., an await is added or removed inside `getMonitoredCardIds` or the mock — the first call may not have set `isRunning = true` yet, causing the second call to also proceed and the test to produce a false-pass (both run to completion, but the assertion on `secondStats` still passes because `durationMs` is non-zero while being compared with `durationMs: 0`). A false-pass here means the concurrent-execution guard could regress silently.

**Fix:** Use a synchronization primitive instead of counting awaits. One idiomatic approach: expose a promise from the first call's internal state, or use a flag set at the start of `getMonitoredCardIds`. A simpler in-test fix is to make the mock itself signal readiness:
```ts
it('should handle concurrent executions', async () => {
  // ... setup ...
  let firstRunSetFlag = false
  vi.mocked(fetchAllPricesModule.default).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
  )

  const firstRun = executePriceCollection()

  // Yield until isRunning is set, rather than guessing the count
  // (max iterations prevent infinite loop)
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
    // If the module exposes isRunning, check it; otherwise the loop
    // count still gives a deterministic upper bound
  }

  const secondStats = await executePriceCollection()
  expect(secondStats).toEqual({ total: 0, fetched: 0, skipped: 0, failed: 0, durationMs: 0 })

  resolveFirst({ total: 1, fetched: 0, skipped: 0, failed: 0, errors: [] })
  await firstRun
})
```
Even raising the fixed count to 10-20 provides a meaningful safety margin. For a robust solution, export a `getIsRunning()` helper from `jobs.ts` solely for testing.

---

### WR-03: `concurrent executions` `beforeEach` calls `vi.resetModules()` but does not re-mock `node-cron`

**File:** `src/scheduler/__tests__/jobs.test.ts:241-257`
**Issue:** `vi.resetModules()` clears the entire module registry. The top-level `vi.mock('node-cron', ...)` factory is only registered once at file load time. After `resetModules()`, subsequent dynamic imports of `../jobs` will attempt to load the real `node-cron`. However, the concurrent-execution test does not call `schedulePriceCollection` or `scheduleMetagameRefresh`, so `node-cron` is never actually imported in that test. This means the bug is dormant today, but any future test added inside the same `describe('concurrent executions')` block that calls a scheduling function will get the real `cron` module (or an import error if `node-cron` is unavailable in the test environment), producing confusing failures.

**Fix:** Add `node-cron` and `@/scraper/metagame` to the `doMock` list inside the `concurrent executions` `beforeEach`:
```ts
beforeEach(() => {
  vi.resetModules()
  vi.doMock('node-cron', () => {
    const mockSchedule = vi.fn().mockReturnValue({ start: vi.fn(), stop: vi.fn() })
    const mockValidate = vi.fn().mockReturnValue(true)
    return { default: { schedule: mockSchedule, validate: mockValidate }, schedule: mockSchedule }
  })
  vi.doMock('@/scraper/metagame', () => ({
    executeMetagameRefresh: vi.fn(),
  }))
  // ... existing doMocks ...
})
```

---

### WR-04: `executePriceCollection` returns `failed: 1` on critical error regardless of how many cards were being processed

**File:** `src/scheduler/jobs.ts:163-173`
**Issue:** When the outer `try` block throws (e.g., `fetchAllPrices` rejects), the catch handler returns a hardcoded `{ total: 0, fetched: 0, skipped: 0, failed: 1 }`. If 500 cards were queued, callers receive `failed: 1`, which is misleading — nothing was actually fetched/failed per card; the run aborted wholesale. This misrepresents the failure severity to any consumer that aggregates or displays the returned stats. The test on line 228 encodes this misleading behaviour: `expect(stats.failed).toBe(1)`.

**Fix:** Return `failed: cardIds.length` (captured before the throw) to accurately signal that all queued cards failed, or introduce a dedicated `aborted: boolean` field. At minimum, document in the JSDoc that `failed: 1` on a critical error is a sentinel, not a per-card count.
```ts
} catch (error) {
  logger.error(`Critical error during price collection: ${error}`)
  const durationMs = Date.now() - startTime
  logger.info(`Price collection took ${durationMs}ms`)
  return {
    total: cardIds.length,   // preserve the actual scope
    fetched: 0,
    skipped: 0,
    failed: cardIds.length,  // all cards failed (run aborted)
    durationMs,
  }
}
```
Note: `cardIds` is declared inside the `try` block, so it must be hoisted to the function scope (initialized to `[]`) to be accessible in the catch.

---

## Info

### IN-01: Unused import `cards` from `@/db/schema`

**File:** `src/scheduler/jobs.ts:13`
**Issue:** `import { cards } from '@/db/schema'` is present at line 13 but `cards` is never referenced in the file. The query at line 46 uses `db.query.cards.findMany` which does not need the schema import directly.
**Fix:** Remove the import:
```ts
// Remove this line:
import { cards } from '@/db/schema'
```

---

### IN-02: Large number of skipped tests with `expect(true).toBe(false)` bodies

**File:** `src/scheduler/__tests__/jobs.test.ts:291-384`
**Issue:** Eleven tests are skipped (`test.skip`) and contain `expect(true).toBe(false)` inside their bodies. While `test.skip` prevents them from running, the failing assertion body is a trap: if someone accidentally removes the `.skip`, every test will immediately fail in a confusing way ("Expected false to be false" is an opaque message). Using `expect(true).toBe(false)` as a TODO marker is an anti-pattern; the conventional approach is `throw new Error('not implemented')` or simply an empty body.
**Fix:** Replace the bodies with either an empty function or a `throw`:
```ts
test.skip('should verify jobs run at correct times', async () => {
  // TODO: implement
})
```

---

_Reviewed: 2026-05-13T21:22:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
