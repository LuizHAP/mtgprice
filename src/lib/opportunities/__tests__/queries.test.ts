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
import { detectOpportunitiesForWishlist, getRecentOpportunities, insertOpportunity } from '../queries'

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

// biome-ignore lint/suspicious/noExplicitAny: test mock helpers use any for Drizzle builder chains
type MockBuilder = any

/**
 * Create a fully-chainable mock Drizzle select builder.
 *
 * The builder wraps a resolved Promise so that `await db.select()...from().where().limit(n)`
 * works. The terminal method is `.limit()` which resolves to the returnValue.
 */
function createSelectBuilder(returnValue: unknown): MockBuilder {
  const builder: MockBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    innerJoin: vi.fn(),
    execute: vi.fn().mockResolvedValue(returnValue),
  }
  builder.from.mockReturnValue(builder)
  builder.where.mockReturnValue(builder)
  builder.innerJoin.mockReturnValue(builder)
  builder.orderBy.mockReturnValue(builder)
  // limit is the terminal — resolves the array
  builder.limit.mockResolvedValue(returnValue)
  return builder
}

function createInsertBuilder(returnValue: unknown): MockBuilder {
  const builder: MockBuilder = {
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn(),
    execute: vi.fn().mockResolvedValue(returnValue),
  }
  builder.values.mockReturnValue(builder)
  // onConflictDoNothing is the terminal for insertCandidate — must resolve
  builder.onConflictDoNothing.mockResolvedValue(returnValue)
  builder.returning.mockResolvedValue(returnValue)
  return builder
}

