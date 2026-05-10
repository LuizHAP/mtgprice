# Phase 8: Circuit Breaker Tests - Research

**Researched:** 2026-05-10
**Domain:** Opossum circuit breaker testing with Vitest 3.x
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-04 | Tests ativos para state transitions (closed→open→half-open→closed lifecycle) | 5 test stubs in "Circuit state transitions" + 1 in "Integration scenarios"; Opossum `.closed`, `.opened`, `.halfOpen` boolean getters confirmed working |
| TEST-05 | Tests ativos para fallback function (execute fallback, cached data, handle fallback errors) | 3 test stubs in "Fallback function"; Opossum `fallback()` API confirmed; fallback-throws behavior verified via `node` |
| TEST-06 | Tests ativos para event emission (open, close, halfOpen, fallback events) | 4 test stubs in "Event emission"; Opossum EventEmitter `on('open')` etc. verified working |
| TEST-07 | Tests ativos para per-source isolation (breakers independentes, timeouts por source, stats por source) | 3 test stubs in "Per-source circuit breakers" + 2 in "Integration scenarios"; `wrapWithCircuitBreaker` accepts optional config param; `b.stats` API confirmed |
</phase_requirements>

---

## Summary

Phase 8 activates all 18 `test.skip` stubs in `src/scraper/__tests__/circuit-breaker.test.ts`. The stubs span four describe groups (Circuit state transitions, Fallback function, Event emission, Per-source circuit breakers) plus an Integration scenarios group. No new test files are needed.

The production source (`src/scraper/circuit-breaker.ts`) does NOT need to be modified to pass these 18 tests. All behaviors the stubs describe are already present in the implementation. The only source uncertainty is the "cached data" stub, which references "last known good price" but the current fallback returns `null` — the test can be implemented to verify the actual null-returning behavior ("Returns null if no cached data"), which satisfies the stated TODO comment.

The dominant testing pattern is: instantiate `CircuitBreaker` from `opossum` directly (not through `wrapWithCircuitBreaker`) with a fast-failing config (low `errorThresholdPercentage`, short `resetTimeout`), fire enough requests to trigger state transitions, then assert on `b.closed`, `b.opened`, `b.halfOpen`, `b.stats`, and captured events. For per-source isolation tests, use `wrapWithCircuitBreaker` with different config objects.

**Primary recommendation:** Implement all 18 tests by importing `CircuitBreaker` from `opossum` directly; use `resetTimeout: 200` and `errorThresholdPercentage: 1` for deterministic state transitions without fake timers.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| opossum | 9.0.0 [VERIFIED: npm registry, node_modules] | Circuit breaker implementation | Already installed; project uses it in production |
| vitest | 3.2.4 [VERIFIED: node_modules] | Test framework | Project standard; vitest.config.ts already configured |

### No New Dependencies

No packages need to be installed for this phase. All required tools (`opossum`, `vitest`) are already in `node_modules`.

---

## Architecture Patterns

### Recommended Test Structure

The 18 stubs live in one file:

```
src/scraper/__tests__/circuit-breaker.test.ts   ← the ONLY file to edit
```

No new files needed.

### Pattern 1: Direct CircuitBreaker instantiation for state/event/fallback tests

**What:** Import `CircuitBreaker` from `opossum` directly (not through `wrapWithCircuitBreaker`) to access the breaker object's state getters and event emitter.

**When to use:** All state transition, event emission, and fallback tests — any test that needs `b.opened`, `b.closed`, `b.halfOpen`, `b.stats`, or custom fallback registration.

**Example:**
```typescript
// Source: node_modules/opossum/lib/circuit.js verified in session
import CircuitBreaker from 'opossum'

function buildBreaker(action: () => Promise<unknown>) {
  return new CircuitBreaker(action, {
    timeout: 100,
    errorThresholdPercentage: 1,   // trip on first failure
    resetTimeout: 200,              // half-open after 200ms
    rollingCountTimeout: 1000,
    rollingCountBuckets: 1,
  })
}

test('should start in closed state', () => {
  const b = buildBreaker(async () => 'ok')
  expect(b.closed).toBe(true)
  expect(b.opened).toBe(false)
  expect(b.halfOpen).toBe(false)
})
```

### Pattern 2: Open via failures (the canonical approach)

**What:** Fire a failing function enough times to exceed `errorThresholdPercentage`, then assert `b.opened`.

**When to use:** Every test that needs an open circuit.

