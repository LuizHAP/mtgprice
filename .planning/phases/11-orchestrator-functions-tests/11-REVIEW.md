---
phase: 11-orchestrator-functions-tests
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/scraper/__tests__/orchestrator.test.ts
  - src/scraper/orchestrator.ts
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

`orchestrator.ts` implements a multi-source price-fetching orchestrator for four providers (Liga Magic, TCGPlayer, CardMarket, CardKingdom), with retry/circuit-breaker composition, smart-refresh filtering, concurrency capping via p-limit, currency conversion, and DB insertion. Three exported helpers (`handleSourceFailure`, `applyRateLimiting`, `aggregateResults`) were added as unit-testable surfaces.

`orchestrator.test.ts` provides test coverage across five `describe` blocks. The test suite has structural issues: it mixes top-level `vi.mock` (hoisted) with `vi.doMock` (dynamic, inside tests), the dynamic mocks are never applied to the top-level module boundary that was already loaded via static import, several exported helpers are tested in isolation but are never called by the production code that contains duplicate inline logic, and the `stats.failed` accounting is wrong.

Three critical defects were found: `handleSourceFailure` and `applyRateLimiting` are dead exports that duplicate logic already present inline in `fetchCardPriceFromAllSources` — the inline logic does not call them, so fixes to these helpers have no production effect; `stats.failed` undercounts by never incrementing when a source returns `{ success: false }` (only unhandled throws hit the outer catch); and a `priceBrl.toFixed(2)` call at line 165 will crash at runtime if `convertToBRL` throws and the exception is caught higher up but `priceBrl` is read before the assignment completes (this path is inside a try-block and is safe in isolation, but the log line is inside the try after the await — see below for the real risk vector).

---

## Critical Issues

### CR-01: `handleSourceFailure` and `applyRateLimiting` are dead code — production errors use inline logic instead

**File:** `src/scraper/orchestrator.ts:321-355` / `src/scraper/__tests__/orchestrator.test.ts:262-327`

**Issue:** Both `handleSourceFailure` and `applyRateLimiting` are exported, tested extensively, but never called by any production path in this file or anywhere else in the codebase. `fetchCardPriceFromAllSources` contains its own inline `catch` blocks (lines 134-138, 173-177) that duplicate `handleSourceFailure`'s logic. `applyRateLimiting` is referenced in no caller at all — rate limiting is never applied before any fetch call. The tests for these two functions verify correct behaviour of isolated helpers that are completely decoupled from the real execution path. Any bug fix applied to `handleSourceFailure` or `applyRateLimiting` will have zero effect on the system.

**Fix:** Either:
1. Call `handleSourceFailure` from inside the catch blocks in `fetchCardPriceFromAllSources`, replacing the inline duplication:
```typescript
// Line 134-138 becomes:
} catch (error) {
  results[ligaMagicKey] = handleSourceFailure(ligaMagicKey, oracleId, error)
}
// Line 173-177 becomes:
} catch (error) {
  return { key, result: handleSourceFailure(key, oracleId, error) }
}
```
2. Call `applyRateLimiting` before each source fetch inside `fetchCardPriceFromAllSources`, or wire it into `composeReliable`. Without callers, the rate limit enforcement the tests are validating simply does not exist in production.

---

### CR-02: `stats.failed` always stays 0 for per-source failures — only unhandled top-level throws increment it

**File:** `src/scraper/orchestrator.ts:244-254`

**Issue:** The `stats.failed` counter is incremented only inside the outer `catch` block (line 252), which fires only if `fetchCardPriceFromAllSources` itself throws. But `fetchCardPriceFromAllSources` catches all per-source errors internally and returns normally with `{ success: false, error: ... }` entries. The outer try/catch will almost never fire. Meanwhile, the `stats.fetched` and `stats.skipped` accumulators (lines 244-247) correctly walk the returned results, but there is no matching line for failed sources: sources that returned `success: false` without a 'Skipped' error string are simply not counted anywhere. The three counters `fetched + skipped + failed` will not sum to `total * 4` (where 4 = number of sources).

```typescript
// Current code — failed sources silently disappear from stats:
const successCount = Object.values(results).filter((r) => r.success).length
const skipCount = Object.values(results).filter((r) => r.error?.includes('Skipped')).length
stats.fetched += successCount
stats.skipped += skipCount
// Nothing increments stats.failed for per-source error results
```

**Fix:**
```typescript
const successCount = Object.values(results).filter((r) => r.success).length
const skipCount = Object.values(results).filter(
  (r) => !r.success && r.error?.includes('Skipped'),
).length
const failCount = Object.values(results).filter(
  (r) => !r.success && !r.error?.includes('Skipped'),
).length
stats.fetched += successCount
stats.skipped += skipCount
stats.failed += failCount
```

---

