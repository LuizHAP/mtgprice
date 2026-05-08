import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('axios')
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('@/lib/ratelimit/rate-limiter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ratelimit/rate-limiter')>(
    '@/lib/ratelimit/rate-limiter',
  )
  return {
    ...actual,
    checkRateLimitPreset: vi.fn(),
  }
})

import axios from 'axios'
import { logger } from '@/lib/logger'
import { RATE_LIMITS, checkRateLimitPreset } from '@/lib/ratelimit/rate-limiter'
import { resolveNamesToOracleIds } from '../scryfall-resolver'

const mockedAxios = vi.mocked(axios, true)
const mockedRateLimit = vi.mocked(checkRateLimitPreset)

function makeScryfallCard(name: string, oracleId: string) {
  return {
    object: 'card',
    id: `print-${oracleId}`,
    oracle_id: oracleId,
    name,
    set: 'TST',
    set_name: 'Test Set',
    rarity: 'rare',
    colors: ['R'],
    image_uris: { small: '', normal: '', large: '', png: '', art_crop: '', border_crop: '' },
  }
}

describe('resolveNamesToOracleIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRateLimit.mockResolvedValue({ allowed: true, remaining: 2 })
  })

  it('returns [] without calling axios when input array is empty', async () => {
    const result = await resolveNamesToOracleIds([])
    expect(result).toEqual([])
    expect(mockedAxios.post).not.toHaveBeenCalled()
    expect(mockedRateLimit).not.toHaveBeenCalled()
  })

  it('batches names into groups of 75 and POSTs to /cards/collection', async () => {
    const names = Array.from({ length: 150 }, (_, i) => `Card ${i}`)
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.post.mockResolvedValue({
      data: { data: names.slice(0, 75).map((n, i) => makeScryfallCard(n, `oid-${i}`)), not_found: [] },
    } as any)

    const result = await resolveNamesToOracleIds(names)

    expect(mockedAxios.post).toHaveBeenCalledTimes(2)
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/collection',
      expect.objectContaining({
        identifiers: expect.arrayContaining([{ name: 'Card 0' }]),
      }),
    )
    // Each batch must have at most 75 identifiers
    const firstCallBody = mockedAxios.post.mock.calls[0]?.[1] as { identifiers: unknown[] }
    expect(firstCallBody.identifiers.length).toBeLessThanOrEqual(75)
  })

  it('returns { name, oracleId, metadata } tuples for resolved cards', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: [makeScryfallCard('Sol Ring', 'oid-1'), makeScryfallCard('Lightning Bolt', 'oid-2')],
        not_found: [],
      },
    } as any)

    const result = await resolveNamesToOracleIds(['Sol Ring', 'Lightning Bolt'])

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: 'Sol Ring',
      oracleId: 'oid-1',
      metadata: expect.objectContaining({ oracle_id: 'oid-1', name: 'Sol Ring' }),
    })
    expect(result[1]?.oracleId).toBe('oid-2')
  })

  it('calls checkRateLimitPreset with SCRYFALL_HEAVY before each batch', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.post.mockResolvedValue({ data: { data: [], not_found: [] } } as any)

    await resolveNamesToOracleIds(['A', 'B'])

    expect(mockedRateLimit).toHaveBeenCalledWith('scryfall:collection', RATE_LIMITS.SCRYFALL_HEAVY)
  })

  it('logs warnings for names appearing in response.data.not_found without throwing', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: [makeScryfallCard('Real Card', 'oid-1')],
        not_found: [{ name: 'Fake Card' }, { name: 'Misspelled' }],
      },
    } as any)

    const result = await resolveNamesToOracleIds(['Real Card', 'Fake Card', 'Misspelled'])

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Real Card')
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Fake Card'))
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Misspelled'))
  })

  it('continues with remaining batches when one batch axios.post throws (partial success)', async () => {
    const names = Array.from({ length: 150 }, (_, i) => `C${i}`)
    mockedAxios.post
      .mockRejectedValueOnce(new Error('500 Internal Server Error'))
      // biome-ignore lint/suspicious/noExplicitAny: axios mock
      .mockResolvedValueOnce({
        data: { data: [makeScryfallCard('C75', 'oid-75')], not_found: [] },
      } as any)

    const result = await resolveNamesToOracleIds(names)

    expect(result).toHaveLength(1)
    expect(result[0]?.oracleId).toBe('oid-75')
    expect(logger.error).toHaveBeenCalled()
  })

  it('retries once on rate-limit denial then logs warning if still denied', async () => {
    mockedRateLimit
      .mockResolvedValueOnce({ allowed: false, remaining: 0 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0 })
    // axios should never be called for this batch since rate limit blocked twice

    const result = await resolveNamesToOracleIds(['Blocked'])

    expect(mockedRateLimit).toHaveBeenCalledTimes(2)
    expect(mockedAxios.post).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('rate limit'))
    expect(result).toEqual([])
  })

  it('skips empty/whitespace names defensively', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.post.mockResolvedValueOnce({
      data: { data: [makeScryfallCard('Real', 'oid-1')], not_found: [] },
    } as any)

    const result = await resolveNamesToOracleIds(['', '  ', 'Real'])

    // axios.post body should only include the valid name
    const body = mockedAxios.post.mock.calls[0]?.[1] as { identifiers: Array<{ name: string }> }
    expect(body.identifiers).toEqual([{ name: 'Real' }])
    expect(result).toHaveLength(1)
  })
})