**Key insight:** With `errorThresholdPercentage: 1` and `rollingCountBuckets: 1`, the FIRST failure opens the circuit. Fire once for failure, then fire again to see the open-state rejection.

```typescript
// Verified: node -e "..." in session
const failFn = vi.fn().mockRejectedValue(new Error('fail'))
const b = new CircuitBreaker(failFn, {
  timeout: 100,
  errorThresholdPercentage: 1,
  resetTimeout: 200,
  rollingCountTimeout: 1000,
  rollingCountBuckets: 1,
})
b.fallback(() => null)

// Fire to trigger failure and open
await b.fire('arg').catch(() => {})
// Circuit is now open; subsequent fires hit fallback
const result = await b.fire('arg')
expect(result).toBeNull()
expect(b.opened).toBe(true)
```

### Pattern 3: Wait for half-open with short resetTimeout

**What:** Use `resetTimeout: 200` (not fake timers) and `await new Promise(r => setTimeout(r, 250))` to wait for the half-open transition.

**Why avoid fake timers:** Phase 7 (07-01-SUMMARY.md) documents that `vi.useFakeTimers()` causes unhandled rejection warnings with async mocks in Vitest 3.x. Short real timeouts are the established project pattern.

```typescript
// Verified sequence (node -e in session):
// 1. Fail to open circuit
await b.fire('arg').catch(() => {})
expect(b.opened).toBe(true)

// 2. Wait for resetTimeout to elapse
await new Promise(r => setTimeout(r, 250))
expect(b.halfOpen).toBe(true)

// 3. Succeed in half-open to close
b.action = async () => 'ok'
await b.fire('arg')
expect(b.closed).toBe(true)
```

### Pattern 4: Event capture with beforeEach listener registration

**What:** Register event listeners before firing, capture events in an array, assert afterward.

```typescript
// Verified event sequence (node -e in session):
// Events fired in order: open, fallback (x4), halfOpen, close
const events: string[] = []
b.on('open', () => events.push('open'))
b.on('close', () => events.push('close'))
b.on('halfOpen', () => events.push('halfOpen'))
b.on('fallback', () => events.push('fallback'))

await b.fire('arg').catch(() => {})  // triggers open + fallback
expect(events).toContain('open')
```

### Pattern 5: Per-source isolation via multiple wrapWithCircuitBreaker calls

**What:** Call `wrapWithCircuitBreaker` with different configs for each source; open one without affecting the other.

**When to use:** All "Per-source circuit breakers" tests and the isolation Integration scenario.

```typescript
// Source: wrapWithCircuitBreaker signature in src/scraper/circuit-breaker.ts
import { wrapWithCircuitBreaker } from '../circuit-breaker'

const ligaMagicBreaker = wrapWithCircuitBreaker(failFn, 'Liga Magic', {
  timeout: 10000,
  errorThresholdPercentage: 1,
  resetTimeout: 60000,
  rollingCountTimeout: 1000,
  rollingCountBuckets: 1,
})
const tcgPlayerBreaker = wrapWithCircuitBreaker(successFn, 'TCGPlayer', {
  timeout: 5000,
  errorThresholdPercentage: 1,
  resetTimeout: 60000,
  rollingCountTimeout: 1000,
  rollingCountBuckets: 1,
})

await ligaMagicBreaker('oracle-id').catch(() => {})
// TCGPlayer breaker is unaffected by Liga Magic failures
const result = await tcgPlayerBreaker('oracle-id')
expect(result).not.toBeNull()
```

### Pattern 6: Stats verification via b.stats

**What:** Access `b.stats` on a `CircuitBreaker` instance to verify per-source tracking.

**Confirmed stats shape (node -e in session):**
```
{ failures, fallbacks, successes, rejects, fires, timeouts,
  cacheHits, cacheMisses, semaphoreRejections, ... }
```

### Anti-Patterns to Avoid

