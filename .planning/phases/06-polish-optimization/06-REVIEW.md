---
phase: 06
reviewed: 2026-05-09T13:03:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/retry.ts
  - src/lib/__tests__/retry.test.ts
  - src/scraper/circuit-breaker.ts
  - src/scraper/__tests__/circuit-breaker.test.ts
  - src/scraper/orchestrator.ts
  - src/scraper/__tests__/orchestrator.test.ts
  - .env.example
status: issues_found
findings_count: 5
blocking: 0
high: 1
medium: 2
low: 1
info: 1
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-09T13:03:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found — no blocking issues, 1 high, 2 medium, 1 low, 1 info

## Summary

Phase 6 adds three reliability features: `withRetry` exponential-backoff helper, a Telegram health-alert hook on circuit-breaker open events, and a p-limit concurrent orchestrator with `composeReliable` composition. The implementation is structurally correct: D-06 composition ordering (raw → withRetry → wrapWithCircuitBreaker) is verified both at the code level and by the source-text ordering test. The `withRetry` logic is sound — backoff math is correct, error wrapping is correct, and all 8 unit tests pass. The circuit-breaker Telegram alert is properly protected by a try/catch so alert failures cannot crash the circuit pipeline.

Four issues were found across the test files. None is blocking for production, but one is high-severity because it creates cross-test environment pollution that can produce silent false passes in CI environments where `TELEGRAM_CHAT_ID` is not pre-set. Two medium findings cover an incomplete env-var guard and a progress-log semantics mismatch introduced by the p-limit change.

---

## Critical Issues

No critical issues found.

---

## High

### HI-01: `process.env = undefined` pollutes environment across test files

**Files:**
- `src/lib/__tests__/retry.test.ts:17`, `retry.test.ts:22`, `retry.test.ts:93`
- `src/scraper/__tests__/circuit-breaker.test.ts:201`

**Issue:** In Node.js, assigning `undefined` to a `process.env` key does not delete or unset it — it coerces `undefined` to the string `"undefined"`. This happens in three places:

1. `retry.test.ts` `afterEach` (lines 17, 22): if `SCRAPER_RETRY_ATTEMPTS` or `SCRAPER_RETRY_BASE_DELAY_MS` were not set before the test suite ran, the teardown permanently sets them to the string `"undefined"` for all subsequent test files.
2. `retry.test.ts:93`: the test named "defaults maxAttempts to 3 when SCRAPER_RETRY_ATTEMPTS is unset" sets `process.env.SCRAPER_RETRY_ATTEMPTS = undefined`, which stores `"undefined"` — the var is not actually unset. The test still passes only because `Number("undefined")` is `NaN` and `NaN || 3 === 3`. The assertion is correct but the setup is wrong.
3. `circuit-breaker.test.ts:201`: `afterEach` restores via `process.env.TELEGRAM_CHAT_ID = originalChatId`. When `TELEGRAM_CHAT_ID` was absent from the environment before the test run, `originalChatId` is `undefined` and the restore sets the var to the string `"undefined"`. The circuit-breaker guard at `circuit-breaker.ts:79` checks `if (!chatId)` — the string `"undefined"` is truthy, so subsequent test files that expect the guard to prevent alert delivery would behave unexpectedly.

**Fix:** Use `delete process.env.VAR` to unset, and use `??` (not `||`) in teardown to distinguish "was set to empty string" from "was not set":

```typescript
// retry.test.ts afterEach — correct restore pattern
afterEach(() => {
  if (originalAttempts === undefined) {
    delete process.env.SCRAPER_RETRY_ATTEMPTS
  } else {
    process.env.SCRAPER_RETRY_ATTEMPTS = originalAttempts
  }
  if (originalBaseDelay === undefined) {
    delete process.env.SCRAPER_RETRY_BASE_DELAY_MS
  } else {
    process.env.SCRAPER_RETRY_BASE_DELAY_MS = originalBaseDelay
  }
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// retry.test.ts:93 — correct way to simulate unset var
test('defaults maxAttempts to 3 when SCRAPER_RETRY_ATTEMPTS is unset', async () => {
  delete process.env.SCRAPER_RETRY_ATTEMPTS   // <-- delete, not assign undefined
  // ...
})
```

