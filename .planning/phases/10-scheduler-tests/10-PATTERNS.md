# Phase 10: Scheduler Tests - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 2 (1 test file, 1 implementation file)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/scheduler/__tests__/jobs.test.ts` | test | request-response + event-driven | `src/scheduler/__tests__/jobs.test.ts` lines 45–126 (scheduleMetagameRefresh describe) | exact (same file, same function family) |
| `src/scheduler/jobs.ts` | service | event-driven + CRUD | `src/scheduler/jobs.ts` lines 272–305 (scheduleMetagameRefresh) + lines 74–164 (executePriceCollection) | exact (same file) |

---

## Pattern Assignments

### `src/scheduler/__tests__/jobs.test.ts` — schedulePriceCollection describe block (3 stubs → activate)

**Analog:** `src/scheduler/__tests__/jobs.test.ts` lines 45–126 (`scheduleMetagameRefresh` describe)

**Top-level vi.mock block — extend node-cron mock** (lines 9–20, current state):
```typescript
vi.mock('node-cron', () => {
  const mockSchedule = vi.fn().mockReturnValue({
    start: vi.fn(),
    stop: vi.fn(),
  })
  return {
    default: {
      schedule: mockSchedule,
    },
    schedule: mockSchedule,
  }
})
```
Must be updated to add `validate` to the `default` object:
```typescript
vi.mock('node-cron', () => {
  const mockSchedule = vi.fn().mockReturnValue({
    start: vi.fn(),
    stop: vi.fn(),
  })
  const mockValidate = vi.fn().mockReturnValue(true)
  return {
    default: {
      schedule: mockSchedule,
      validate: mockValidate,
    },
    schedule: mockSchedule,
  }
})
```

**New top-level vi.mock for @/lib/opportunities** (add after existing mocks, before describe blocks):
```typescript
vi.mock('@/lib/opportunities', () => ({
  detectOpportunitiesForWishlist: vi.fn().mockResolvedValue([]),
  sendDigestAndPersist: vi.fn().mockResolvedValue({ persisted: 0, sent: false }),
  loadDetectionConfig: vi.fn().mockReturnValue({}),
}))
```

**beforeEach pattern** (lines 46–50 from scheduleMetagameRefresh describe — copy exactly):
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset a var
  delete process.env.CRON_MORNING
  delete process.env.CRON_AFTERNOON
  delete process.env.CRON_EVENING
})
```

**Dynamic import + cron registration assertion pattern** (lines 52–63 — canonical reference):
```typescript
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
For `schedulePriceCollection`, adapt to assert `toHaveBeenCalledTimes(3)` and three default expressions (`'0 9 * * *'`, `'0 15 * * *'`, `'0 21 * * *'`).

**Custom env var override pattern** (lines 65–77):
```typescript
it('honors CRON_METAGAME_REFRESH env var override', async () => {
  process.env.CRON_METAGAME_REFRESH = '0 3 * * 1'
  const { scheduleMetagameRefresh } = await import('../jobs')
  const cronModule = await import('node-cron')

  scheduleMetagameRefresh()

  expect(cronModule.default.schedule).toHaveBeenCalledWith(
    '0 3 * * 1',
    expect.any(Function),
    expect.anything(),
  )
})
```
For `schedulePriceCollection`, set e.g. `process.env.CRON_MORNING = '0 6 * * *'` and assert the first `schedule` call used that expression.

**Invalid expression test pattern** (new — based on D-03/D-04 + mock structure):
```typescript
it('should handle invalid cron expressions', async () => {
  process.env.CRON_MORNING = 'not-a-cron'
  const cronModule = await import('node-cron')
  vi.mocked(cronModule.default.validate).mockReturnValueOnce(false)

  const { schedulePriceCollection } = await import('../jobs')

  expect(() => schedulePriceCollection()).toThrow('Invalid cron expression')
})
```

---

### `src/scheduler/__tests__/jobs.test.ts` — executePriceCollection describe block (4 stubs → activate)

**Analog:** `src/scheduler/__tests__/jobs.test.ts` lines 45–126 (`scheduleMetagameRefresh` describe) for the `beforeEach` and import pattern; `src/scraper/__tests__/orchestrator.test.ts` lines 29–67 for `vi.resetModules()` + `vi.doMock()`.

**beforeEach for the 3 non-concurrency tests** (follows clearAllMocks-only pattern):
```typescript
beforeEach(() => {
  vi.clearAllMocks()
})
```