- **Fake timers for opossum reset:** `vi.useFakeTimers()` causes async mock issues in Vitest 3.x (documented in 07-01-SUMMARY.md). Use `resetTimeout: 200` + real `setTimeout(r, 250)`.
- **Testing only through `wrapWithCircuitBreaker`:** The wrapper does not expose the internal `breaker` object. State, stats, and custom fallback registration require using `CircuitBreaker` from `opossum` directly.
- **Non-null assertions:** Biome `noNonNullAssertion` rule forbids `!` assertions. Use `?? 0` or `?? ''` for numeric/string fallbacks (per 07-01-SUMMARY.md).
- **Import order violations:** Biome `organizeImports` sorts `@/` internal imports BEFORE external packages (`opossum`, `vitest`). Always put `@/scraper/circuit-breaker` before `import CircuitBreaker from 'opossum'`.
- **Long `resetTimeout` in transition tests:** Using the default 60s `resetTimeout` makes half-open tests impractical without fake timers. Always use a short value (200ms) in test configs.
- **Using `expect(true).toBe(false)` placeholders:** The stubs contain this; replace entirely with real assertions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine timing | Custom timer-aware state mock | `resetTimeout: 200` + real wait | Opossum's reset is a real `setTimeout`; short config is safer than timer mocking |
| Event capture | Custom EventEmitter wrapper | `breaker.on('open', handler)` | Opossum extends Node.js EventEmitter; standard `.on()` works |
| Failure simulation | Complex mock infrastructure | `vi.fn().mockRejectedValue(new Error())` | Vitest's built-in mock rejection is sufficient |
| Stats per source | Manual counters | `b.stats.failures`, `b.stats.rejects` | Opossum tracks all stats automatically in rolling window |

---

## The 18 Tests: Detailed Implementation Map

### Group 1: Circuit state transitions (TEST-04) — 5 tests

| Test | Approach | Key Assertion |
|------|----------|---------------|
| should start in closed state | `new CircuitBreaker(fn, config)` | `b.closed === true`, `b.opened === false` |
| should open circuit when 50% of requests fail | Fire 1 failure with `errorThresholdPercentage: 1` | `b.opened === true` after first failure |
| should remain open for resetTimeout duration | Open circuit, assert still open BEFORE resetTimeout elapses | `b.opened === true` at T+50ms with `resetTimeout: 200` |
| should transition to half-open after resetTimeout | Wait 250ms with `resetTimeout: 200` | `b.halfOpen === true` |
| should close circuit when service recovers | Succeed in half-open state | `b.closed === true` |

### Group 2: Fallback function (TEST-05) — 3 tests

| Test | Approach | Key Assertion |
|------|----------|---------------|
| should execute fallback when circuit is open | Fire after open; `b.fallback(() => 'fb-result')` | `result === 'fb-result'` |
| should return cached data from fallback | Test actual null behavior — current impl returns null [ASSUMED: interpreting TODO as null case] | `result === null` (no cache in current source) |
| should handle fallback errors gracefully | `b.fallback(() => { throw new Error('fb-err') })` | `fire()` rejects with 'fb-err' |

**Note on "cached data" test:** The TODO comments mention "last known good price" but the current `wrapWithCircuitBreaker` fallback always returns `null`. The "Returns null if no cached data" bullet in the TODO confirms testing the null case is acceptable. This test does NOT require source changes. [ASSUMED]

### Group 3: Event emission (TEST-06) — 4 tests

| Test | Approach | Key Assertion |
|------|----------|---------------|
| should emit "open" event when circuit opens | `b.on('open', ...)` then fire failures | event captured |
| should emit "close" event when circuit closes | Full lifecycle + `b.on('close', ...)` | event captured after recovery |
| should emit "halfOpen" event when testing recovery | `b.on('halfOpen', ...)` + wait for resetTimeout | event captured at T+250ms |
| should emit "fallback" event when fallback used | `b.on('fallback', ...)` + fire when open | event captured with result |

**Verified event order (session):** open → fallback(×N) → halfOpen → close

### Group 4: Per-source circuit breakers (TEST-07) — 3 tests

| Test | Approach | Key Assertion |
|------|----------|---------------|
| should create separate breaker for each source | Two `wrapWithCircuitBreaker` calls; fail one | other source still returns value |
| should configure appropriate timeouts per source | Two `wrapWithCircuitBreaker` calls with different `timeout` values | each wraps correctly (verify via timeout rejection timing OR just separate config) |
| should track breaker stats per source | Two direct `CircuitBreaker` instances; fire different counts | `b1.stats.fires !== b2.stats.fires` |

**Note on per-source timeouts:** The TODO specifies Liga Magic: 10s, TCGPlayer: 5s. The current `orchestrator.ts` applies the DEFAULT config (10s) to ALL sources. The test should use `wrapWithCircuitBreaker` with explicit per-source configs to verify the config parameter is honoured, NOT the production orchestrator's actual setup. This tests the feature's capability, not the current defaults. [ASSUMED: no source change needed for this to pass]

### Group 5: Integration scenarios (TEST-04 + TEST-07 overlap) — 3 tests

