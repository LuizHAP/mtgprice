# Phase 10: Scheduler Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 10-scheduler-tests
**Areas discussed:** Test scope, Implementation additions

---

## Test scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only the 7 required | Activate exactly what TEST-10 and TEST-11 mandate. validateScheduleTimes/stopScheduler don't exist in jobs.ts — activating them would require new implementation work not in scope. | ✓ |
| All 16 stubs | Activate everything in the file now. Requires implementing validateScheduleTimes, stopScheduler, and integration scenario logic not yet in jobs.ts — significantly more scope. | |
| 7 required + stopScheduler (10 total) | stopScheduler is close to existing behavior — jobs already have start/stop methods. validateScheduleTimes and Integration scenarios stay skipped. | |

**User's choice:** Only the 7 required (Recommended)
**Notes:** Clean scope boundary aligned with REQUIREMENTS.md TEST-10 and TEST-11.

---

## Implementation additions — Cron validation

| Option | Description | Selected |
|--------|-------------|----------|
| Throw an Error | Add cron.validate() guard at the top of schedulePriceCollection. If any expression is invalid, throw new Error. Clear failure mode, easy to test. | ✓ |
| Log + skip invalid jobs | Log a warning and skip creating the job for that time slot. Softer failure, collection continues with remaining schedules. | |
| You decide | Planner picks the approach — either throw or skip, whichever makes the test cleanest | |

**User's choice:** Throw an Error (Recommended)
**Notes:** Fail-fast is the right behavior — an invalid cron expression means the scheduler was misconfigured and should not silently start with incomplete scheduling.

---

## Implementation additions — Duration tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Log it + add durationMs to return value | Compute Date.now() before/after, log duration, and add durationMs to the returned stats object. Test can assert on both logger and return value. | ✓ |
| Log it only | Compute and log duration but keep the return type unchanged { total, fetched, skipped, failed }. | |
| You decide | Planner picks the most natural approach given the existing return type pattern | |

**User's choice:** Log it + add durationMs to return value (Recommended)
**Notes:** Adding to return type makes it easier to test and useful for callers monitoring collection health.

---

## Claude's Discretion

- Exact duration logging format (separate line vs inline with existing "complete" log)
- Whether `durationMs` on the "already running" early return is `0` or actual elapsed

## Deferred Ideas

None — discussion stayed within phase scope.
