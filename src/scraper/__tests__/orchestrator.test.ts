import pLimit from 'p-limit'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { handleSourceFailure } from '@/scraper/orchestrator'
import { logger } from '@/lib/logger'

// Top-level mock for logger (Pattern E) — needed by handleSourceFailure tests
// vi.mock is hoisted by Vitest before imports, so mocking runs before the module loads
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('fetchAllPrices concurrency (Phase 6 / D-08)', () => {
  test('caps in-flight executions at SCRAPER_CONCURRENCY_PER_SOURCE', async () => {
    // Verify p-limit itself enforces the cap — this is the unit-level test
    // for the concurrency mechanism used by fetchAllPrices.
    const concurrency = 3
    const limit = pLimit(concurrency)

    let inFlight = 0
    let maxInFlight = 0

    const tasks = Array.from({ length: 12 }, () =>
      limit(async () => {
        inFlight++
        if (inFlight > maxInFlight) maxInFlight = inFlight
        await new Promise((r) => setTimeout(r, 10))
        inFlight--
      }),
    )

    await Promise.all(tasks)

    expect(maxInFlight).toBeLessThanOrEqual(concurrency)
    expect(maxInFlight).toBeGreaterThan(1) // proves it's not sequential
  })

  test('preserves FetchAllPricesStats return shape', async () => {
    // Mock dependencies that fetchCardPriceFromAllSources uses so we can
    // drive fetchAllPrices end-to-end and verify the stats shape.
    vi.resetModules()
    vi.doMock('@/scraper/smart-refresh', () => ({
      shouldFetchPrice: vi.fn().mockResolvedValue(true),
    }))
    vi.doMock('@/scraper/providers/liga-magic', () => ({
      fetchCardPrice: vi.fn().mockResolvedValue(10),
    }))
    vi.doMock('@/scraper/providers/tcgplayer', () => ({
      fetchCardPrice: vi.fn().mockResolvedValue(null),
    }))
    vi.doMock('@/scraper/providers/cardmarket', () => ({
      fetchCardPrice: vi.fn().mockResolvedValue(null),
    }))
    vi.doMock('@/scraper/providers/cardkingdom', () => ({
      fetchCardPrice: vi.fn().mockResolvedValue(null),
    }))
    vi.doMock('@/db/queries/prices', () => ({
      insertPrice: vi.fn().mockResolvedValue(undefined),
    }))
    vi.doMock('@/lib/currency', () => ({
      convertToBRL: vi.fn().mockResolvedValue(50),
    }))
    const { fetchAllPrices } = await import('@/scraper/orchestrator')
    const stats = await fetchAllPrices(['a', 'b'])
    expect(stats).toMatchObject({
      total: 2,
      fetched: expect.any(Number),
      skipped: expect.any(Number),
      failed: expect.any(Number),
      errors: expect.any(Array),
    })
    expect(stats.total).toBe(2)
    expect(typeof stats.fetched).toBe('number')
    expect(Array.isArray(stats.errors)).toBe(true)
    vi.resetModules()
  })
})