| Test | Approach | Key Assertion |
|------|----------|---------------|
| should prevent cascading failures from bad sources | Two breakers; fail one; other returns result | second source result is not null |
| should recover automatically when source heals | Full lifecycle + successful fire after halfOpen | `b.closed === true` after recovery |
| should handle rapid successive requests correctly | Fire many concurrent `Promise.all` calls when open | all resolve quickly (fast-fail to fallback) |

---

## Common Pitfalls

### Pitfall 1: `errorThresholdPercentage` requires enough volume to trigger

**What goes wrong:** Opossum's rolling window doesn't open the circuit until enough fires have occurred. With `rollingCountBuckets: 1` and `errorThresholdPercentage: 1`, ONE failure still needs to count as >1% of recent fires. The circuit opens after 1 failure.
**Why it happens:** Opossum calculates `failures / fires * 100 >= errorThresholdPercentage`. With 1 failure out of 1 fire = 100% >= 1% → opens.
**How to avoid:** Use the config from `buildFlakyBreaker` already in the test file: `errorThresholdPercentage: 1, rollingCountBuckets: 1`.
**Warning signs:** Circuit doesn't open despite failures — check `rollingCountBuckets`.

### Pitfall 2: State is CLOSED after construction even without firing

**What goes wrong:** Tests that assert `b.closed === false` after construction before any failures fail.
**Why it happens:** Opossum starts in CLOSED state.
**How to avoid:** Initial state test asserts `b.closed === true`, not false.

### Pitfall 3: Event `halfOpen` fires with resetTimeout value as argument

**What goes wrong:** `b.on('halfOpen', (arg) => ...)` receives the resetTimeout duration as the first argument, not a boolean.
**Why it happens:** Opossum emits `circuit.emit('halfOpen', circuit.options.resetTimeout)` (verified in source).
**How to avoid:** If capturing the argument, expect it to be the numeric resetTimeout value, not undefined.

### Pitfall 4: `fallback` event fires with the RESULT of the fallback, not the error

**What goes wrong:** Asserting `fallbackEvent === error` instead of `fallbackEvent === fallbackResult`.
**Why it happens:** Opossum `on('fallback', result => ...)` passes the fallback's return value.
**How to avoid:** Verify `events` array contains `'fallback:null'` pattern (if the fallback returns null).

### Pitfall 5: Biome import order violations

**What goes wrong:** Biome `organizeImports` rejects `import CircuitBreaker from 'opossum'` before `import { wrapWithCircuitBreaker } from '../circuit-breaker'`.
**Why it happens:** `@/` and relative `../` imports are "internal"; external npm packages sort after internal.
**How to avoid:** Put `import { wrapWithCircuitBreaker } from '../circuit-breaker'` BEFORE `import CircuitBreaker from 'opossum'` and `import { ... } from 'vitest'`.

### Pitfall 6: Tests that share state between cases via module-level breaker

**What goes wrong:** One test opens the circuit; the next test starts with an already-open circuit.
**Why it happens:** Module-level `const b = new CircuitBreaker(...)` is shared across all tests in a describe.
**How to avoid:** Create a fresh `CircuitBreaker` instance inside each `test()` body or in `beforeEach`. Do NOT create a single module-level breaker.

### Pitfall 7: Opossum timers fire after test ends (open handle leaks)

**What goes wrong:** Vitest reports "test suite leaks" because Opossum's `resetTimeout` `setTimeout` keeps running.
**Why it happens:** Opossum's `setInterval` for bucket rotation and `setTimeout` for `resetTimeout` don't automatically clear.
**How to avoid:** Call `b.shutdown()` in `afterEach` or in each test after assertions are done. `shutdown()` clears all timers, removes listeners, and marks the breaker as shut down.

---

## Code Examples

### Complete fast-failing config (reuse across tests)

```typescript
// Source: Verified in session against opossum 9.0.0
const FAST_CONFIG = {
  timeout: 100,
  errorThresholdPercentage: 1,
  resetTimeout: 200,
  rollingCountTimeout: 1000,
  rollingCountBuckets: 1,
}
```

### State transition: closed → open

```typescript
// Source: node -e verification in session
const b = new CircuitBreaker(vi.fn().mockRejectedValue(new Error('fail')), FAST_CONFIG)
b.fallback(() => null)

expect(b.closed).toBe(true)

await b.fire('arg').catch(() => {})
expect(b.opened).toBe(true)
expect(b.closed).toBe(false)

b.shutdown()
```

### State transition: open → half-open → closed

