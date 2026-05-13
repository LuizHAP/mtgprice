# Phase 10: Scheduler Tests - Research

**Researched:** 2026-05-13
**Domain:** Vitest test activation, node-cron mocking, module-level state isolation
**Confidence:** HIGH

## Summary

Phase 10 activates 7 test stubs that already exist as `test.skip` in `src/scheduler/__tests__/jobs.test.ts`. No new test files are created. The work divides into two areas: (1) two small implementation additions to `src/scheduler/jobs.ts` that make the tests verifiable, and (2) test body replacement for each of the 7 stubs.

The current test file has 5 passing tests for `scheduleMetagameRefresh` and 17 skipped stubs. The 7 stubs targeted by this phase live in `describe('Cron job scheduling') > describe('schedulePriceCollection')` (3 stubs) and `describe('Cron job scheduling') > describe('executePriceCollection')` (4 stubs). The remaining 9 stubs — `validateScheduleTimes`, `stopScheduler`, and `Integration scenarios` — stay as `test.skip`.

The two implementation additions are strictly scoped: a `cron.validate()` guard at the top of `schedulePriceCollection` (before any `cron.schedule` call), and `durationMs` tracking in `executePriceCollection` (capture `Date.now()` at entry, compute elapsed at each return path, add the field to the return type). The `@/scheduler/index.ts` re-exports the function by name — TypeScript will propagate the widened return type automatically with no manual change required there.

**Primary recommendation:** Write the 7 test bodies following the `scheduleMetagameRefresh` dynamic-import pattern exactly. Extend the `node-cron` mock to expose `validate`, add `@/lib/opportunities` to the top-level `vi.mock` list, and use `vi.resetModules()` + `vi.doMock()` in the concurrency test's `beforeEach` to reset the module-level `isRunning` flag.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Test Scope**
- D-01: Only activate the 7 stubs covered by TEST-10 and TEST-11. The remaining 9 stubs (`validateScheduleTimes`, `stopScheduler`, `Integration scenarios`) require functions that don't exist in `jobs.ts` yet — they stay skipped.
- D-02: The 7 required stubs live in two describe blocks: `describe('schedulePriceCollection')` and `describe('executePriceCollection')`. All stubs within those blocks are activated (not cherry-picked).

**schedulePriceCollection — Cron Validation**
- D-03: Add a `cron.validate()` guard at the top of `schedulePriceCollection`, one call per schedule expression (`morningSchedule`, `afternoonSchedule`, `eveningSchedule`). If any expression fails validation, throw `new Error(\`Invalid cron expression: \${expr}\`)` before any `cron.schedule` call is made.
- D-04: The test "should handle invalid cron expressions" sets one of the env vars (e.g., `CRON_MORNING`) to an invalid string, calls `schedulePriceCollection()`, and asserts that an `Error` is thrown.

**executePriceCollection — Duration Tracking**
- D-05: Capture `const startTime = Date.now()` at the start of `executePriceCollection` (before the `isRunning` guard early return). Compute `durationMs = Date.now() - startTime` just before each return path (including the early "already running" return). Log it via `logger.info(\`Price collection took \${durationMs}ms\`)`.
- D-06: Add `durationMs: number` to the return type `{ total, fetched, skipped, failed, durationMs }`. All return paths (early return, no-cards path, success path, error path) include `durationMs`.
- D-07: The test "should record execution duration" asserts that the returned stats object includes a `durationMs` field that is `>= 0`.

**Test Infrastructure**
- D-08: Follow the established test setup pattern: `vi.clearAllMocks()` in `beforeEach`. The existing `vi.mock(...)` declarations at the top of the test file (node-cron, @/scraper/orchestrator, @/db, @/lib/logger) are reused as-is.
- D-09: For the concurrency guard test, use `vi.resetModules()` in `beforeEach` to get a fresh module instance (resetting the `isRunning` module-level flag), then hold an unresolved `fetchAllPrices` mock to simulate an in-progress run, start a second `executePriceCollection`, and verify it returns `{ total: 0, fetched: 0, skipped: 0, failed: 0, durationMs: 0 }` immediately.
- D-10: The `@/lib/opportunities` module must be added to the `vi.mock(...)` declarations so `detectOpportunitiesForWishlist` and `sendDigestAndPersist` don't run during scheduler tests.
- D-11: The `db.query.cards.findMany` mock must return at least one card for the "should run full fetch orchestration" test.