Apply the same `delete` pattern to `circuit-breaker.test.ts:201`:
```typescript
afterEach(() => {
  if (originalChatId === undefined) {
    delete process.env.TELEGRAM_CHAT_ID
  } else {
    process.env.TELEGRAM_CHAT_ID = originalChatId
  }
})
```

---

## Medium

### ME-01: Circuit-breaker Telegram guard checks only `TELEGRAM_CHAT_ID`, not `TELEGRAM_BOT_TOKEN`

**File:** `src/scraper/circuit-breaker.ts:78-96`

**Issue:** The early-return guard at line 79 (`if (!chatId) { return }`) protects against missing `TELEGRAM_CHAT_ID` but not against missing `TELEGRAM_BOT_TOKEN`. `src/lib/telegram.ts` throws `Error: TELEGRAM_BOT_TOKEN environment variable is not set` at module initialization. When `TELEGRAM_CHAT_ID` is set but `TELEGRAM_BOT_TOKEN` is absent, the dynamic import at line 86 will fail every time a circuit opens, producing a caught-and-logged error (`Failed to send circuit-breaker health alert`) on every open event. The circuit pipeline is not affected, but the error log is misleading — it looks like a transient Telegram API failure rather than a configuration gap.

**Fix:** Add `TELEGRAM_BOT_TOKEN` to the guard so both absent-config cases produce the same clean no-op:

```typescript
// circuit-breaker.ts — updated guard (lines 78-82)
const chatId = process.env.TELEGRAM_CHAT_ID
const botToken = process.env.TELEGRAM_BOT_TOKEN
if (!chatId || !botToken) {
  // Graceful no-op when Telegram is not configured.
  return
}
```

---

### ME-02: Progress log index `i` is submission order, not completion order under p-limit

**File:** `src/scraper/orchestrator.ts:247-248`

**Issue:** The `.map((oracleId, i) => limit(async () => { ... }))` on lines 239-257 passes the submission index `i` into the p-limit task closure. Under p-limit with concurrency > 1, tasks complete out of submission order. The progress log `Progress: ${i + 1}/${oracleIds.length} cards processed` fires when task `i` completes, not when the `(i+1)`th card has been processed. For a batch of 30 with concurrency 5, the log could print "Progress: 10/30 cards processed" before tasks 1–9 are complete. This can produce confusing out-of-order progress reports (e.g., "20/30 processed" appearing before "10/30 processed").

**Fix:** Use a shared counter incremented on completion instead of the submission index:

```typescript
// orchestrator.ts — replace the i-based counter with an atomic completion counter
let completedCount = 0

const tasks = oracleIds.map((oracleId) =>
  limit(async () => {
    try {
      const results = await fetchCardPriceFromAllSources(oracleId)
      const successCount = Object.values(results).filter((r) => r.success).length
      const skipCount = Object.values(results).filter((r) => r.error?.includes('Skipped')).length
      stats.fetched += successCount
      stats.skipped += skipCount
      completedCount++
      if (completedCount % 10 === 0) {
        logger.info(`Progress: ${completedCount}/${oracleIds.length} cards processed`)
      }
    } catch (error) {
      completedCount++
      stats.failed += 1
      const errorMsg = error instanceof Error ? error.message : String(error)
      stats.errors.push(`${oracleId}: ${errorMsg}`)
      logger.error(`Failed to fetch prices for ${oracleId}: ${errorMsg}`)
    }
  }),
)
```

Note: `completedCount++` is safe without a lock because Node.js is single-threaded — `++` executes between `await` points.

---

## Low

### LO-01: `Number(env) || fallback` silently ignores `0` — cannot disable retry or set zero concurrency via env

**Files:**
- `src/lib/retry.ts:23-24`
- `src/scraper/orchestrator.ts:34`

**Issue:** All three env-var reads use the `Number(env) || fallback` pattern:

```typescript
const envAttempts = Number(process.env.SCRAPER_RETRY_ATTEMPTS) || 3      // retry.ts:23
const envBaseDelay = Number(process.env.SCRAPER_RETRY_BASE_DELAY_MS) || 1000  // retry.ts:24
const CONCURRENCY_PER_SOURCE = Number(process.env.SCRAPER_CONCURRENCY_PER_SOURCE) || 5  // orchestrator.ts:34
```