### CR-03: Tests for `orchestrateFetch` / `batchOrchestrateFetch` use `vi.doMock` after the module is already statically imported — mocks are never applied to the module under test

**File:** `src/scraper/__tests__/orchestrator.test.ts:3`, `131-157`, `161-192` (and all similar blocks)

**Issue:** Line 3 statically imports `handleSourceFailure`, `applyRateLimiting`, and `aggregateResults` from `@/scraper/orchestrator`. When Vitest processes this file, the module is loaded at file-evaluation time before any test body runs. The `vi.doMock` calls inside test bodies that are later followed by `const { orchestrateFetch } = await import('@/scraper/orchestrator')` work correctly for the re-imported instance, but the ALL_SOURCES array and the `composeReliable` calls (which call `wrapWithCircuitBreaker` and `withRetry`) run at module-load time as side effects of the top-level constant declaration. Since `@/lib/retry` and `@/scraper/circuit-breaker` are never mocked anywhere in the test file, `composeReliable` runs with the real `withRetry` (3 attempts, real exponential backoff) and the real `wrapWithCircuitBreaker` (real Opossum circuit breaker instances). This means:

- Every mocked provider call is wrapped in a real circuit breaker. A test that asserts `results.tcgplayer.success === false` after a single rejection actually exercises the real Opossum breaker, which may not open after a single failure (threshold is 50%).
- The `wrapWithCircuitBreaker` fallback returns `null`, which is then coerced to `null` by `composeReliable`. The test for "complete Liga Magic failure" (line 228) depends on catching an error, but a circuit-breaker-wrapped rejection returns `null` (not a throw) once the breaker fires the fallback — this can cause the test to pass for the wrong reason.
- Real retry waits (`SCRAPER_RETRY_BASE_DELAY_MS` default 1000ms × attempts) could massively inflate test time unless the env var is set.

**Fix:** Add top-level mocks for both `@/lib/retry` and `@/scraper/circuit-breaker` alongside the existing logger and rate-limiter mocks, so that the module-load-time `composeReliable` executes with controlled test doubles:

```typescript
vi.mock('@/lib/retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

vi.mock('@/scraper/circuit-breaker', () => ({
  wrapWithCircuitBreaker: vi.fn(
    (fn: (arg: unknown) => Promise<unknown>) =>
      (arg: unknown) =>
        fn(arg),
  ),
}))
```

---

## Warnings

### WR-01: `stats.skipped` double-counts skipped sources — `success: false` with 'Skipped' also feeds `stats.fetched`'s denominator incorrectly

**File:** `src/scraper/orchestrator.ts:244-247`

**Issue:** The `successCount` filter checks `r.success`, and the `skipCount` filter checks `r.error?.includes('Skipped')`. When a source is skipped, `success` is `false`, so it is correctly excluded from `successCount`. However, the docstring for `FetchAllPricesStats` and the completion log (line 263) implies `fetched + skipped + failed` should approximate `total`. Because per-source failures are not counted (see CR-02), this invariant is broken. Additionally, a skipped result has `success: false`, so it will now fall through to the gap identified in CR-02 and inflate `failed` if CR-02 is fixed naively. The fix in CR-02 explicitly guards for this — but it needs to match the string check exactly.

**Fix:** When applying the CR-02 fix, use the same `'Skipped'` string guard to keep the three buckets mutually exclusive.

---

### WR-02: `composeReliable` discards the circuit breaker fallback value via `?? null` — silently hides open-circuit events as null prices

**File:** `src/scraper/orchestrator.ts:59`

**Issue:** `wrapWithCircuitBreaker` is typed to return `Promise<R | null>`, and its fallback explicitly returns `null`. The `composeReliable` wrapper does `.then((v) => v ?? null)`, which is a no-op coercion that adds no safety. More importantly, when the circuit breaker is OPEN and the fallback fires, the fetch silently returns `null` with no additional logging at the orchestrator level. The per-source catch blocks check `if (price !== null)` and fall to the `'Price not found'` warning — so an open-circuit event is logged as `✗ tcgplayer: oracle-id - Price not found` instead of a circuit-breaker event. Operators cannot distinguish a genuine "card not found" from a source being circuit-breaker-tripped.

**Fix:** Propagate open-circuit as a distinct error (or check the breaker state separately), or at minimum change the fallback in `wrapWithCircuitBreaker` to throw a recognisable error so the calling code can produce a distinct log message. Alternatively, pass a sentinel value from the fallback that the orchestrator can distinguish from a genuine null:

```typescript
// In circuit-breaker.ts fallback:
breaker.fallback(() => {
  throw new Error(`CIRCUIT_OPEN:${sourceName}`)
})
```

---

### WR-03: `handleSourceFailure` test "should track failure count per source" (line 284) calls the function in a `beforeEach`-less context — stale logger mock calls from prior tests may corrupt the count