function createDeleteBuilder(returnValue: unknown): MockBuilder {
  const builder: MockBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
    execute: vi.fn().mockResolvedValue(returnValue),
  }
  builder.from.mockReturnValue(builder)
  // where is chainable (both deleteCandidate and deleteStaleCandidates chain .returning() after)
  builder.where.mockReturnValue(builder)
  // returning is the terminal — resolves the array
  builder.returning.mockResolvedValue(returnValue)
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

    vi.mocked(db.select).mockImplementation(() => createSelectBuilder([]))
    vi.mocked(db.delete).mockImplementation(() => createDeleteBuilder([]))
    vi.mocked(evaluateCandidate).mockReturnValue({ fires: false, dropPercent: null, reason: 'cold_start' })

    await detectOpportunitiesForWishlist(1, baseConfig)

    // 1 card × 4 sources = 4 calls
    expect(evaluateCandidate).toHaveBeenCalledTimes(4)
  })

  it('Test 2: isInCooldown true → evaluateCandidate NOT called AND candidate state NOT touched', async () => {
    const mockWishlist = [mockCard]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    // isInCooldown returns 1 row → in cooldown for all pairs
    vi.mocked(db.select).mockImplementation(() => createSelectBuilder([{ id: 1 }]))
    vi.mocked(db.delete).mockImplementation(() => createDeleteBuilder([]))

    await detectOpportunitiesForWishlist(1, baseConfig)

    expect(evaluateCandidate).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('Test 3 (D-07 Branch A): fires=false → deleteCandidate called, insertCandidate NOT called, result empty', async () => {
    const mockWishlist = [{ ...mockCard, oracleId: 'oracle-A' }]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    vi.mocked(db.select).mockImplementation(() => createSelectBuilder([]))
    vi.mocked(evaluateCandidate).mockReturnValue({ fires: false, dropPercent: null, reason: 'cold_start' })
    vi.mocked(db.delete).mockImplementation(() => createDeleteBuilder([]))

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    expect(db.delete).toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(results).toHaveLength(0)
  })

  it('Test 4 (D-07 Branch B): fires=true, getCandidate=null → insertCandidate called, NOT promoted', async () => {
    const mockWishlist = [{ ...mockCard, oracleId: 'oracle-B' }]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    vi.mocked(db.select).mockImplementation(() => createSelectBuilder([]))
    vi.mocked(evaluateCandidate).mockReturnValue({ fires: true, dropPercent: 20.0 })
    vi.mocked(db.delete).mockImplementation(() => createDeleteBuilder([]))
    vi.mocked(db.insert).mockImplementation(() => createInsertBuilder([]))

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    expect(db.insert).toHaveBeenCalled()
    expect(results).toHaveLength(0)
  })

  it('Test 5 (D-07 Branch C): fires=true, existing candidate → promoted + deleteCandidate called', async () => {
    const mockWishlist = [{ ...mockCard, oracleId: 'oracle-C', name: 'Black Lotus' }]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    const existingCandidate = { id: 42, firstSeenAt: new Date('2026-04-10T15:00:00Z') }

    // Stateful mock: per-source call order is:
    //   1: isInCooldown    → [] (not in cooldown)
    //   2-5: price queries → [] (null prices — mocked evaluateCandidate ignores them)
    //   6: getCandidate    → [existingCandidate]
    // Pattern repeats every 6 selects for each source
    let selectCallCount = 0
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++
      const positionInGroup = ((selectCallCount - 1) % 6) + 1
      return positionInGroup === 6 ? createSelectBuilder([existingCandidate]) : createSelectBuilder([])
    })

    vi.mocked(evaluateCandidate).mockReturnValue({ fires: true, dropPercent: 20.0 })
    vi.mocked(db.delete).mockImplementation(() => createDeleteBuilder([]))
    vi.mocked(db.insert).mockImplementation(() => createInsertBuilder([]))

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    expect(db.delete).toHaveBeenCalled()
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toMatchObject({
      cardId: 'oracle-C',
      cardName: 'Black Lotus',
      source: expect.stringMatching(/ligamagic|tcgplayer|cardmarket|cardkingdom/),
      dropPercent: 20.0,
    })
  })

  it('Test 6 (D-07 Branch D): deleteStaleCandidates is called exactly once per orchestrator invocation', async () => {
    vi.mocked(getUserWishlist).mockResolvedValue([])
    vi.mocked(db.delete).mockImplementation(() => createDeleteBuilder([]))

    await detectOpportunitiesForWishlist(1, baseConfig)

    expect(db.delete).toHaveBeenCalledTimes(1)
  })

  it('Test 7 (Multi-source): fires=true for all 4 sources on existing candidates → 4 opportunities', async () => {
    const mockWishlist = [{ ...mockCard, oracleId: 'oracle-multi', name: 'Mox Pearl' }]
    vi.mocked(getUserWishlist).mockResolvedValue(mockWishlist)

    const existingCandidate = { id: 99, firstSeenAt: new Date('2026-04-10') }

    let selectCallCount = 0
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++
      const positionInGroup = ((selectCallCount - 1) % 6) + 1
      return positionInGroup === 6 ? createSelectBuilder([existingCandidate]) : createSelectBuilder([])
    })

    vi.mocked(evaluateCandidate).mockReturnValue({ fires: true, dropPercent: 22.5 })
    vi.mocked(db.delete).mockImplementation(() => createDeleteBuilder([]))
    vi.mocked(db.insert).mockImplementation(() => createInsertBuilder([]))

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    expect(results).toHaveLength(4)
    const sources = results.map((r) => r.source)
    expect(sources).toContain('ligamagic')
    expect(sources).toContain('tcgplayer')
    expect(sources).toContain('cardmarket')
    expect(sources).toContain('cardkingdom')
  })

  it('Test 8: empty wishlist → result is [], deleteStaleCandidates still called, info log has wishlist=0', async () => {
    vi.mocked(getUserWishlist).mockResolvedValue([])
    vi.mocked(db.delete).mockImplementation(() => createDeleteBuilder([]))

    const results = await detectOpportunitiesForWishlist(1, baseConfig)

    expect(results).toHaveLength(0)
    expect(db.delete).toHaveBeenCalledTimes(1)
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('wishlist=0'))
  })
})

describe('getRecentOpportunities', () => {
  it('Test 9: getRecentOpportunities(10) uses select, orderBy desc, limit(10)', async () => {
    const mockRow = {
      detectedAt: new Date('2026-04-10'),
      cardName: 'Black Lotus',
      source: 'ligamagic',
      currentPrice: '5200.00',
      dropPercent: '20.00',
    }

    const selectBuilder: MockBuilder = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockRow]),
    }
    vi.mocked(db.select).mockReturnValue(selectBuilder)

    const results = await getRecentOpportunities(10)

    expect(db.select).toHaveBeenCalled()
    expect(selectBuilder.orderBy).toHaveBeenCalled()
    expect(selectBuilder.limit).toHaveBeenCalledWith(10)
    expect(results).toHaveLength(1)
    expect(results[0].cardName).toBe('Black Lotus')
  })
})

describe('insertOpportunity', () => {
  it('Test 10: insertOpportunity maps numeric fields to .toFixed(2) strings for Drizzle numeric columns', async () => {
    const mockInserted = [{ id: 1, sentToUser: false }]
    const insertBuilder: MockBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(mockInserted),
    }
    vi.mocked(db.insert).mockReturnValue(insertBuilder)

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