### Claude's Discretion

- Exact duration logging format — consistent with existing `logger.info` calls in the function.
- Whether the `durationMs` on the "already running" early return is `0` or the actual elapsed few milliseconds — either is valid as long as the field exists.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-10 | Tests ativos para schedulePriceCollection (cron registration, custom schedule, invalid expressions) | D-03/D-04 + cron.validate behavior verified; mock extension pattern documented |
| TEST-11 | Tests ativos para executePriceCollection (run orchestration, error handling, duration metrics, concorrência) | D-05/D-06/D-07/D-09 + vi.resetModules pattern verified from orchestrator tests |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cron validation guard | API / Backend (scheduler) | — | Pure server-side: validates before scheduling; no frontend involvement |
| Duration tracking | API / Backend (scheduler) | — | Execution metric captured in the same function; no DB write needed |
| Test mock isolation | Test layer | — | `vi.resetModules()` resets module-level state between test cases |
| Opportunities mock | Test layer | — | `@/lib/opportunities` called inside `executePriceCollection`; must be mocked to prevent real DB/Telegram calls |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 3.2.4 [VERIFIED: npm run test output] | Test runner, mocking, assertions | Already configured; all other test phases use it |
| node-cron | 4.2.1 [VERIFIED: npm view node-cron] | Cron scheduling + `cron.validate()` | Already a project dependency; `validate` returns `boolean` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/coverage-v8 | (project-installed) | Coverage reporting | Already configured in vitest.config.ts |

### Alternatives Considered

No alternatives — the stack is fixed by prior phases.

**Version verification:**
- `node-cron@4.2.1` — verified via `npm view node-cron version` [VERIFIED: npm registry]
- `vitest@3.2.4` — verified from test output [VERIFIED: test run]

## Architecture Patterns

### System Architecture Diagram

```
Test file (jobs.test.ts)
│
├── Top-level vi.mock declarations (hoisted)
│   ├── 'node-cron'          → { default: { schedule: mockFn, validate: mockFn } }
│   ├── '@/scraper/orchestrator' → fetchAllPrices mock
│   ├── '@/db'               → db.query.cards.findMany mock
│   ├── '@/lib/logger'       → logger.info/warn/error mocks
│   └── '@/lib/opportunities' → detectOpportunitiesForWishlist, sendDigestAndPersist mocks  [ADD]
│
├── describe('scheduleMetagameRefresh') — 5 tests PASSING (untouched)
│
└── describe('Cron job scheduling')
    ├── describe('schedulePriceCollection') — 3 stubs → ACTIVATE
    │   ├── beforeEach: vi.clearAllMocks() + delete env vars
    │   ├── it('cron registration')   → dynamic import + assert cron.schedule ×3
    │   ├── it('custom schedule')     → set env var + dynamic import + assert schedule expr
    │   └── it('invalid expression')  → set CRON_MORNING='bad' + assert throws
    │
    ├── describe('executePriceCollection') — 4 stubs → ACTIVATE
    │   ├── 3 tests: beforeEach vi.clearAllMocks()
    │   │   ├── it('run orchestration')  → findMany returns card + assert fetchAllPrices called + durationMs ≥ 0
    │   │   ├── it('error handling')     → fetchAllPrices rejects + assert returns failed=1 + durationMs ≥ 0
    │   │   └── it('duration metrics')   → assert durationMs field in return
    │   └── 1 concurrency test: beforeEach vi.resetModules() + vi.doMock(...)
    │       └── it('concurrent executions') → hold promise + second call returns durationMs:0 immediately
    │
    ├── describe('validateScheduleTimes') — 3 stubs REMAIN SKIPPED
    ├── describe('stopScheduler')         — 3 stubs REMAIN SKIPPED
    └── describe('Integration scenarios') — 4 stubs REMAIN SKIPPED
```

### Recommended Project Structure

No new files or directories. Changes are confined to:

```
src/scheduler/
├── __tests__/jobs.test.ts    # Activate 7 stubs; extend node-cron mock; add @/lib/opportunities mock
└── jobs.ts                   # Add cron.validate guard; add durationMs tracking
```

`src/scheduler/index.ts` re-exports `executePriceCollection` by name — TypeScript propagates the updated return type automatically. No manual edit required unless a named type alias is needed (none exists currently).

### Pattern 1: Dynamic Import for Env-Var-Sensitive Tests

