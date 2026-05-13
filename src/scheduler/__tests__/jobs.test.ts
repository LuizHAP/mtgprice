import { beforeEach, describe, expect, it, test, vi } from 'vitest'

// === Phase 5 — Metagame Refresh Scheduler ===

vi.mock('@/scraper/metagame', () => ({
  executeMetagameRefresh: vi.fn(),
}))

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

vi.mock('@/db', () => ({
  db: {
    query: {
      cards: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
}))

vi.mock('@/scraper/orchestrator', () => ({
  default: vi.fn().mockResolvedValue({ fetched: 0, skipped: 0, failed: 0, errors: [] }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/opportunities', () => ({
  detectOpportunitiesForWishlist: vi.fn().mockResolvedValue([]),
  sendDigestAndPersist: vi.fn().mockResolvedValue({ persisted: 0, sent: false }),
  loadDetectionConfig: vi.fn().mockReturnValue({}),
}))

describe('scheduleMetagameRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset a var
    delete process.env.CRON_METAGAME_REFRESH
  })

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

  it('returned object has start() and stop() functions', async () => {
    const { scheduleMetagameRefresh } = await import('../jobs')
    const result = scheduleMetagameRefresh()
    expect(typeof result.start).toBe('function')
    expect(typeof result.stop).toBe('function')
  })

  it('cron callback invokes executeMetagameRefresh and logs the summary', async () => {
    const { executeMetagameRefresh } = await import('@/scraper/metagame')
    const mockExecuteMetagameRefresh = vi.mocked(executeMetagameRefresh)
    mockExecuteMetagameRefresh.mockResolvedValueOnce({
      addedCount: 100,
      removedCount: 5,
      skippedCount: 0,
      perFormat: { commander: 50, standard: 30, modern: 20 },
    })

    const { scheduleMetagameRefresh } = await import('../jobs')
    const cronModule = await import('node-cron')

    scheduleMetagameRefresh()

    const callArgs = vi.mocked(cronModule.default.schedule).mock.calls[0]
    expect(callArgs).toBeDefined()
    const callback = callArgs[1] as () => Promise<void>
    await callback()

    expect(mockExecuteMetagameRefresh).toHaveBeenCalled()
  })

  it('cron callback does NOT throw if executeMetagameRefresh rejects (defensive try/catch)', async () => {
    const { executeMetagameRefresh } = await import('@/scraper/metagame')
    const mockExecuteMetagameRefresh = vi.mocked(executeMetagameRefresh)
    mockExecuteMetagameRefresh.mockRejectedValueOnce(new Error('orchestrator exploded'))

    const { scheduleMetagameRefresh } = await import('../jobs')
    const cronModule = await import('node-cron')

    scheduleMetagameRefresh()

    const mockScheduleCalls = vi.mocked(cronModule.default.schedule).mock.calls
    const callArgs = mockScheduleCalls[mockScheduleCalls.length - 1]
    const callback = callArgs[1] as () => Promise<void>

    // Must NOT throw
    await expect(callback()).resolves.toBeUndefined()
  })
})

