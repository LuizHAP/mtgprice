import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the DB module
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      cards: {
        findFirst: vi.fn(),
      },
    },
  },
}))

// Mock the wishlist queries
vi.mock('@/lib/wishlist/queries', () => ({
  getUserWishlist: vi.fn(),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock the detector
vi.mock('@/lib/opportunities/detector', () => ({
  evaluateCandidate: vi.fn(),
}))

import { db } from '@/db'
import { logger } from '@/lib/logger'
import { evaluateCandidate } from '@/lib/opportunities/detector'
import { getUserWishlist } from '@/lib/wishlist/queries'
import type { DetectionConfig } from '../config'
import {
  deleteCandidate,
  deleteStaleCandidates,
  detectOpportunitiesForWishlist,
  getRecentOpportunities,
  insertCandidate,
  insertOpportunity,
} from '../queries'

const baseConfig: DetectionConfig = {
  dropThreshold: 0.15,
  lookbackDays: 7,
  baselineDays: 30,
  cooldownDays: 7,
  minHistoryDays: 30,
  cronMorning: '0 9 * * *',
  cronAfternoon: '0 15 * * *',
  cronEvening: '0 21 * * *',
  runTimesHuman: '09:00, 15:00, 21:00',
}

const mockCard = {
  oracleId: 'oracle-1',
  name: 'Lightning Bolt',
  set: 'M10',
  rarity: 'common',
  color: 'R',
  imageUrl: null,
  addedAt: new Date('2026-01-01'),
}

// Helper to create a chainable Drizzle-like mock builder
function createSelectBuilder(returnValue: unknown) {
  const builder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(returnValue),
    innerJoin: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(returnValue),
  }
  // Make from return the whole builder so .where etc work
  builder.from.mockReturnValue(builder)
  builder.where.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.innerJoin.mockReturnValue(builder)
  return builder
}

function createInsertBuilder(returnValue: unknown) {
  const builder = {
    into: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnValue),
    execute: vi.fn().mockResolvedValue(returnValue),
  }
  builder.into.mockReturnValue(builder)
  builder.values.mockReturnValue(builder)
  builder.onConflictDoNothing.mockReturnValue(builder)
  return builder
}

function createDeleteBuilder(returnValue: unknown) {
  const builder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnValue),
    execute: vi.fn().mockResolvedValue(returnValue),
  }
  builder.from.mockReturnValue(builder)
  builder.where.mockReturnValue(builder)
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('detectOpportunitiesForWishlist', () => {
  it('Test 1: evaluateCandidate is called once per (wishlist card × 4 sources) when none in cooldown', async () => {
    const mockWishlist = [mockCard]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    // isInCooldown: no rows → not in cooldown
    const selectBuilder = createSelectBuilder([])
    vi.mocked(db.select).mockReturnValue(selectBuilder as ReturnType<typeof db.select>)

    // deleteStaleCandidates → 0 deleted
    const deleteBuilder = createDeleteBuilder([])
    vi.mocked(db.delete).mockReturnValue(deleteBuilder as ReturnType<typeof db.delete>)

    // evaluateCandidate → does not fire
    vi.mocked(evaluateCandidate).mockReturnValue({ fires: false, dropPercent: null, reason: 'cold_start' })

    await detectOpportunitiesForWishlist(1, baseConfig)

    // 1 card × 4 sources = 4 calls
    expect(evaluateCandidate).toHaveBeenCalledTimes(4)
  })

  it('Test 2: isInCooldown true → evaluateCandidate NOT called for that pair', async () => {
    const mockWishlist = [mockCard]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    // isInCooldown: returns 1 row → in cooldown
    const selectBuilder = createSelectBuilder([{ id: 1 }])
    vi.mocked(db.select).mockReturnValue(selectBuilder as ReturnType<typeof db.select>)

    // deleteStaleCandidates
    const deleteBuilder = createDeleteBuilder([])
    vi.mocked(db.delete).mockReturnValue(deleteBuilder as ReturnType<typeof db.delete>)

    await detectOpportunitiesForWishlist(1, baseConfig)

    // evaluateCandidate should NOT be called (all 4 sources in cooldown)
    expect(evaluateCandidate).not.toHaveBeenCalled()
    // deleteCandidate should NOT be called either
    // We check via the delete mock — only stale cleanup should be called
  })

  it('Test 3 (D-07 Branch A): evaluateCandidate fires=false → deleteCandidate called, insertCandidate NOT called, NOT in result', async () => {
    const mockWishlist = [{ ...mockCard, oracleId: 'oracle-A' }]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    // isInCooldown → no cooldown
    const selectCooldownBuilder = createSelectBuilder([])

    // getCandidate → null (no existing candidate)
    const selectCandidateBuilder = createSelectBuilder([])

    let selectCallCount = 0
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++
      // First calls are stale + cooldown checks; subsequent are getCandidate
      return selectCooldownBuilder as ReturnType<typeof db.select>
    })

    vi.mocked(evaluateCandidate).mockReturnValue({ fires: false, dropPercent: null, reason: 'cold_start' })

    const deleteBuilder = createDeleteBuilder([])
    vi.mocked(db.delete).mockReturnValue(deleteBuilder as ReturnType<typeof db.delete>)

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    // Should have called delete (for deleteCandidate per pair + stale cleanup)
    expect(db.delete).toHaveBeenCalled()
    // Should NOT have called insert (no insertCandidate)
    expect(db.insert).not.toHaveBeenCalled()
    // Result should be empty (no promotions)
    expect(results).toHaveLength(0)
  })

  it('Test 4 (D-07 Branch B): evaluateCandidate fires=true, getCandidate=null → insertCandidate called, NOT promoted', async () => {
    const mockWishlist = [{ ...mockCard, oracleId: 'oracle-B' }]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    // All selects: cooldown returns [], candidate returns []
    const selectBuilder = createSelectBuilder([])
    vi.mocked(db.select).mockReturnValue(selectBuilder as ReturnType<typeof db.select>)

    vi.mocked(evaluateCandidate).mockReturnValue({ fires: true, dropPercent: 20.0 })

    // deleteStaleCandidates + deleteCandidate
    const deleteBuilder = createDeleteBuilder([])
    vi.mocked(db.delete).mockReturnValue(deleteBuilder as ReturnType<typeof db.delete>)

    // insertCandidate
    const insertBuilder = createInsertBuilder([])
    vi.mocked(db.insert).mockReturnValue(insertBuilder as ReturnType<typeof db.insert>)

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    // insertCandidate should have been called (4 times for 4 sources — all first-time candidates)
    expect(db.insert).toHaveBeenCalled()
    // No promotion on first confirming run
    expect(results).toHaveLength(0)
  })

  it('Test 5 (D-07 Branch C): evaluateCandidate fires=true, getCandidate returns existing → promoted + deleteCandidate called', async () => {
    const mockWishlist = [{ ...mockCard, oracleId: 'oracle-C', name: 'Black Lotus' }]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    const existingCandidate = { id: 42, firstSeenAt: new Date('2026-04-10T15:00:00Z') }

    // First calls (cooldown) → empty; subsequent (getCandidate) → existing
    let selectCallIdx = 0
    vi.mocked(db.select).mockImplementation(() => {
      selectCallIdx++
      // cooldown calls return empty (no cooldown)
      // getCandidate calls return existing
      // We'll alternate based on call index within the chain
      const result = selectCallIdx % 2 === 0 ? [existingCandidate] : []
      const builder = createSelectBuilder(result)
      return builder as ReturnType<typeof db.select>
    })

    // getLatestPrice, getBaselineMean, getPriceSevenDaysAgo, getHistoryDaysForPair all need select too
    // Let's use a simpler approach: mock all selects to return values that make things work
    // Re-mock to always return existingCandidate for candidate lookups
    const cooldownEmpty = createSelectBuilder([])
    const candidateExists = createSelectBuilder([existingCandidate])
    const priceRow = createSelectBuilder([
      { priceBrl: '5200', avg: '5500', timestamp: new Date(), count: 45 },
    ])
    const historyRow = createSelectBuilder([{ days: 45 }])

    vi.mocked(db.select).mockReturnValue(candidateExists as ReturnType<typeof db.select>)

    vi.mocked(evaluateCandidate).mockReturnValue({ fires: true, dropPercent: 20.0 })

    const deleteBuilder = createDeleteBuilder([])
    vi.mocked(db.delete).mockReturnValue(deleteBuilder as ReturnType<typeof db.delete>)

    const insertBuilder = createInsertBuilder([])
    vi.mocked(db.insert).mockReturnValue(insertBuilder as ReturnType<typeof db.insert>)

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    // deleteCandidate should have been called (promotion consumes candidate)
    expect(db.delete).toHaveBeenCalled()
    // Should have at least 1 promoted opportunity
    expect(results.length).toBeGreaterThan(0)
    // Check the shape of the first promoted result
    if (results.length > 0) {
      expect(results[0]).toMatchObject({
        cardId: 'oracle-C',
        cardName: 'Black Lotus',
        source: expect.stringMatching(/ligamagic|tcgplayer|cardmarket|cardkingdom/),
        dropPercent: 20.0,
      })
    }
  })

  it('Test 6 (D-07 Branch D): deleteStaleCandidates is called exactly once per orchestrator invocation', async () => {
    vi.mocked(getUserWishlist).mockResolvedValue([])

    const deleteBuilder = createDeleteBuilder([])
    vi.mocked(db.delete).mockReturnValue(deleteBuilder as ReturnType<typeof db.delete>)

    await detectOpportunitiesForWishlist(1, baseConfig)

    // db.delete should have been called exactly once (for stale cleanup)
    expect(db.delete).toHaveBeenCalledTimes(1)
  })

  it('Test 7 (Multi-source): 2 sources promoted for same card yields 2 opportunities', async () => {
    const mockWishlist = [{ ...mockCard, oracleId: 'oracle-multi', name: 'Mox Pearl' }]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    const existingCandidate = { id: 99, firstSeenAt: new Date('2026-04-10') }

    // All selects return existing candidate (simulates second run)
    const candidateBuilder = createSelectBuilder([existingCandidate])
    vi.mocked(db.select).mockReturnValue(candidateBuilder as ReturnType<typeof db.select>)

    vi.mocked(evaluateCandidate).mockReturnValue({ fires: true, dropPercent: 22.5 })

    const deleteBuilder = createDeleteBuilder([])
    vi.mocked(db.delete).mockReturnValue(deleteBuilder as ReturnType<typeof db.delete>)

    const insertBuilder = createInsertBuilder([])
    vi.mocked(db.insert).mockReturnValue(insertBuilder as ReturnType<typeof db.insert>)

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    // 4 sources, all promoted → 4 opportunities
    expect(results).toHaveLength(4)
    const sources = results.map((r) => r.source)
    expect(sources).toContain('ligamagic')
    expect(sources).toContain('tcgplayer')
    expect(sources).toContain('cardmarket')
    expect(sources).toContain('cardkingdom')
  })

  it('Test 8: empty wishlist → result is [], deleteStaleCandidates still called, info log has wishlist=0', async () => {
    vi.mocked(getUserWishlist).mockResolvedValue([])

    const deleteBuilder = createDeleteBuilder([])
    vi.mocked(db.delete).mockReturnValue(deleteBuilder as ReturnType<typeof db.delete>)

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    expect(results).toHaveLength(0)
    expect(db.delete).toHaveBeenCalledTimes(1) // stale cleanup still runs
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('wishlist=0'))
  })
})