**What:** Import the module under test inside each `it()` block (after setting env vars) rather than at file top. Vitest re-uses the module cache for the session but env vars are read at module execution time, so setting them before the dynamic import ensures the module sees them.

**When to use:** Any test that needs a different env var value per test case. Established in `scheduleMetagameRefresh` tests; must be followed identically for `schedulePriceCollection`.

```typescript
// Source: src/scheduler/__tests__/jobs.test.ts (scheduleMetagameRefresh pattern — VERIFIED)
it('honors CRON_MORNING env var override', async () => {
  process.env.CRON_MORNING = '0 6 * * *'
  const { schedulePriceCollection } = await import('../jobs')
  const cronModule = await import('node-cron')

  schedulePriceCollection()

  expect(cronModule.default.schedule).toHaveBeenCalledWith(
    '0 6 * * *',
    expect.any(Function),
    expect.anything(),
  )
})
```

### Pattern 2: vi.resetModules() for Module-Level State Reset

**What:** `vi.resetModules()` clears Vitest's module registry. The next `await import(...)` in that test re-executes the module, which re-initialises module-level variables (including `let isRunning = false`).

**When to use:** When the code under test uses a module-level flag as concurrency guard, and one test must simulate the flag being `true` while subsequent tests need it back at `false`.

**Important constraint:** `vi.resetModules()` does NOT un-apply `vi.mock()` hoisted declarations. After `resetModules()`, you must re-register mocks using `vi.doMock()` (not `vi.mock()`) before re-importing the module, because `vi.mock()` is hoisted at file parse time while `vi.doMock()` is registered inline.

```typescript
// Source: src/scraper/__tests__/orchestrator.test.ts lines 32,66 (VERIFIED in codebase)
// Pattern verified as working in this project
beforeEach(() => {
  vi.resetModules()
  vi.doMock('@/scraper/orchestrator', () => ({
    default: vi.fn(), // override per-test
  }))
})
```

For the concurrency test specifically:

```typescript
// [ASSUMED] — derived from D-09 + the established orchestrator pattern
beforeEach(() => {
  vi.resetModules()
  vi.doMock('@/scraper/orchestrator', () => ({
    default: vi.fn(), // override below in test body
  }))
  vi.doMock('@/db', () => ({
    db: { query: { cards: { findMany: vi.fn().mockResolvedValue([{ oracleId: 'test-id' }]) } } },
  }))
  vi.doMock('@/lib/opportunities', () => ({
    detectOpportunitiesForWishlist: vi.fn().mockResolvedValue([]),
    sendDigestAndPersist: vi.fn().mockResolvedValue({ persisted: 0, sent: false }),
    loadDetectionConfig: vi.fn().mockReturnValue({}),
  }))
  vi.doMock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }))
})
```

### Pattern 3: Extend node-cron Mock to Include validate

**What:** The existing `node-cron` mock only exposes `schedule`. The implementation will call `cron.validate(expr)` (using the default import). The mock's `default` object must also expose `validate`.

**Critical finding:** `node-cron@4.2.1` exports `validate` as a named export only — there is no default export. [VERIFIED: `node -e "const cron = require('./node_modules/node-cron'); console.log(Object.keys(cron))"` → `['schedule', 'validate', 'getTasks']`]. The project imports it as `import cron from 'node-cron'` (a synthetic default), so the mock's `default` key must carry `validate`.

For happy-path tests, `validate` should return `true`. For the invalid-expression test, override with `mockReturnValueOnce(false)` (or keep returning `true` for the two valid expressions and `false` for the invalid one — the guard iterates all three expressions and throws on first failure).

```typescript
// Source: jobs.test.ts vi.mock block — MUST be updated to [VERIFIED pattern]
vi.mock('node-cron', () => {
  const mockSchedule = vi.fn().mockReturnValue({ start: vi.fn(), stop: vi.fn() })
  const mockValidate = vi.fn().mockReturnValue(true)  // ADD THIS
  return {
    default: {
      schedule: mockSchedule,
      validate: mockValidate,        // ADD THIS
    },
    schedule: mockSchedule,
  }
})
```

### Anti-Patterns to Avoid

