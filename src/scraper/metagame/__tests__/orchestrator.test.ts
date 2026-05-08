import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the three fetchers
vi.mock('../edhrec', () => ({ fetchEDHRECTopCards: vi.fn() }))
vi.mock('../mtgtop8', () => ({ fetchMTGTop8TopCards: vi.fn() }))
vi.mock('../scryfall-resolver', () => ({ resolveNamesToOracleIds: vi.fn() }))

// Mock the DB
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { db } from '@/db'
import { logger } from '@/lib/logger'
import { fetchEDHRECTopCards } from '../edhrec'
import { fetchMTGTop8TopCards } from '../mtgtop8'
import { resolveNamesToOracleIds } from '../scryfall-resolver'
import { executeMetagameRefresh } from '../orchestrator'

const mockFetchEDHREC = vi.mocked(fetchEDHRECTopCards)
const mockFetchMTGTop8 = vi.mocked(fetchMTGTop8TopCards)
const mockResolve = vi.mocked(resolveNamesToOracleIds)

// Chainable Drizzle mock helper — supports `await chain` resolving to value
function chainResolves<T>(value: T) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'where', 'values', 'onConflictDoNothing', 'onConflictDoUpdate', 'returning', 'limit']
  for (const m of methods) chain[m] = vi.fn(() => chain)
  ;(chain as { then?: (resolve: (v: T) => void) => void }).then = (resolve) => resolve(value)
  return chain
}

function makeMetadata(name: string, oracleId: string) {
  return {
    object: 'card',
    id: `print-${oracleId}`,
    oracle_id: oracleId,
    name,
    set: 'XXX',
    set_name: 'X',
    rarity: 'rare',
    colors: [],
  }
}