**db.findMany override for orchestration test** (based on D-11 + existing mock at lines 22–30 of jobs.test.ts):
```typescript
it('should run full fetch orchestration', async () => {
  const { db } = await import('@/db')
  vi.mocked(db.query.cards.findMany).mockResolvedValueOnce([{ oracleId: 'test-id' }])

  const { executePriceCollection } = await import('../jobs')
  const stats = await executePriceCollection()

  expect(stats.fetched).toBeGreaterThanOrEqual(0)
  expect(stats.durationMs).toBeGreaterThanOrEqual(0)
})
```

**Error handling return shape** (based on D-06 + existing error path lines 153–163 of jobs.ts):
```typescript
it('should handle execution errors gracefully', async () => {
  const fetchAllPrices = await import('@/scraper/orchestrator')
  vi.mocked(fetchAllPrices.default).mockRejectedValueOnce(new Error('fetch failed'))

  const { db } = await import('@/db')
  vi.mocked(db.query.cards.findMany).mockResolvedValueOnce([{ oracleId: 'test-id' }])

  const { executePriceCollection } = await import('../jobs')
  const stats = await executePriceCollection()

  expect(stats.failed).toBe(1)
  expect(stats.durationMs).toBeGreaterThanOrEqual(0)
})
```

**Duration metrics assertion** (based on D-07):
```typescript
it('should record execution duration', async () => {
  const { executePriceCollection } = await import('../jobs')
  const stats = await executePriceCollection()

  expect(typeof stats.durationMs).toBe('number')
  expect(stats.durationMs).toBeGreaterThanOrEqual(0)
})
```

**Concurrency test — nested describe with vi.resetModules() + vi.doMock()** (analog: `src/scraper/__tests__/orchestrator.test.ts` lines 29–67):
```typescript
describe('concurrent executions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/scraper/orchestrator', () => ({
      default: vi.fn(),
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

  it('should handle concurrent executions', async () => {
    const fetchAllPricesModule = await import('@/scraper/orchestrator')
    let resolveFirst!: () => void
    vi.mocked(fetchAllPricesModule.default).mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = () => resolve({ fetched: 0, skipped: 0, failed: 0, errors: [] }) }),
    )

    const { executePriceCollection } = await import('../jobs')

    // Start first run (does not resolve yet)
    const firstRun = executePriceCollection()

    // Second run should return early immediately
    const secondStats = await executePriceCollection()
    expect(secondStats).toEqual({ total: 0, fetched: 0, skipped: 0, failed: 0, durationMs: 0 })

    // Unblock the first run
    resolveFirst()
    await firstRun
  })
})
```

---

### `src/scheduler/jobs.ts` — cron.validate() guard in schedulePriceCollection

**Analog:** `src/scheduler/jobs.ts` lines 191–248 (existing `schedulePriceCollection` body)

**Insertion point** (after line 198, before the `logger.info` call at line 200):
```typescript
// current lines 196-198
const morningSchedule = process.env.CRON_MORNING || '0 9 * * *'
const afternoonSchedule = process.env.CRON_AFTERNOON || '0 15 * * *'
const eveningSchedule = process.env.CRON_EVENING || '0 21 * * *'

// ADD AFTER line 198 — guard runs before any cron.schedule call
for (const expr of [morningSchedule, afternoonSchedule, eveningSchedule]) {
  if (!cron.validate(expr)) {
    throw new Error(`Invalid cron expression: ${expr}`)
  }
}

// existing line 200 continues
logger.info(
  `Scheduling price collection: morning=${morningSchedule}, afternoon=${afternoonSchedule}, evening=${eveningSchedule}`,
)
```

`cron` is already imported at line 22 via `import cron from 'node-cron'` — no new import required.

---

### `src/scheduler/jobs.ts` — durationMs tracking in executePriceCollection

**Analog:** `src/scheduler/jobs.ts` lines 74–164 (existing `executePriceCollection` body)

**Return type change** (lines 74–79, current):
```typescript
export async function executePriceCollection(): Promise<{
  total: number
  fetched: number
  skipped: number
  failed: number
}> {
```
Updated to:
```typescript
export async function executePriceCollection(): Promise<{
  total: number
  fetched: number
  skipped: number
  failed: number
  durationMs: number
}> {
```

**startTime capture** — add as first line of function body (before the `isRunning` check at line 81):
```typescript
const startTime = Date.now()
```

