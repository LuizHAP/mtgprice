import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('axios')
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import axios from 'axios'
import { logger } from '@/lib/logger'
import { fetchMTGTop8TopCards } from '../mtgtop8'

const mockedAxios = vi.mocked(axios, true)

function makeHtml(cardNames: string[]): string {
  const rows = cardNames
    .map((name) => `<tr><td><a href="/card?id=1">${name}</a></td><td>15.4%</td></tr>`)
    .join('\n')
  return `<html><body><table>${rows}</table></body></html>`
}

describe('fetchMTGTop8TopCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses up to 50 card names from Standard (f=ST, meta=52)', async () => {
    const cardNames = Array.from({ length: 80 }, (_, i) => `Standard Card ${i}`)
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: makeHtml(cardNames) } as any)

    const result = await fetchMTGTop8TopCards('ST')

    expect(result).toHaveLength(50)
    expect(result[0]).toBe('Standard Card 0')
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('topcards?f=ST&meta=52'),
      expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': 'MTGPrice-Monitor/1.0' }) }),
    )
  })

  it('parses card names from Modern (f=MO, meta=51)', async () => {
    const cardNames = Array.from({ length: 60 }, (_, i) => `Modern Card ${i}`)
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: makeHtml(cardNames) } as any)

    const result = await fetchMTGTop8TopCards('MO')

    expect(result.length).toBeGreaterThanOrEqual(50)
    expect(result.length).toBeLessThanOrEqual(50)
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('topcards?f=MO&meta=51'),
      expect.anything(),
    )
  })

  it('logs warning and returns empty array when fewer than 20 rows parsed (stale meta ID guard)', async () => {
    const cardNames = Array.from({ length: 5 }, (_, i) => `Card ${i}`)
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: makeHtml(cardNames) } as any)

    const result = await fetchMTGTop8TopCards('ST')

    expect(result).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('stale meta ID'))
  })

  it('respects custom limit parameter (e.g., limit=10)', async () => {
    const cardNames = Array.from({ length: 80 }, (_, i) => `Card ${i}`)
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: makeHtml(cardNames) } as any)

    const result = await fetchMTGTop8TopCards('ST', 10)
    expect(result).toHaveLength(10)
  })

  it('trims whitespace and filters empty names', async () => {
    const html = makeHtml(Array.from({ length: 25 }, (_, i) => `  Card ${i}  `))
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: html } as any)

    const result = await fetchMTGTop8TopCards('ST')
    for (const name of result) {
      expect(name).not.toMatch(/^\s|\s$/)
    }
  })

  it('caps card names at 255 characters', async () => {
    const longName = 'X'.repeat(300)
    const cardNames = [longName, ...Array.from({ length: 24 }, (_, i) => `Card ${i}`)]
    // biome-ignore lint/suspicious/noExplicitAny: axios mock
    mockedAxios.get.mockResolvedValueOnce({ data: makeHtml(cardNames) } as any)

    const result = await fetchMTGTop8TopCards('ST')
    expect(result[0]).toHaveLength(255)
  })

  it('returns empty array and logs error when axios throws', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network down'))

    const result = await fetchMTGTop8TopCards('ST')

    expect(result).toEqual([])
    expect(logger.error).toHaveBeenCalled()
  })
})