```typescript
// Source: node -e verification in session
const action = vi.fn().mockRejectedValue(new Error('fail'))
const b = new CircuitBreaker(action, FAST_CONFIG)
b.fallback(() => null)

await b.fire('arg').catch(() => {})
expect(b.opened).toBe(true)

await new Promise(r => setTimeout(r, 250)) // wait past resetTimeout (200ms)
expect(b.halfOpen).toBe(true)

action.mockResolvedValue('ok')
await b.fire('arg')
expect(b.closed).toBe(true)

b.shutdown()
```

### Event emission capture

```typescript
// Source: node -e verification in session — event order confirmed
const events: string[] = []
const b = new CircuitBreaker(vi.fn().mockRejectedValue(new Error('fail')), FAST_CONFIG)
b.fallback(() => 'fb-result')
b.on('open', () => events.push('open'))
b.on('fallback', (result) => events.push(`fallback:${result}`))
b.on('halfOpen', () => events.push('halfOpen'))
b.on('close', () => events.push('close'))

await b.fire('arg').catch(() => {})        // opens → fires fallback
expect(events[0]).toBe('open')
expect(events).toContain('fallback:fb-result')

b.shutdown()
```

### Fallback error handling

```typescript
// Source: node -e verification in session
const b = new CircuitBreaker(vi.fn().mockRejectedValue(new Error('fail')), FAST_CONFIG)
b.fallback(() => { throw new Error('fallback-error') })

const result = await b.fire('arg').catch(e => e.message)
expect(result).toBe('fallback-error')

b.shutdown()
```

### Per-source isolation

```typescript
// Source: wrapWithCircuitBreaker signature in src/scraper/circuit-breaker.ts
import { wrapWithCircuitBreaker } from '../circuit-breaker'

const failFn = vi.fn().mockRejectedValue(new Error('source-down'))
const successFn = vi.fn().mockResolvedValue(9.99)

const ligaMagic = wrapWithCircuitBreaker(failFn, 'Liga Magic', { ...FAST_CONFIG })
const tcgPlayer = wrapWithCircuitBreaker(successFn, 'TCGPlayer', { ...FAST_CONFIG })

await ligaMagic('oracle-id').catch(() => {})   // opens Liga Magic breaker
const price = await tcgPlayer('oracle-id')      // TCGPlayer unaffected
expect(price).toBe(9.99)
```

### Stats per source

```typescript
// Source: opossum b.stats shape verified in session
const b1 = new CircuitBreaker(vi.fn().mockRejectedValue(new Error()), FAST_CONFIG)
const b2 = new CircuitBreaker(vi.fn().mockResolvedValue('ok'), FAST_CONFIG)
b1.fallback(() => null)
b2.fallback(() => null)

await b1.fire('arg').catch(() => {})
await b1.fire('arg').catch(() => {})
await b2.fire('arg')

expect(b1.stats.failures).toBeGreaterThan(0)
expect(b2.stats.failures).toBe(0)
expect(b1.stats.failures).not.toBe(b2.stats.failures)

b1.shutdown()
b2.shutdown()
```

---

## Source Change Analysis

**The 18 stubs can be activated with NO source file changes.**

| Test Group | Source Change Needed? | Rationale |
|------------|----------------------|-----------|
| State transitions | No | Opossum `.closed`/`.opened`/`.halfOpen` are public getters |
| Fallback function | No | `b.fallback()` is the standard Opossum API |
| Event emission | No | `b.on('open', ...)` is standard Node.js EventEmitter |
| Per-source isolation | No | `wrapWithCircuitBreaker` already accepts optional config |
| Integration scenarios | No | Compose existing patterns |

**One interpretation gap (low risk):**
The "cached data" stub says "Returns last known good price" but current source has no cache. The "Returns null if no cached data" bullet in the TODO is the correct assertion for the current implementation. If the plan author wants a real caching test, that requires either: (a) using Opossum's built-in `cache: true` option in a test-only breaker, or (b) a source change. Research recommendation: test the null case — it satisfies the stub's intent without scope creep. [ASSUMED]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-04 | State transitions lifecycle | unit | `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts` | ✅ (stubs exist) |
| TEST-05 | Fallback execution | unit | `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts` | ✅ (stubs exist) |
| TEST-06 | Event emission | unit | `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts` | ✅ (stubs exist) |
| TEST-07 | Per-source isolation | unit | `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts` | ✅ (stubs exist) |

### Sampling Rate