describe('getRecentOpportunities', () => {
  it('Test 9: getRecentOpportunities(10) uses select, orderBy desc, limit(10)', async () => {
    const mockRow = {
      detectedAt: new Date('2026-04-10'),
      cardName: 'Black Lotus',
      source: 'ligamagic',
      currentPrice: 5200,
      dropPercent: 20.0,
    }

    const selectBuilder = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockRow]),
    }
    vi.mocked(db.select).mockReturnValue(selectBuilder as unknown as ReturnType<typeof db.select>)

    const results = await getRecentOpportunities(10)

    expect(db.select).toHaveBeenCalled()
    expect(selectBuilder.orderBy).toHaveBeenCalled()
    expect(selectBuilder.limit).toHaveBeenCalledWith(10)
  })
})

describe('insertOpportunity', () => {
  it('Test 10: insertOpportunity maps numeric fields to .toFixed(2) strings for Drizzle numeric columns', async () => {
    const mockInserted = [{ id: 1, sentToUser: false }]
    const insertBuilder = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(mockInserted),
    }
    vi.mocked(db.insert).mockReturnValue(insertBuilder as unknown as ReturnType<typeof db.insert>)

    await insertOpportunity({
      cardId: 'oracle-1',
      cardName: 'Lightning Bolt',
      source: 'ligamagic',
      currentPrice: 5200.123,
      baselinePrice: 5500.456,
      sevenDayAgoPrice: 6500.789,
      dropPercent: 20.0,
    })

    const valuesArg = insertBuilder.values.mock.calls[0][0]
    expect(valuesArg.currentPrice).toBe('5200.12')
    expect(valuesArg.baselinePrice).toBe('5500.46')
    expect(valuesArg.dropPercent).toBe('20.00')
  })
})
