import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('axios')
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import axios from 'axios'
import { logger } from '@/lib/logger'
import { fetchEDHRECTopCards } from '../edhrec'

const mockedAxios = vi.mocked(axios, true)

describe('fetchEDHRECTopCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the first 50 card names from response.data.cardviews', async () => {
    const cardviews = Array.from({ length: 100 }, (_, i) => ({
      id: `id-${i}`,
      name: `Card ${i}`,
      sanitized: `card-${i}`,
      url: `/cards/card-${i}`,
      inclusion: 100 - i,
      label: '',
      num_decks: 1,
      potential_decks: 1,
    }))
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: { cardviews } } as any)

    const names = await fetchEDHRECTopCards()

    expect(names).toHaveLength(50)
    expect(names[0]).toBe('Card 0')
    expect(names[49]).toBe('Card 49')
    expect(mockedAxios.get).toHaveBeenCalledWith('https://json.edhrec.com/pages/top/week.json')
  })

  it('respects the limit parameter when provided', async () => {
    const cardviews = Array.from({ length: 30 }, (_, i) => ({ name: `C${i}` }))
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: { cardviews } } as any)

    const names = await fetchEDHRECTopCards(10)
    expect(names).toHaveLength(10)
  })

  it('falls back to container.json_dict.cardlists[0].cardviews when root cardviews missing', async () => {
    const cardviews = [{ name: 'Sol Ring' }, { name: 'Command Tower' }]
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({
      data: { container: { json_dict: { cardlists: [{ cardviews }] } } },
    } as any)

    const names = await fetchEDHRECTopCards()
    expect(names).toEqual(['Sol Ring', 'Command Tower'])
  })

  it('returns empty array and logs warning when both paths missing', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: { unrelated: true } } as any)

    const names = await fetchEDHRECTopCards()
    expect(names).toEqual([])
    expect(logger.warn).toHaveBeenCalled()
  })

  it('returns empty array and logs error when axios throws (META-03 resilience)', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const names = await fetchEDHRECTopCards()
    expect(names).toEqual([])
    expect(logger.error).toHaveBeenCalled()
  })

  it('caps each card name at 255 characters', async () => {
    const longName = 'A'.repeat(300)
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: { cardviews: [{ name: longName }] } } as any)

    const names = await fetchEDHRECTopCards()
    expect(names[0]).toHaveLength(255)
  })

  it('trims whitespace and filters empty names', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({
      data: { cardviews: [{ name: '  Sol Ring  ' }, { name: '' }, { name: 'Command Tower' }, {}] },
    } as any)

    const names = await fetchEDHRECTopCards()
    expect(names).toEqual(['Sol Ring', 'Command Tower'])
  })
})