**Early return path** (lines 81–89, current):
```typescript
if (isRunning) {
  logger.warn('Price collection already running, skipping this execution')
  return {
    total: 0,
    fetched: 0,
    skipped: 0,
    failed: 0,
  }
}
```
Updated to (durationMs: 0 on early return, per D-05 and Claude's discretion):
```typescript
if (isRunning) {
  logger.warn('Price collection already running, skipping this execution')
  return {
    total: 0,
    fetched: 0,
    skipped: 0,
    failed: 0,
    durationMs: 0,
  }
}
```

**No-cards early return** (lines 99–106, current):
```typescript
if (cardIds.length === 0) {
  logger.warn('No monitored cards found in database')
  return {
    total: 0,
    fetched: 0,
    skipped: 0,
    failed: 0,
  }
}
```
Updated to include `durationMs`:
```typescript
if (cardIds.length === 0) {
  logger.warn('No monitored cards found in database')
  const durationMs = Date.now() - startTime
  logger.info(`Price collection took ${durationMs}ms`)
  return {
    total: 0,
    fetched: 0,
    skipped: 0,
    failed: 0,
    durationMs,
  }
}
```

**Success return path** (lines 147–152, current):
```typescript
return {
  total: cardIds.length,
  fetched: stats.fetched,
  skipped: stats.skipped,
  failed: stats.failed,
}
```
Updated to:
```typescript
const durationMs = Date.now() - startTime
logger.info(`Price collection took ${durationMs}ms`)
return {
  total: cardIds.length,
  fetched: stats.fetched,
  skipped: stats.skipped,
  failed: stats.failed,
  durationMs,
}
```

**Error catch return** (lines 154–160, current):
```typescript
} catch (error) {
  logger.error(`Critical error during price collection: ${error}`)
  return {
    total: 0,
    fetched: 0,
    skipped: 0,
    failed: 1,
  }
}
```
Updated to:
```typescript
} catch (error) {
  logger.error(`Critical error during price collection: ${error}`)
  const durationMs = Date.now() - startTime
  logger.info(`Price collection took ${durationMs}ms`)
  return {
    total: 0,
    fetched: 0,
    skipped: 0,
    failed: 1,
    durationMs,
  }
}
```

Note: `durationMs` is declared with `const` at each return site independently (they are in mutually exclusive branches), so no `let` declaration is needed.

---

## Shared Patterns

### Dynamic Import for Env-Var-Sensitive Tests
**Source:** `src/scheduler/__tests__/jobs.test.ts` lines 52–63, 65–77, 79–84
**Apply to:** All 3 `schedulePriceCollection` test bodies; orchestration/error/duration tests in `executePriceCollection`
```typescript
// Pattern: set env vars BEFORE the dynamic import; import inside it() body
it('...', async () => {
  process.env.CRON_MORNING = '0 6 * * *'              // set first
  const { schedulePriceCollection } = await import('../jobs')  // then import
  const cronModule = await import('node-cron')
  // ... assertions
})
```

### vi.clearAllMocks() in beforeEach
**Source:** `src/scheduler/__tests__/jobs.test.ts` line 47
**Apply to:** All new describe blocks except the nested concurrency describe (which uses `vi.resetModules()` instead)
```typescript
beforeEach(() => {
  vi.clearAllMocks()
})
```

### vi.resetModules() + vi.doMock() for Module-Level State Reset
**Source:** `src/scraper/__tests__/orchestrator.test.ts` lines 32–54
**Apply to:** Nested `describe('concurrent executions')` beforeEach only
```typescript
// After resetModules(), vi.mock() hoisted declarations are cleared from cache.
// Re-register all dependencies with vi.doMock() before the dynamic re-import.
beforeEach(() => {
  vi.resetModules()
  vi.doMock('dep', () => ({ ... }))
})
// Then inside the test:
const { fn } = await import('../jobs')  // fresh module, isRunning = false
```

### biome-ignore lint comment for process.env delete
**Source:** `src/scheduler/__tests__/jobs.test.ts` line 48–49
**Apply to:** All env var deletions in beforeEach
```typescript
// biome-ignore lint/performance/noDelete: process.env requires delete to truly unset a var
delete process.env.CRON_MORNING
```

---

## No Analog Found

None. All files in scope have direct analogs within the same files — the patterns are established by the already-passing `scheduleMetagameRefresh` tests and the existing `executePriceCollection` / `schedulePriceCollection` implementations.

---

## Metadata

**Analog search scope:** `src/scheduler/`, `src/scraper/__tests__/`
**Files scanned:** 4 (`jobs.test.ts`, `jobs.ts`, `index.ts`, `orchestrator.test.ts`)
**Pattern extraction date:** 2026-05-13