- **Per task commit:** `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green (no new regressions) before `/gsd-verify-work`

### Wave 0 Gaps

None — the test file already exists with all 18 stubs. No framework setup or new file creation required.

---

## Baseline Test Counts (Before Phase 8)

```
Test Files  19 passed | 20 skipped (39)
    Tests  143 passed | 200 skipped | 38 todo (381)
```

**After Phase 8 (expected):**

```
Tests  161 passed | 182 skipped | 38 todo
         ↑ +18 activated        ↓ -18 skipped
```

All 18 circuit breaker stubs activate. No other test files change. Regression check: the 4 existing active Health Alert tests in the same file must remain green.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| opossum | Circuit breaker tests | ✓ | 9.0.0 | — |
| vitest | Test runner | ✓ | 3.2.4 | — |
| Node.js | Runtime | ✓ | v22.18.0 | — |
| pnpm | Script runner | ✓ | 10.33.2 | — |

No missing dependencies.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vi.useFakeTimers()` for timer-dependent tests | Short real `resetTimeout` (200ms) + real wait | Established in Phase 7 | Avoids Vitest 3.x async mock unhandled rejection warnings |
| Testing through wrapper function only | Import `CircuitBreaker` directly from `opossum` | This phase | Enables state inspection, custom fallback, stats access |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "return cached data from fallback" test can be satisfied by asserting `result === null` (current fallback returns null, no cache exists) | Source Change Analysis | If the planner interprets this as requiring a real cache feature, a source change to `circuit-breaker.ts` is needed — adds complexity and risk of regression |
| A2 | Per-source timeout test can use different `wrapWithCircuitBreaker` configs without matching the production orchestrator's actual configs (which use DEFAULT for all sources) | Per-source isolation pattern | If the test must reflect the production orchestrator's actual per-source timeout values, the orchestrator source needs changes — a larger scope expansion |
| A3 | `b.shutdown()` in each test is sufficient to prevent timer leaks in Vitest (no open handle warnings) | Common Pitfalls #7 | If Vitest still reports leaks, may need `afterEach(() => breaker.shutdown())` or `vitest --pool=forks` config |

---

## Open Questions

1. **Cached data test scope**
   - What we know: Current fallback returns `null` always; no cache exists in source
   - What's unclear: Does "cached data" test mean (a) verify null = no cache, or (b) implement a real cache-aware fallback
   - Recommendation: Implement as null verification (no source change). If the review phase disagrees, a source change to add optional cached fallback to `wrapWithCircuitBreaker` is isolated to `circuit-breaker.ts`.

2. **Per-source timeout values**
   - What we know: Stubs specify Liga: 10s, TCGPlayer: 5s, CardMarket: 5s, CardKingdom: 10s — but the production orchestrator uses 10s for all
   - What's unclear: Should the test verify the PRODUCTION values, or the CAPABILITY to configure per-source?
   - Recommendation: Test the capability — create four `wrapWithCircuitBreaker` calls with those timeout values and verify each wraps without error. No orchestrator source change needed.

---

## Sources

### Primary (HIGH confidence)

- `src/scraper/circuit-breaker.ts` — Production source; read in full
- `src/scraper/__tests__/circuit-breaker.test.ts` — All 18 stubs read; 4 active Health Alert tests studied as pattern
- `node_modules/opossum/lib/circuit.js` — Full CircuitBreaker class API, state getters, fallback(), open(), close(), shutdown(), stats, events
- `node_modules/opossum/lib/status.js` — Stats rolling window, b.stats shape
- `node_modules/opossum/package.json` — Version 9.0.0 [VERIFIED: npm registry 2025-06-05]
- `node -e "..."` verification scripts — State machine, event order, stats shape, fallback-throws behavior all verified via runtime execution

### Secondary (MEDIUM confidence)

- `.planning/phases/07-auth-rate-limit-tests/07-01-SUMMARY.md` — Phase 7 anti-fake-timer decision, biome import order, `noNonNullAssertion` rule
- `.planning/phases/07-auth-rate-limit-tests/07-02-SUMMARY.md` — globalThis hook pattern, biome-ignore for `delete process.env`
- `vitest.config.ts` — Test environment, setupFiles, include patterns, timeout

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — opossum 9.0.0 and vitest 3.2.4 verified from node_modules
- Architecture: HIGH — all patterns verified via `node -e` runtime tests in session
- Pitfalls: HIGH — timer leak and import order verified against Phase 7 summaries and actual source
- Assumptions: MEDIUM — two interpretation gaps (cached data, per-source timeouts) require planner decision

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (opossum is stable; Vitest moves fast but Pitfall #4 of async mocks is documented upstream)