Because `0` is falsy in JavaScript, `Number('0') || 3` evaluates to `3`. Setting `SCRAPER_RETRY_ATTEMPTS=0` or `SCRAPER_CONCURRENCY_PER_SOURCE=0` does not disable or zero-out the feature — it silently falls back to the default. For concurrency this is actually safe (pLimit(0) would throw), but for retry it means "disable retries" is not expressible via env config. The `.env.example` documents these vars without noting this limitation.

**Fix:** Use a guarded parse that only falls back when the result is `NaN`:

```typescript
// retry.ts
const envAttempts = Number.isNaN(Number(process.env.SCRAPER_RETRY_ATTEMPTS))
  ? 3
  : Number(process.env.SCRAPER_RETRY_ATTEMPTS)

// orchestrator.ts — also guard against 0 for pLimit safety
const parsed = Number(process.env.SCRAPER_CONCURRENCY_PER_SOURCE)
const CONCURRENCY_PER_SOURCE = Number.isNaN(parsed) || parsed < 1 ? 5 : parsed
```

Alternatively, add a note to `.env.example` that `0` is not a valid value for these vars.

---

## Info

### IN-01: D-06 ordering test uses source-text position check — fragile against refactor

**File:** `src/scraper/__tests__/orchestrator.test.ts:85-98`

**Issue:** The D-06 constraint test verifies that `withRetry` is called before `wrapWithCircuitBreaker` by comparing `indexOf` positions in the raw source text. This passes today, but will silently break if `composeReliable` is renamed, split across files, or if a comment above `wrapWithCircuitBreaker` happens to contain the string `"withRetry"`. The test checks the file-wide first occurrence of each string after `composeReliable`, not their runtime call relationship.

**Fix:** For correctness verification, consider a runtime approach: pass a spy as `rawFetch` to `composeReliable` and verify that the spy is called (meaning withRetry's inner fn executed) even when wrapWithCircuitBreaker's circuit is closed. The current text-scanning approach is better than nothing, but note in the test comment that it is a static-analysis approximation:

```typescript
test('composes raw fetch through withRetry BEFORE wrapWithCircuitBreaker (D-06 order)', async () => {
  // NOTE: This is a static-analysis proxy. It verifies text position in the source,
  // not runtime call order. A runtime test would wire spies through composeReliable.
  // ...existing assertions...
})
```

---

## Verified Correct

The following areas were explicitly reviewed and found correct:

- **`withRetry` backoff math** (`retry.ts:36`): `baseDelay * 2 ** (attempt - 1)` produces 1×, 2×, 4× sequence. Correct for attempts 1, 2, 3.
- **`withRetry` error wrapping** (`retry.ts:34`): non-Error throws are wrapped via `new Error(String(error))`. Correct.
- **`withRetry` last-attempt optimization** (`retry.ts:35-38`): `await sleep` is skipped on the final attempt (`if (attempt < attempts)`). No unnecessary delay on exhaustion.
- **D-06 composition order** (`orchestrator.ts:56-57`): `retried = withRetry(rawFetch)` then `breakered = wrapWithCircuitBreaker(retried)`. Correct ordering confirmed.
- **Telegram alert error isolation** (`circuit-breaker.ts:84-95`): The `try/catch` fully wraps the dynamic import and `sendMessage` call. Alert failures cannot propagate to the circuit breaker pipeline.
- **`composeReliable` return type** (`orchestrator.ts:58`): `.then((v) => v ?? null)` is a no-op (v is already `number | null`) but harmless — the type is correct.
- **Concurrency stats thread safety** (`orchestrator.ts:245-246`): `stats.fetched +=` and `stats.skipped +=` are safe between `await` points in Node.js's single-threaded event loop.
- **`.env.example` Phase 6 section**: All three new env vars (`SCRAPER_CONCURRENCY_PER_SOURCE`, `SCRAPER_RETRY_ATTEMPTS`, `SCRAPER_RETRY_BASE_DELAY_MS`) are documented with correct defaults and description.

---

_Reviewed: 2026-05-09T13:03:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