**File:** `src/scraper/__tests__/orchestrator.test.ts:284-292`

**Issue:** The `handleSourceFailure` describe block has a `beforeEach(() => vi.clearAllMocks())` at line 263. The test at line 284 makes two calls and then asserts `toHaveBeenCalledTimes(2)`. This is correct in isolation. However, the test at line 277 calls `handleSourceFailure` twice (once in the `expect(() => ...)` wrapper at line 278 and once at line 279). If Vitest runs these tests in order, the `clearAllMocks()` in `beforeEach` fires between them, so this is fine. But the test title "should track failure count per source" tests logger call count, not an actual counter inside the function. This is misleading: the function has no counter (the comment on line 318 explicitly says it does not). The test assertion on call count is an artefact of the logger mock, not a property of `handleSourceFailure`.

**Fix:** Rename the test to "should log once per call" to accurately describe what is being asserted, avoiding the implication that an internal counter exists.

---

### WR-04: D-06 ordering test (line 108) is a fragile text-position check on source code, not a behavioral guarantee

**File:** `src/scraper/__tests__/orchestrator.test.ts:108-121`

**Issue:** The test uses `src.indexOf('withRetry', composeIdx)` and `src.indexOf('wrapWithCircuitBreaker', composeIdx)` to assert D-06 composition order. `indexOf` finds the first occurrence of each string after the `composeReliable` position. If `wrapWithCircuitBreaker` appears in a comment or import before `withRetry` is textually referenced, or if the function is refactored (e.g., helper extracted, renamed), the test breaks without any change in behaviour. More critically, this test does NOT verify the runtime composition: it cannot catch a bug where both calls are present but the circuit breaker wraps the raw fetch directly instead of the retried version.

**Fix:** Replace the text-scan with a behavioral test that verifies the circuit breaker only sees failures after all retries are exhausted (i.e., mock `withRetry` to always throw on first attempt but succeed on retry, and assert the circuit breaker's failure count is zero). As a minimal improvement, at least assert on the call-graph structure using properly mocked modules rather than string positions.

---

## Info

### IN-01: `priceBrl` logged via `.toFixed(2)` immediately after `await convertToBRL` — if `convertToBRL` throws, the log line is unreachable but the variable is in scope

**File:** `src/scraper/orchestrator.ts:161-165`

**Issue:** `priceBrl` is assigned on line 161 and `.toFixed(2)` is called on line 165. If `convertToBRL` throws, the entire async lambda throws and is caught by the outer Promise.allSettled. The `.toFixed(2)` call is never reached in that case, so there is no crash. However, `priceBrl` is typed as `number` at this point (since `source.currency === 'BRL'` is already narrowed). This is safe, but the `priceBrl.toFixed(2)` at line 165 is placed inside the `try` block after the `await`, meaning it shares try-scope with the conversion. This is acceptable but worth documenting.

**Note:** This is not a bug, just worth awareness during future maintenance.

---

### IN-02: `batchOrchestrateFetch` progress test (line 471) checks `allInfoCalls.toLowerCase()` for the substring `'price collection'` — this passes trivially due to `fetchAllPrices`'s hardcoded start/end log messages

**File:** `src/scraper/__tests__/orchestrator.test.ts:471-501`

**Issue:** The test uses a batch of only 3 cards (`['a', 'b', 'c']`), so the `(i + 1) % 10 === 0` progress log (line 248 in orchestrator.ts) never fires. The assertion passes solely because `fetchAllPrices` logs "Starting price collection..." and "Price collection complete:..." unconditionally. The test name says "progress updates for large batches" but it does not exercise the per-10-card progress log at all.

**Fix:** Use a batch of at least 10 cards to exercise the `% 10` path, or assert on the specific progress log message format.

---

### IN-03: Extensive copy-paste of `vi.doMock` blocks across 10+ test cases — no shared setup helper

**File:** `src/scraper/__tests__/orchestrator.test.ts:55-89`, `131-157`, `161-192`, `196-226`, `229-258`, and more

**Issue:** Every test that exercises `orchestrateFetch` or `batchOrchestrateFetch` repeats the same 7-module `vi.doMock` block followed by `vi.resetModules()`. This is approximately 20 lines repeated 10 times (~200 lines of duplication). When a new dependency is added to the orchestrator, all 10 blocks need updating.

**Fix:** Extract a shared `setupOrchestratorMocks(overrides?)` helper:
```typescript
async function setupOrchestratorMocks(overrides: Record<string, unknown> = {}) {
  vi.resetModules()
  vi.doMock('@/scraper/smart-refresh', () => ({
    shouldFetchPrice: vi.fn().mockResolvedValue(true),
    ...overrides['smart-refresh'],
  }))
  // ... etc
  return import('@/scraper/orchestrator')
}
```

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
