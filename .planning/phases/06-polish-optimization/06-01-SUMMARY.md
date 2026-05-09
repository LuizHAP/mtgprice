---
phase: 06-polish-optimization
plan: "01"
subsystem: infra
tags: [retry, exponential-backoff, vitest, tdd, reliability]

requires:
  - phase: 02-core-data-collection
    provides: circuit-breaker and scraper orchestrator that withRetry will wrap

provides:
  - "withRetry<T>(fn, maxAttempts?, baseDelayMs?) exported from src/lib/retry.ts"
  - "Exponential backoff retry helper: baseDelayMs * 2^(attempt-1) between retries"
  - "SCRAPER_RETRY_ATTEMPTS and SCRAPER_RETRY_BASE_DELAY_MS env-var tunables"
  - "8 Vitest unit tests covering all behaviors in src/lib/__tests__/retry.test.ts"

affects:
  - 06-02 (concurrency plan will import withRetry and wire it into orchestrator)

tech-stack:
  added: []
  patterns:
    - "Retry-before-circuit-breaker: withRetry wraps the raw fn BEFORE wrapWithCircuitBreaker"
    - "Env-var tunables: SCRAPER_RETRY_ATTEMPTS and SCRAPER_RETRY_BASE_DELAY_MS for runtime config"
    - "setTimeout spy for backoff timing tests: avoids Vitest 3.x fake-timer/async-rejection conflict"

key-files:
  created:
    - src/lib/retry.ts
    - src/lib/__tests__/retry.test.ts
  modified: []

key-decisions:
  - "Used setTimeout spy (vi.spyOn) instead of vi.useFakeTimers() for the backoff timing test to avoid Vitest 3.x unhandled rejection false positives with fake timers + async mock functions"
  - "Used mockRejectedValueOnce (chained) instead of mockImplementation with async throw for non-timing tests — cleaner and avoids async unhandled rejection warnings in Vitest 3.x"

patterns-established:
  - "Retry pattern: withRetry(fn, maxAttempts, baseDelayMs) wraps any async fn — compose with circuit breaker as: withRetry(() => wrapWithCircuitBreaker(fetch, ...))"

requirements-completed: []

duration: 15min
completed: "2026-05-09"
---

# Phase 6 Plan 01: withRetry Helper Summary

**Standalone exponential-backoff retry helper: withRetry<T>(fn, maxAttempts?, baseDelayMs?) with env-var defaults and 8/8 Vitest unit tests green**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-09T15:16:24Z
- **Completed:** 2026-05-09T15:31:28Z
- **Tasks:** 2/2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Pure TypeScript `withRetry<T>` helper in `src/lib/retry.ts` with no external dependencies
- Exponential backoff formula: `baseDelayMs * 2^(attempt-1)` (1s, 2s, 4s... with defaults)
- Env-var tunables: `SCRAPER_RETRY_ATTEMPTS` (default 3) and `SCRAPER_RETRY_BASE_DELAY_MS` (default 1000ms)
- Non-Error throws wrapped into `Error` via `String(error)` for consistent error handling
- 8/8 unit tests passing with zero unhandled rejection warnings in Vitest 3.x

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing unit tests for withRetry (RED)** - `d6c3346` (test)
2. **Task 2: Implement withRetry to make tests pass (GREEN)** - `37c7e74` (feat)

## Files Created/Modified

- `src/lib/retry.ts` — `withRetry<T>` implementation: loop over attempts, exponential backoff via `setTimeout`, wraps non-Error throws
- `src/lib/__tests__/retry.test.ts` — 8 unit tests: success path, retry-then-success, exhaustion, backoff timing (setTimeout spy), env-var defaults, non-Error wrapping

## Decisions Made

**setTimeout spy for backoff timing test:** Vitest 3.x with `vi.useFakeTimers()` treats async function rejections inside mock implementations as unhandled rejections (reported as errors even when caught). Using `vi.spyOn(globalThis, 'setTimeout')` with real execution (delay overridden to 0) captures the delay values passed to `setTimeout` without triggering the fake-timer/microtask timing conflict.

**mockRejectedValueOnce chains for non-timing tests:** Instead of `mockImplementation(async () => { throw })`, using chained `mockRejectedValueOnce` avoids async unhandled rejection warnings in Vitest 3.x for tests that don't need timing assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `??` + `||` operator combination causing esbuild parse error**
- **Found during:** Task 2 (implementing withRetry)
- **Issue:** Reference implementation from plan used `maxAttempts ?? Number(env) || 3` which esbuild rejects as "Cannot use || with ?? without parentheses"
- **Fix:** Split into two statements: `const envAttempts = Number(env) || 3; const attempts = maxAttempts ?? envAttempts`
- **Files modified:** `src/lib/retry.ts`
- **Verification:** TypeScript compiles cleanly, tests pass
- **Committed in:** `37c7e74` (Task 2 commit)

**2. [Rule 1 - Bug] Resolved Vitest 3.x unhandled rejection warnings from fake timer + async mock interaction**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** `vi.useFakeTimers()` combined with `async () => { throw }` or `mockImplementation(() => Promise.reject())` caused Vitest 3.x to report unhandled rejections even when `withRetry` caught them — exit code 1 despite all 8 tests passing
- **Fix:** Replaced fake timers with `vi.spyOn(globalThis, 'setTimeout')` for the timing test; used `mockRejectedValueOnce` chains for all other tests
- **Files modified:** `src/lib/__tests__/retry.test.ts`
- **Verification:** `pnpm test:run` exits 0 with 0 errors, all 8 tests passing
- **Committed in:** `37c7e74` (Task 2 commit, Biome auto-formatted)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes necessary for build success and clean test output. Behavioral contract unchanged — all 8 tests from the plan specification pass.

## Issues Encountered

- Biome pre-commit hook blocked first commit due to `delete process.env.X` — Biome's `noDelete` lint rule requires `process.env.X = undefined` instead. Fixed before commit.
- Biome formatting required single-line chaining for short mock chains — auto-applied via `biome check --write`.

## Known Stubs

None — `withRetry` is a complete, wired implementation with no placeholder data.

## Next Phase Readiness

- `withRetry` is ready to be imported by `src/scraper/orchestrator.ts` (Plan 06-02)
- Consumption pattern: `withRetry(() => fetchFromSource(card), maxAttempts, baseDelayMs)` — wrap the raw fetch fn BEFORE passing to `wrapWithCircuitBreaker`
- Env vars `SCRAPER_RETRY_ATTEMPTS` and `SCRAPER_RETRY_BASE_DELAY_MS` should be documented in `.env.example` (Plan 06-02 can do this when wiring)

---
*Phase: 06-polish-optimization*
*Completed: 2026-05-09*