- **Importing at file top-level for env-var-dependent tests:** `import { schedulePriceCollection } from '../jobs'` at file scope captures env vars at file parse time, not at test execution time. Always use `await import('../jobs')` inside the `it()` body after setting env vars.
- **Using vi.mock() inside beforeEach for resetModules flow:** `vi.mock()` is hoisted to file top regardless of where it appears syntactically. After `vi.resetModules()`, use `vi.doMock()` to register the fresh mock before the dynamic re-import.
- **Forgetting loadDetectionConfig in opportunities mock:** `executePriceCollection` calls `loadDetectionConfig()` as well as `detectOpportunitiesForWishlist` and `sendDigestAndPersist`. All three must be mocked or the test will call real config-reading code.
- **Not returning at least one card for orchestration test:** `executePriceCollection` short-circuits with `{ total:0, fetched:0, skipped:0, failed:0 }` when `findMany` returns `[]`. D-11 requires `mockResolvedValueOnce([{ oracleId: 'test-id' }])` to let the test reach the `fetchAllPrices` call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron expression validation | Custom regex | `cron.validate(expr)` from node-cron | Returns `boolean`; already a project dependency; handles all cron edge cases [VERIFIED: live test] |
| Module-level state reset | Manually resetting `isRunning` between tests | `vi.resetModules()` + dynamic re-import | Module re-execution naturally resets `let isRunning = false`; no test-only mutation API needed |
| Timing assertions | `Date.now()` in test body comparison | Assert `durationMs >= 0` | Tests are non-deterministic about exact durations; ≥0 is the correct invariant |

**Key insight:** `cron.validate()` returning `false` (not throwing) is the source of truth. The implementation guard must throw explicitly; the function itself does not throw.

## Common Pitfalls

### Pitfall 1: node-cron validate returns false, not throws

**What goes wrong:** Developer assumes `cron.validate('bad-expr')` throws and writes `expect(() => cron.validate(x)).toThrow()`.
**Why it happens:** Many validation utilities throw on invalid input; node-cron is a boolean-returner instead.
**How to avoid:** Call `cron.validate(expr)` and check the `false` return; then `throw new Error(...)` yourself in `schedulePriceCollection`.
**Warning signs:** Test that asserts `toThrow()` on `schedulePriceCollection()` passes only if the implementation does the throwing — not node-cron.

[VERIFIED: `node -e "const cron = require('./node_modules/node-cron'); console.log(cron.validate('not-a-cron'))"` → `false`]

### Pitfall 2: Top-level mock for node-cron missing validate key

**What goes wrong:** `cron.validate` is `undefined` at test runtime; calling it inside `schedulePriceCollection` throws `TypeError: cron.validate is not a function` rather than returning `false`.
**Why it happens:** The existing mock was written before `validate` was needed — it only has `schedule`.
**How to avoid:** Update the `vi.mock('node-cron', ...)` factory to include `validate: vi.fn().mockReturnValue(true)` in the `default` object.
**Warning signs:** TypeError mentioning `validate` in test output.

[VERIFIED: current mock does not include validate — confirmed by reading lines 9-20 of jobs.test.ts]

### Pitfall 3: Concurrency test doesn't get a fresh isRunning=false

**What goes wrong:** `isRunning` stays `true` from a previous test run; the concurrency test can't distinguish between "guard working correctly" and "leftover state from prior test".
**Why it happens:** Module-level `let isRunning = false` is initialized once when the module first loads; `vi.clearAllMocks()` does not reset it.
**How to avoid:** Use `vi.resetModules()` + `vi.doMock()` + `await import('../jobs')` pattern inside a dedicated `beforeEach` or at the top of the concurrency test.
**Warning signs:** Concurrency test passes for wrong reasons (always returns early because isRunning never resets).

[VERIFIED: only `src/scraper/__tests__/orchestrator.test.ts` currently uses this pattern; it is the established project precedent]

### Pitfall 4: opportunities mock missing loadDetectionConfig

**What goes wrong:** `executePriceCollection` calls `loadDetectionConfig()` at line 130 of jobs.ts. If the mock factory for `@/lib/opportunities` only mocks `detectOpportunitiesForWishlist` and `sendDigestAndPersist`, `loadDetectionConfig` is `undefined` and throws at runtime.
**Why it happens:** Mock is written to match what the test author thinks is needed, missing the third export.
**How to avoid:** Mock all three exports: `detectOpportunitiesForWishlist`, `sendDigestAndPersist`, and `loadDetectionConfig`.
**Warning signs:** `TypeError: loadDetectionConfig is not a function` in test output.

[VERIFIED: jobs.ts line 130 — `const detectionConfig = loadDetectionConfig()`]

