---
phase: 08-circuit-breaker-tests
reviewed: 2026-05-10T13:57:08Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/scraper/__tests__/circuit-breaker.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-05-10T13:57:08Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `src/scraper/__tests__/circuit-breaker.test.ts` against `src/scraper/circuit-breaker.ts` (the unit under test). The test suite is well-structured with clear groupings for state transitions, fallbacks, events, per-source isolation, and integration scenarios. Two issues reduce test reliability and correctness:

1. A vacuous assertion in the Telegram error-propagation test makes the test meaningless — it can never fail regardless of the implementation.
2. `process.env` mutation in `afterEach` silently coerces `undefined` to the string `"undefined"`, which can pollute the environment for later test files in the same run.

Three info-level items cover misleading comments, minor assertion gaps, and real-timer fragility.

## Warnings

### WR-01: Vacuous assertion — `.catch(() => null)` voids the `not.toThrow()` check

**File:** `src/scraper/__tests__/circuit-breaker.test.ts:419`
**Issue:** The assertion `await expect(wrapped(...).catch(() => null)).resolves.not.toThrow()` is always vacuously true. The `.catch(() => null)` converts any rejection into a fulfilled `null` before the `expect` wrapper sees the promise. Because the promise can never be rejected at that point, `.resolves.not.toThrow()` can never fail — even if `sendMessage` errors were propagating. The test does not actually verify the stated invariant.
**Fix:**
```typescript
// Assert directly that the wrapped call resolves (does not throw/reject).
// Do NOT pre-catch before the expect — let expect own the assertion.
for (let i = 0; i < 5; i++) {
  await expect(wrapped('any-oracle-id')).resolves.not.toThrow()
}
```
If the implementation correctly swallows the alert error, the call returns `null` (via the fallback) and the assertion will pass. If alert errors accidentally propagate, the promise will reject and the assertion will fail — which is the intended behaviour.

---

### WR-02: `process.env` restore sets `"undefined"` string when original value was absent

**File:** `src/scraper/__tests__/circuit-breaker.test.ts:356-358`
**Issue:** `afterEach` executes `process.env.TELEGRAM_CHAT_ID = originalChatId` where `originalChatId` is typed `string | undefined`. In Node.js, assigning `undefined` to a `process.env` key coerces it to the string `"undefined"` rather than removing the key. If `TELEGRAM_CHAT_ID` was not set in the environment before the test suite ran, every subsequent test file in the same Vitest process will see `process.env.TELEGRAM_CHAT_ID === "undefined"` (truthy), potentially causing unrelated tests or application code to behave incorrectly.
**Fix:**
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

## Info

### IN-01: Misleading `.catch(() => {})` on calls that cannot reject (open-circuit fallback path)

**File:** `src/scraper/__tests__/circuit-breaker.test.ts:219, 288-289`
**Issue:** Inside `wrapWithCircuitBreaker`, the fallback always returns `null` (never throws). After the circuit opens, calls to `ligaMagic` / `liga` will resolve to `null`, not reject. The `.catch(() => {})` on lines 219 and 288-289 is dead code on those subsequent calls. It communicates the wrong expectation to readers who may think these calls can still reject.
**Fix:** No code change required for correctness. Consider adding a comment on the `await liga('oracle-id').catch(() => {})` pattern:
```typescript
// First call opens the circuit (fires action, which rejects; fallback returns null).
await liga('oracle-id').catch(() => {})
// Subsequent calls fast-fail via fallback → null (cannot reject); .catch is safety-only.
await liga('oracle-id').catch(() => {})
```

---

### IN-02: `buildFlakyBreaker` comment claims 5 fires are needed; 1 is sufficient

**File:** `src/scraper/__tests__/circuit-breaker.test.ts:377, 389, 405, 416`
**Issue:** `FAST_CONFIG` and the inline config used by `buildFlakyBreaker` both set `errorThresholdPercentage: 1`, meaning the circuit opens after the very first failure. The comment `// Fire enough requests to trigger the open transition` implies multiple fires are needed, which is misleading and may cause confusion during maintenance.
**Fix:** Either reduce the loop to a single fire, or update the comment to reflect the actual semantic:
```typescript
// errorThresholdPercentage: 1 — circuit opens on the very first failure.
// Remaining iterations exercise the fast-fail path (no action invocation).
for (let i = 0; i < 5; i++) {
  await wrapped('any-oracle-id').catch(() => {})
}
```

---

### IN-03: Real-timer waits for `resetTimeout` are fragile under slow CI

**File:** `src/scraper/__tests__/circuit-breaker.test.ts:52, 67, 81, 184, 305`
**Issue:** Multiple tests use `await new Promise((r) => setTimeout(r, 250))` to wait for `resetTimeout: 200ms` to elapse. This relies on real wall-clock time. Under a heavily loaded CI runner the 50 ms margin can be insufficient, causing intermittent test failures in the `halfOpen` and recovery assertions.
**Fix:** Use Vitest's fake timer API to control time deterministically:
```typescript
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

// Inside test:
await b.fire('x').catch(() => {})
await vi.advanceTimersByTimeAsync(250) // opossum uses setTimeout internally
expect(b.halfOpen).toBe(true)
```
Note: Opossum uses `setTimeout` for its reset timer, so `vi.advanceTimersByTimeAsync` will advance it correctly. Verify opossum's timer usage is compatible with Vitest's fake clock in your environment before switching.

---

_Reviewed: 2026-05-10T13:57:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