describe('executeMetagameRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invokes all three fetchers and combines results into a deduplicated set passed to resolver', async () => {
    mockFetchMTGTop8.mockImplementation(async (format) =>
      format === 'ST' ? ['Lightning Bolt', 'Counterspell'] : ['Lightning Bolt', 'Force of Will'],
    )
    mockFetchEDHREC.mockResolvedValueOnce(['Sol Ring', 'Counterspell'])
    mockResolve.mockResolvedValueOnce([])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(chainResolves([]))
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue(chainResolves(undefined))

    await executeMetagameRefresh()

    expect(mockFetchMTGTop8).toHaveBeenCalledWith('ST', 50)
    expect(mockFetchMTGTop8).toHaveBeenCalledWith('MO', 50)
    expect(mockFetchEDHREC).toHaveBeenCalledWith(50)
    const resolverArg = mockResolve.mock.calls[0]?.[0] ?? []
    expect(new Set(resolverArg)).toEqual(
      new Set(['Lightning Bolt', 'Counterspell', 'Force of Will', 'Sol Ring']),
    )
  })

  it('returns zero-counts and skips DB activity when all sources return empty', async () => {
    mockFetchMTGTop8.mockResolvedValue([])
    mockFetchEDHREC.mockResolvedValueOnce([])

    const summary = await executeMetagameRefresh()

    expect(summary.addedCount).toBe(0)
    expect(summary.removedCount).toBe(0)
    expect(mockResolve).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('upserts missing cards into cards table BEFORE inserting into wishlists (D-06)', async () => {
    mockFetchMTGTop8.mockResolvedValue(['Card A'])
    mockFetchEDHREC.mockResolvedValueOnce([])
    mockResolve.mockResolvedValueOnce([
      {
        name: 'Card A',
        oracleId: 'oid-A',
        metadata: makeMetadata('Card A', 'oid-A') as unknown as never,
      },
    ])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(chainResolves([])) // 'Card A' not in DB

    const insertCallOrder: string[] = []
    ;(db.insert as ReturnType<typeof vi.fn>).mockImplementation((table) => {
      // Drizzle table objects expose their name via Symbol.for('drizzle:Name')
      const drizzleName = (table as Record<symbol, string>)[Symbol.for('drizzle:Name')]
      const name = drizzleName === 'cards' ? 'cards' : 'wishlists'
      insertCallOrder.push(name)
      return chainResolves(undefined)
    })
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue(chainResolves(undefined))

    await executeMetagameRefresh()

    expect(db.insert).toHaveBeenCalled()
    expect(insertCallOrder.length).toBeGreaterThanOrEqual(2)
    // The first insert call must NOT be wishlists if there are missing cards
    expect(insertCallOrder[0]).not.toBe('wishlists')
  })

  it('inserts wishlist rows with userId=1 and isAutoAdded=true using onConflictDoNothing (D-07)', async () => {
    mockFetchMTGTop8.mockResolvedValue([])
    mockFetchEDHREC.mockResolvedValueOnce(['Sol Ring'])
    mockResolve.mockResolvedValueOnce([
      {
        name: 'Sol Ring',
        oracleId: 'oid-sol',
        metadata: makeMetadata('Sol Ring', 'oid-sol') as unknown as never,
      },
    ])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      chainResolves([{ oracleId: 'oid-sol' }]), // already in cards table → skip cards upsert
    )

    let wishlistInsertValue: unknown
    const onConflictDoNothing = vi.fn(() => Promise.resolve(undefined))
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn((v) => {
        wishlistInsertValue = v
        return { onConflictDoNothing }
      }),
    })
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn(() => Promise.resolve(undefined)),
    })

    await executeMetagameRefresh()

    expect(wishlistInsertValue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 1, cardId: 'oid-sol', isAutoAdded: true }),
      ]),
    )
    expect(onConflictDoNothing).toHaveBeenCalled()
  })

  it('issues a delete on wishlists with a WHERE clause (D-05, Pitfall 4 — never unconditional)', async () => {
    mockFetchMTGTop8.mockResolvedValue([])
    mockFetchEDHREC.mockResolvedValueOnce(['Sol Ring'])
    mockResolve.mockResolvedValueOnce([
      {
        name: 'Sol Ring',
        oracleId: 'oid-sol',
        metadata: makeMetadata('Sol Ring', 'oid-sol') as unknown as never,
      },
    ])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(chainResolves([{ oracleId: 'oid-sol' }]))
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(() => Promise.resolve(undefined)) })),
    })

    let deleteWhereArg: unknown
    const whereFn = vi.fn((arg) => {
      deleteWhereArg = arg
      return Promise.resolve(undefined)
    })
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: whereFn })

    await executeMetagameRefresh()

    expect(db.delete).toHaveBeenCalled()
    expect(whereFn).toHaveBeenCalled()
    // A WHERE clause was provided (defined, not undefined) — guards against unconditional delete
    expect(deleteWhereArg).toBeDefined()
  })

  it('returns structured summary { addedCount, removedCount, skippedCount, perFormat }', async () => {
    mockFetchMTGTop8.mockImplementation(async (format) => (format === 'ST' ? ['A'] : ['B']))
    mockFetchEDHREC.mockResolvedValueOnce(['C'])
    mockResolve.mockResolvedValueOnce([
      { name: 'A', oracleId: 'a', metadata: makeMetadata('A', 'a') as unknown as never },
      { name: 'B', oracleId: 'b', metadata: makeMetadata('B', 'b') as unknown as never },
      { name: 'C', oracleId: 'c', metadata: makeMetadata('C', 'c') as unknown as never },
    ])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(chainResolves([]))
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(() => Promise.resolve(undefined)) })),
      // For cards upsert chain
      onConflictDoUpdate: vi.fn(() => Promise.resolve(undefined)),
    })
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn(() => Promise.resolve(undefined)),
    })

    const summary = await executeMetagameRefresh()

    expect(summary).toEqual(
      expect.objectContaining({
        addedCount: expect.any(Number),
        removedCount: expect.any(Number),
        skippedCount: expect.any(Number),
        perFormat: expect.objectContaining({ commander: 1, standard: 1, modern: 1 }),
      }),
    )
  })

  it('continues with remaining formats when one source returns empty (skip-not-fail)', async () => {
    mockFetchMTGTop8.mockImplementation(async (format) => (format === 'ST' ? [] : ['Modern Card']))
    mockFetchEDHREC.mockResolvedValueOnce(['Cmdr Card'])
    mockResolve.mockResolvedValueOnce([
      {
        name: 'Modern Card',
        oracleId: 'mc',
        metadata: makeMetadata('Modern Card', 'mc') as unknown as never,
      },
      {
        name: 'Cmdr Card',
        oracleId: 'cc',
        metadata: makeMetadata('Cmdr Card', 'cc') as unknown as never,
      },
    ])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(chainResolves([]))
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(() => Promise.resolve(undefined)) })),
      onConflictDoUpdate: vi.fn(() => Promise.resolve(undefined)),
    })
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn(() => Promise.resolve(undefined)),
    })

    const summary = await executeMetagameRefresh()

    expect(summary.perFormat.standard).toBe(0)
    expect(summary.perFormat.modern).toBe(1)
    expect(summary.perFormat.commander).toBe(1)
    expect(mockResolve).toHaveBeenCalledTimes(1)
  })

  it('catches unexpected DB errors and returns a summary with skippedCount populated, never throws', async () => {
    mockFetchMTGTop8.mockResolvedValue(['Card'])
    mockFetchEDHREC.mockResolvedValueOnce([])
    mockResolve.mockResolvedValueOnce([
      { name: 'Card', oracleId: 'oid', metadata: makeMetadata('Card', 'oid') as unknown as never },
    ])
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Database connection lost')
    })

    await expect(executeMetagameRefresh()).resolves.toBeDefined()
    expect(logger.error).toHaveBeenCalled()
  })
})