### Pitfall 5: durationMs computed in finally vs at each return path

**What goes wrong:** Putting `durationMs = Date.now() - startTime` only in `finally` means the early "already running" return can't set it to a specific value (e.g., `0`).
**Why it happens:** `finally` runs after all returns but only one place to assign; the test expects the field to exist on the early-return path too.
**How to avoid:** Per D-05, compute `durationMs` just before each return statement. The early-return path can return `{ ..., durationMs: 0 }` or `Date.now() - startTime` (both are valid per Claude's discretion).
**Warning signs:** TypeScript error if `durationMs` is not in the inline return literal; test failure if field is absent.

[VERIFIED: jobs.ts lines 81-88 show the early return path that needs `durationMs` added]

## Code Examples

### Current executePriceCollection Return Type (pre-change)

```typescript
// Source: src/scheduler/jobs.ts lines 74-79 [VERIFIED]
export async function executePriceCollection(): Promise<{
  total: number
  fetched: number
  skipped: number
  failed: number
}> {
```

After phase 10 changes:

```typescript
// [ASSUMED] — based on D-06 decision
export async function executePriceCollection(): Promise<{
  total: number
  fetched: number
  skipped: number
  failed: number
  durationMs: number   // ADD
}> {
  const startTime = Date.now()  // ADD — before isRunning guard

  if (isRunning) {
    logger.warn('Price collection already running, skipping this execution')
    return { total: 0, fetched: 0, skipped: 0, failed: 0, durationMs: 0 }  // durationMs: 0 on early return
  }
  // ... rest of function
  // durationMs = Date.now() - startTime added at each subsequent return path
```

### cron.validate Guard in schedulePriceCollection (pre-cron.schedule)

```typescript
// [ASSUMED] — based on D-03 decision
export function schedulePriceCollection(): { start: () => void; stop: () => void } {
  const morningSchedule = process.env.CRON_MORNING || '0 9 * * *'
  const afternoonSchedule = process.env.CRON_AFTERNOON || '0 15 * * *'
  const eveningSchedule = process.env.CRON_EVENING || '0 21 * * *'

  // Validate all three expressions before scheduling
  for (const expr of [morningSchedule, afternoonSchedule, eveningSchedule]) {
    if (!cron.validate(expr)) {
      throw new Error(`Invalid cron expression: ${expr}`)
    }
  }

  logger.info(...)
  morningJob = cron.schedule(morningSchedule, ...)
  // ...
```

### scheduleMetagameRefresh Test Pattern (canonical reference)

```typescript
// Source: src/scheduler/__tests__/jobs.test.ts lines 52-63 [VERIFIED]
it('registers a single cron.schedule job with { scheduled: false } at default Sunday 2 AM', async () => {
  const { scheduleMetagameRefresh } = await import('../jobs')
  const cronModule = await import('node-cron')

  scheduleMetagameRefresh()

  expect(cronModule.default.schedule).toHaveBeenCalledWith(
    '0 2 * * 0',
    expect.any(Function),
    expect.objectContaining({ scheduled: false }),
  )
})
```

The `schedulePriceCollection` cron registration test follows this same pattern, but asserts `toHaveBeenCalledTimes(3)` (morning, afternoon, evening) and checks default expressions `'0 9 * * *'`, `'0 15 * * *'`, `'0 21 * * *'`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vi.mock()` inline (post-hoist) | `vi.doMock()` after `vi.resetModules()` | Vitest design | Required for per-test module re-initialization |
| Manual `isRunning = false` export for tests | `vi.resetModules()` | Phase 10 design | Cleaner: no test-only API exposure on the module |

**Deprecated/outdated:**
- `jest.resetModules()` → `vi.resetModules()` in Vitest; same semantics, different API

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The concurrency test's `beforeEach` must use `vi.doMock()` (not `vi.mock()`) after `vi.resetModules()` | Pattern 2 | If `vi.mock()` works in this context, the `vi.doMock()` approach still works — lower risk; the reverse is not true |
| A2 | The `durationMs` on the early-return path is `0` rather than `Date.now() - startTime` | Code Examples | Either is valid per Claude's discretion; tests only assert `>= 0` |
| A3 | The cron validation guard uses a `for...of` loop checking all three expressions | Code Examples | A flat `if (!cron.validate(morning) || !cron.validate(afternoon) || !cron.validate(evening))` is equivalent; neither form is locked |
| A4 | `@/lib/opportunities` mock must include `loadDetectionConfig` | Pitfall 4 | If `loadDetectionConfig` were missing from mock, test throws TypeError — easily caught |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
(Four assumptions above; all are LOW risk and easily caught during execution.)

## Open Questions

1. **Concurrency test isolation scope**
   - What we know: `vi.resetModules()` resets the module cache so `isRunning` returns to `false` on next import; `vi.doMock()` must be called after `resetModules()` and before the dynamic import.
   - What's unclear: Whether the concurrency describe block needs its own `beforeEach` (isolated from the other executePriceCollection tests) or whether a single `beforeEach` at the describe('executePriceCollection') level suffices for all 4 tests.
   - Recommendation: Use a nested `describe('concurrent executions')` with its own `beforeEach` using `vi.resetModules()`. The other 3 executePriceCollection tests use the outer `beforeEach` with `vi.clearAllMocks()` only. This avoids the overhead of module re-initialization for tests that don't need it.

## Environment Availability

Step 2.6: SKIPPED — phase is code/config-only test activation; no external services, CLIs, or runtimes beyond the already-confirmed Node.js + Vitest environment are required.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-10 | schedulePriceCollection registers 3 cron jobs at default times | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ (stub, needs activation) |
| TEST-10 | schedulePriceCollection honors custom env var overrides | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ (stub, needs activation) |
| TEST-10 | schedulePriceCollection throws on invalid cron expression | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ (stub, needs activation) |
| TEST-11 | executePriceCollection runs fetchAllPrices and returns stats | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ (stub, needs activation) |
| TEST-11 | executePriceCollection handles fetchAllPrices rejection gracefully | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ (stub, needs activation) |
| TEST-11 | executePriceCollection return value includes durationMs >= 0 | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ (stub, needs activation) |
| TEST-11 | executePriceCollection skips when already running (concurrency guard) | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ (stub, needs activation) |

### Sampling Rate

- **Per task commit:** `pnpm test:run src/scheduler/__tests__/jobs.test.ts`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

None — existing test infrastructure (vitest.config.ts, test/setup.ts, all vi.mock declarations) covers all phase requirements. No new files need to be created before implementation begins.

## Security Domain

> This phase activates unit tests for scheduler jobs. No new authentication, session management, access control, cryptography, or network I/O is introduced. Security domain is not applicable.

| ASVS Category | Applies | Notes |
|---------------|---------|-------|
| V2 Authentication | no | No auth code in scope |
| V3 Session Management | no | No session code in scope |
| V4 Access Control | no | No access control in scope |
| V5 Input Validation | partial | `cron.validate()` validates scheduler input — library-handled, not hand-rolled |
| V6 Cryptography | no | No crypto in scope |

## Sources

### Primary (HIGH confidence)

- `src/scheduler/__tests__/jobs.test.ts` — full file read; exact stub content, existing passing tests, current mock structure verified
- `src/scheduler/jobs.ts` — full file read; `executePriceCollection` return type, `isRunning` flag location, `schedulePriceCollection` structure, `loadDetectionConfig` call verified
- `src/scheduler/index.ts` — full file read; re-export pattern confirmed (named + default); no type alias to update
- `node_modules/node-cron/` — live `node -e` execution confirmed: `cron.validate('0 9 * * *')` → `true`, `cron.validate('not-a-cron')` → `false`; exports: `['schedule', 'validate', 'getTasks']`
- `npm view node-cron version` → `4.2.1` [VERIFIED: npm registry]
- `src/scraper/__tests__/orchestrator.test.ts` — `vi.resetModules()` + `vi.doMock()` pattern confirmed as established project precedent
- [Context7: /websites/nodecron] — `cron.validate()` API documentation confirmed

### Secondary (MEDIUM confidence)

- `.planning/phases/10-scheduler-tests/10-CONTEXT.md` — all implementation decisions read directly; treated as HIGH confidence for locked decisions

### Tertiary (LOW confidence)

- None — all research claims verified from codebase or live execution.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm and test run
- Architecture: HIGH — entire test file and both implementation files read verbatim
- Pitfalls: HIGH — each pitfall verified by direct code inspection or live execution
- `vi.resetModules()` concurrency pattern: MEDIUM — pattern exists in codebase but the exact structure for the nested describe with `vi.doMock()` is [ASSUMED] derived from established precedent

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable libraries, slow-moving domain)