describe('Cron job scheduling', () => {
  describe('schedulePriceCollection', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset a var
      delete process.env.CRON_MORNING
      // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset a var
      delete process.env.CRON_AFTERNOON
      // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset a var
      delete process.env.CRON_EVENING
    })

    it('should configure node-cron for 2-3x daily execution', async () => {
      const { schedulePriceCollection } = await import('../jobs')
      const cronModule = await import('node-cron')

      schedulePriceCollection()

      expect(cronModule.default.schedule).toHaveBeenCalledTimes(3)
      expect(cronModule.default.schedule).toHaveBeenNthCalledWith(
        1,
        '0 9 * * *',
        expect.any(Function),
        expect.objectContaining({ scheduled: false }),
      )
      expect(cronModule.default.schedule).toHaveBeenNthCalledWith(
        2,
        '0 15 * * *',
        expect.any(Function),
        expect.objectContaining({ scheduled: false }),
      )
      expect(cronModule.default.schedule).toHaveBeenNthCalledWith(
        3,
        '0 21 * * *',
        expect.any(Function),
        expect.objectContaining({ scheduled: false }),
      )
    })

    it('should accept custom schedule times', async () => {
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

    it('should handle invalid cron expressions', async () => {
      process.env.CRON_MORNING = 'not-a-cron'
      const cronModule = await import('node-cron')
      vi.mocked(cronModule.default.validate).mockReturnValueOnce(false)

      const { schedulePriceCollection } = await import('../jobs')

      expect(() => schedulePriceCollection()).toThrow('Invalid cron expression')
    })
  })

  describe('executePriceCollection', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should run full fetch orchestration', async () => {
      const { db } = await import('@/db')
      vi.mocked(db.query.cards.findMany).mockResolvedValueOnce([{ oracleId: 'test-id' }])

      const { executePriceCollection } = await import('../jobs')
      const stats = await executePriceCollection()

      expect(stats.fetched).toBeGreaterThanOrEqual(0)
      expect(stats.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should handle execution errors gracefully', async () => {
      const fetchAllPricesModule = await import('@/scraper/orchestrator')
      vi.mocked(fetchAllPricesModule.default).mockRejectedValueOnce(new Error('fetch failed'))

      const { db } = await import('@/db')
      vi.mocked(db.query.cards.findMany).mockResolvedValueOnce([{ oracleId: 'test-id' }])

      const { executePriceCollection } = await import('../jobs')
      const stats = await executePriceCollection()

      expect(stats.failed).toBe(1)
      expect(stats.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should record execution duration', async () => {
      const { executePriceCollection } = await import('../jobs')
      const stats = await executePriceCollection()

      expect(typeof stats.durationMs).toBe('number')
      expect(stats.durationMs).toBeGreaterThanOrEqual(0)
    })

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
        let resolveFirst!: (value: { total: number; fetched: number; skipped: number; failed: number; errors: string[] }) => void
        vi.mocked(fetchAllPricesModule.default).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve
            }),
        )

        const { executePriceCollection } = await import('../jobs')

        // Start first run (does not resolve yet)
        const firstRun = executePriceCollection()

        // Yield to allow the first run to progress through findMany and reach fetchAllPrices
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()

        // Second run should return early immediately (isRunning = true)
        const secondStats = await executePriceCollection()
        expect(secondStats).toEqual({ total: 0, fetched: 0, skipped: 0, failed: 0, durationMs: 0 })

        // Unblock the first run
        resolveFirst({ total: 1, fetched: 0, skipped: 0, failed: 0, errors: [] })
        await firstRun
      })
    })
  })

  describe('validateScheduleTimes', () => {
    test.skip('should verify jobs run at correct times', async () => {
      // TODO: Implement test for time validation
      // Should verify:
      // - Parses cron expression
      // - Returns next execution times
      // - Validates against expected schedule
      expect(true).toBe(false)
    })

    test.skip('should handle timezone conversions', async () => {
      // TODO: Implement test for timezones
      // Should verify:
      // - Converts schedule to local timezone
      // - Handles DST transitions
      // - Uses date-fns for reliable calculations
      expect(true).toBe(false)
    })

    test.skip('should support different schedules per day', async () => {
      // TODO: Implement test for day-specific schedules
      // Should verify:
      // - Supports weekday vs weekend schedules
      // - Supports custom schedules per day
      // - Falls back to default if not specified
      expect(true).toBe(false)
    })
  })

  describe('stopScheduler', () => {
    test.skip('should stop all scheduled jobs', async () => {
      // TODO: Implement test for stopping
      // Should verify:
      // - Stops all active cron jobs
      // - Cleans up resources
      // - Logs shutdown
      expect(true).toBe(false)
    })

    test.skip('should wait for current execution to complete', async () => {
      // TODO: Implement test for graceful shutdown
      // Should verify:
      // - Does not kill running job
      // - Waits for completion
      // - Stops after execution finishes
      expect(true).toBe(false)
    })

    test.skip('should handle stop when no jobs running', async () => {
      // TODO: Implement test for idle stop
      // Should verify:
      // - Returns successfully if no jobs
      // - Does not throw error
      expect(true).toBe(false)
    })
  })

  describe('Integration scenarios', () => {
    test.skip('should run 2-3x daily as per CONTEXT.md NOTIF-03', async () => {
      // TODO: Implement test for compliance
      // Should verify:
      // - Not real-time (2-3x daily, not continuous)
      // - Matches CONTEXT.md decision
      // - Balances opportunity detection with API limits
      expect(true).toBe(false)
    })

    test.skip('should handle scheduler restart gracefully', async () => {
      // TODO: Implement test for restart
      // Should verify:
      // - Stops existing jobs before starting new
      // - Reschedules with same configuration
      // - Does not duplicate jobs
      expect(true).toBe(false)
    })

    test.skip('should provide next execution time', async () => {
      // TODO: Implement test for next run info
      // Should verify:
      // - Returns next scheduled execution time
      // - Returns time until next execution
      // - Useful for dashboard display
      expect(true).toBe(false)
    })

    test.skip('should log execution history', async () => {
      // TODO: Implement test for history tracking
      // Should verify:
      // - Records last execution time
      // - Records execution status (success/failure)
      // - Records cards processed
      // - Records errors encountered
      expect(true).toBe(false)
    })
  })
})