describe('orchestrator retry-then-circuit-breaker ordering (Phase 6 / D-06)', () => {
  test('imports withRetry from @/lib/retry', async () => {
    // Smoke test: the orchestrator module must import withRetry.
    // Read the source as text rather than via reflection (no runtime API).
    const fs = await import('node:fs/promises')
    const src = await fs.readFile('src/scraper/orchestrator.ts', 'utf8')
    expect(src).toMatch(/import\s+\{\s*withRetry\s*\}\s+from\s+['"]@\/lib\/retry['"]/)
  })

  test('imports pLimit from p-limit', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile('src/scraper/orchestrator.ts', 'utf8')
    expect(src).toMatch(/import\s+pLimit\s+from\s+['"]p-limit['"]/)
  })

  test('composes raw fetch through withRetry BEFORE wrapWithCircuitBreaker (D-06 order)', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile('src/scraper/orchestrator.ts', 'utf8')
    // The composeReliable helper must call withRetry inside a function passed to wrapWithCircuitBreaker.
    expect(src).toMatch(/withRetry\s*\(/)
    expect(src).toMatch(/wrapWithCircuitBreaker\s*\(/)
    // Order check: in the composeReliable helper, withRetry must appear before wrapWithCircuitBreaker.
    const composeIdx = src.indexOf('composeReliable')
    const retryIdx = src.indexOf('withRetry', composeIdx)
    const breakerIdx = src.indexOf('wrapWithCircuitBreaker', composeIdx)
    expect(retryIdx).toBeGreaterThan(-1)
    expect(breakerIdx).toBeGreaterThan(-1)
    expect(retryIdx).toBeLessThan(breakerIdx)
  })
})

describe('Fetch orchestration', () => {
  describe('orchestrateFetch', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('should fetch Liga Magic first (BR data priority)', async () => {
      vi.resetModules()
      vi.doMock('@/scraper/smart-refresh', () => ({
        shouldFetchPrice: vi.fn().mockResolvedValue(true),
      }))
      vi.doMock('@/scraper/providers/liga-magic', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(10),
      }))
      vi.doMock('@/scraper/providers/tcgplayer', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(null),
      }))
      vi.doMock('@/scraper/providers/cardmarket', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(null),
      }))
      vi.doMock('@/scraper/providers/cardkingdom', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(null),
      }))
      vi.doMock('@/db/queries/prices', () => ({
        insertPrice: vi.fn().mockResolvedValue(undefined),
      }))
      vi.doMock('@/lib/currency', () => ({
        convertToBRL: vi.fn().mockResolvedValue(50),
      }))
      const { orchestrateFetch } = await import('@/scraper/orchestrator')
      const results = await orchestrateFetch('test-oracle-id')
      expect(results.ligamagic.success).toBe(true)
      expect(results.ligamagic.price).toBe(10)
      vi.resetModules()
    })

    test('should fetch international sources in parallel', async () => {
      vi.resetModules()
      vi.doMock('@/scraper/smart-refresh', () => ({
        shouldFetchPrice: vi.fn().mockResolvedValue(true),
      }))
      const ligaMagicMock = vi.fn().mockResolvedValue(10)
      const tcgPlayerMock = vi.fn().mockResolvedValue(20)
      const cardMarketMock = vi.fn().mockResolvedValue(15)
      const cardKingdomMock = vi.fn().mockResolvedValue(18)
      vi.doMock('@/scraper/providers/liga-magic', () => ({
        fetchCardPrice: ligaMagicMock,
      }))
      vi.doMock('@/scraper/providers/tcgplayer', () => ({
        fetchCardPrice: tcgPlayerMock,
      }))
      vi.doMock('@/scraper/providers/cardmarket', () => ({
        fetchCardPrice: cardMarketMock,
      }))
      vi.doMock('@/scraper/providers/cardkingdom', () => ({
        fetchCardPrice: cardKingdomMock,
      }))
      vi.doMock('@/db/queries/prices', () => ({
        insertPrice: vi.fn().mockResolvedValue(undefined),
      }))
      vi.doMock('@/lib/currency', () => ({
        convertToBRL: vi.fn().mockResolvedValue(50),
      }))
      const { orchestrateFetch } = await import('@/scraper/orchestrator')
      const results = await orchestrateFetch('test-oracle-id')
      expect(results.tcgplayer.success).toBe(true)
      expect(results.cardmarket.success).toBe(true)
      expect(results.cardkingdom.success).toBe(true)
      vi.resetModules()
    })

    test('should continue if one international source fails', async () => {
      vi.resetModules()
      vi.doMock('@/scraper/smart-refresh', () => ({
        shouldFetchPrice: vi.fn().mockResolvedValue(true),
      }))
      vi.doMock('@/scraper/providers/liga-magic', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(10),
      }))
      vi.doMock('@/scraper/providers/tcgplayer', () => ({
        fetchCardPrice: vi.fn().mockRejectedValue(new Error('TCGPlayer unavailable')),
      }))
      vi.doMock('@/scraper/providers/cardmarket', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(15),
      }))
      vi.doMock('@/scraper/providers/cardkingdom', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(18),
      }))
      vi.doMock('@/db/queries/prices', () => ({
        insertPrice: vi.fn().mockResolvedValue(undefined),
      }))
      vi.doMock('@/lib/currency', () => ({
        convertToBRL: vi.fn().mockResolvedValue(50),
      }))
      const { orchestrateFetch } = await import('@/scraper/orchestrator')
      const results = await orchestrateFetch('test-oracle-id')
      expect(results.ligamagic.success).toBe(true)
      expect(results.cardmarket.success).toBe(true)
      expect(results.cardkingdom.success).toBe(true)
      expect(results.tcgplayer.success).toBe(false)
      expect(results.tcgplayer.error).toBeTruthy()
      vi.resetModules()
    })

    test('should handle complete Liga Magic failure gracefully', async () => {
      vi.resetModules()
      vi.doMock('@/scraper/smart-refresh', () => ({
        shouldFetchPrice: vi.fn().mockResolvedValue(true),
      }))
      vi.doMock('@/scraper/providers/liga-magic', () => ({
        fetchCardPrice: vi.fn().mockRejectedValue(new Error('Liga Magic down')),
      }))
      vi.doMock('@/scraper/providers/tcgplayer', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(20),
      }))
      vi.doMock('@/scraper/providers/cardmarket', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(15),
      }))
      vi.doMock('@/scraper/providers/cardkingdom', () => ({
        fetchCardPrice: vi.fn().mockResolvedValue(18),
      }))
      vi.doMock('@/db/queries/prices', () => ({
        insertPrice: vi.fn().mockResolvedValue(undefined),
      }))
      vi.doMock('@/lib/currency', () => ({
        convertToBRL: vi.fn().mockResolvedValue(50),
      }))
      const { orchestrateFetch } = await import('@/scraper/orchestrator')
      const results = await orchestrateFetch('test-oracle-id')
      expect(results.ligamagic.success).toBe(false)
      expect(results.ligamagic.error).toBeTruthy()
      expect(results.tcgplayer.success).toBe(true)
      expect(results.cardmarket.success).toBe(true)
      expect(results.cardkingdom.success).toBe(true)
      vi.resetModules()
    })
  })

  describe('handleSourceFailure', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('should log error with source context', () => {
      const result = handleSourceFailure('tcgplayer', 'oracle-abc', new Error('boom'))
      expect(result).toEqual({ success: false, error: 'boom' })
      expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(1)
      const callArg = vi.mocked(logger.error).mock.calls[0]?.[0] as string
      expect(callArg).toContain('tcgplayer')
      expect(callArg).toContain('oracle-abc')
      expect(callArg).toContain('boom')
    })

    test('should continue with remaining sources', () => {
      expect(() => handleSourceFailure('cardmarket', 'oracle-xyz', new Error('network down'))).not.toThrow()
      const result = handleSourceFailure('cardmarket', 'oracle-xyz', new Error('network down'))
      expect(result.success).toBe(false)
      expect(result.error).toBe('network down')
    })

    test('should track failure count per source', () => {
      handleSourceFailure('tcgplayer', 'oracle-1', new Error('err1'))
      handleSourceFailure('tcgplayer', 'oracle-2', new Error('err2'))
      expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(2)
      const call1 = vi.mocked(logger.error).mock.calls[0]?.[0] as string
      const call2 = vi.mocked(logger.error).mock.calls[1]?.[0] as string
      expect(call1).toContain('tcgplayer')
      expect(call2).toContain('tcgplayer')
    })
  })

  describe('applyRateLimiting', () => {
    test.skip('should respect rate limits per source', async () => {
      // TODO: Implement test for rate limit enforcement
      // Should verify:
      // - Liga Magic: 50 req/min (80% of unknown limit)
      // - TCGPlayer: 40 req/min (80% of 50 req/min)
      // - CardMarket: 40 req/min (80% of 50 req/min)
      // - CardKingdom: 40 req/min (80% of 50 req/min)
      expect(true).toBe(false)
    })

    test.skip('should wait between requests to same source', async () => {
      // TODO: Implement test for request spacing
      // Should verify:
      // - Calculates delay based on rate limit
      // - Waits before next request to same source
      // - Does not block other sources
      expect(true).toBe(false)
    })

    test.skip('should handle rate limit errors (429)', async () => {
      // TODO: Implement test for 429 handling
      // Should verify:
      // - Detects 429 status
      // - Implements exponential backoff
      // - Retries request after backoff
      expect(true).toBe(false)
    })
  })

  describe('aggregateResults', () => {
    test.skip('should collect prices from all successful sources', async () => {
      // TODO: Implement test for result aggregation
      // Should verify:
      // - Returns array of price objects
      // - Includes card_id, source, price_brl, timestamp
      // - Filters out null results
      expect(true).toBe(false)
    })

    test.skip('should deduplicate prices from same source', async () => {
      // TODO: Implement test for deduplication
      // Should verify:
      // - One price per (card_id, source) pair
      // - Uses latest timestamp if duplicates exist
      expect(true).toBe(false)
    })

    test.skip('should handle partial results (some sources failed)', async () => {
      // TODO: Implement test for partial results
      // Should verify:
      // - Returns successful prices
      // - Logs which sources failed
      // - Does not fail entire orchestration
      expect(true).toBe(false)
    })

    test.skip('should return empty array if all sources fail', async () => {
      // TODO: Implement test for total failure
      // Should verify:
      // - Returns empty array
      // - Logs critical error
      // - Does not throw exception
      expect(true).toBe(false)
    })
  })

  describe('batchOrchestrateFetch', () => {
    test.skip('should orchestrate fetch for multiple cards efficiently', async () => {
      // TODO: Implement test for batch orchestration
      // Should verify:
      // - Processes cards in batches
      // - Respects rate limits across batches
      // - Completes within reasonable time
      expect(true).toBe(false)
    })

    test.skip('should parallelize across cards within rate limits', async () => {
      // TODO: Implement test for parallelization
      // Should verify:
      // - Fetches multiple cards concurrently
      // - Respects per-source rate limits
      // - Maximizes throughput without exceeding limits
      expect(true).toBe(false)
    })

    test.skip('should provide progress updates for large batches', async () => {
      // TODO: Implement test for progress reporting
      // Should verify:
      // - Logs progress percentage
      // - Logs estimated completion time
      // - Logs current card being processed
      expect(true).toBe(false)
    })
  })

  describe('Integration scenarios', () => {
    test.skip('should fetch single card from all sources', async () => {
      // TODO: Implement test for single card
      // Should verify:
      // - Fetches from Liga Magic (sequential)
      // - Fetches from TCGPlayer, CardMarket, CardKingdom (parallel)
      // - Returns array of 4 price objects
      expect(true).toBe(false)
    })

    test.skip('should handle mixed success/failure across sources', async () => {
      // TODO: Implement test for mixed results
      // Should verify:
      // - Liga Magic succeeds, TCGPlayer fails
      // - CardMarket succeeds, CardKingdom fails
      // - Returns 2 price objects (Liga Magic, CardMarket)
      expect(true).toBe(false)
    })

    test.skip('should complete large batch within time budget', async () => {
      // TODO: Implement test for performance
      // Should verify:
      // - Processes 1000 cards
      // - Completes within reasonable time (e.g., 30 minutes)
      // - Respects all rate limits
      expect(true).toBe(false)
    })
  })
})
