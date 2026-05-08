/**
 * MTGTop8 Standard + Modern metagame fetcher.
 *
 * Scrapes the "MOST PLAYED CARDS" table from MTGTop8 for the current meta period.
 * Per RESEARCH.md Pattern 2: HTTP GET + cheerio parsing of `table tr td:first-child a`.
 * Per CONTEXT.md D-03: MTGTop8 is the source of truth for Standard and Modern.
 *
 * Resilience: validates that ≥20 rows were parsed; if fewer, logs a warning
 * (likely stale meta ID per Pitfall 1) and returns []. Network failures are
 * logged and return []. The orchestrator skips this format that week.
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '@/lib/logger'

export type MTGTop8Format = 'ST' | 'MO'

const MTGTOP8_BASE_URL = 'https://www.mtgtop8.com/topcards'
const META_IDS: Record<MTGTop8Format, number> = {
  ST: 52, // Standard — RESEARCH.md verified 2026-05-08, may rotate
  MO: 51, // Modern   — RESEARCH.md verified 2026-05-08, may rotate
}
const MIN_EXPECTED_ROWS = 20 // stale meta ID guard per RESEARCH.md Pitfall 1
const MAX_CARD_NAME_LENGTH = 255 // matches wishlists.cardId varchar(255)
const USER_AGENT = 'MTGPrice-Monitor/1.0'

/**
 * Fetch top Standard or Modern card names from MTGTop8.
 *
 * @param format 'ST' for Standard, 'MO' for Modern
 * @param limit Maximum names to return (default 50 per CONTEXT.md D-01)
 * @returns Array of trimmed, length-capped card names; empty array on failure or stale meta
 */
export async function fetchMTGTop8TopCards(format: MTGTop8Format, limit = 50): Promise<string[]> {
  const metaId = META_IDS[format]
  const url = `${MTGTOP8_BASE_URL}?f=${format}&meta=${metaId}`

  try {
    const { data: html } = await axios.get<string>(url, {
      headers: { 'User-Agent': USER_AGENT },
    })

    const $ = cheerio.load(html)
    const rawNames: string[] = []
    $('table tr').each((_, row) => {
      const text = $(row).find('td:first-child a').text()
      if (text) rawNames.push(text)
    })

    // Stale meta ID guard
    if (rawNames.length < MIN_EXPECTED_ROWS) {
      logger.warn(
        `MTGTop8 ${format}: only ${rawNames.length} rows parsed (expected >=${MIN_EXPECTED_ROWS}); likely stale meta ID — returning empty list. URL=${url}`,
      )
      return []
    }

    const names = rawNames
      .map((name) => name.trim().slice(0, MAX_CARD_NAME_LENGTH))
      .filter((name) => name.length > 0)
      .slice(0, limit)

    logger.info(`MTGTop8 ${format}: fetched ${names.length} top cards`)
    return names
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`MTGTop8 ${format} fetch failed (format will be skipped this run): ${message}`)
    return []
  }
}
