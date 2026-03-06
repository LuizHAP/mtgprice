/**
 * Smart refresh logic to minimize redundant API calls
 *
 * Provides functions to:
 * - Check if price data is stale (>8 hours old)
 * - Get last fetch timestamp for a card/source
 * - Filter cards that need refresh across all sources
 *
 * Reduces API calls by ~66% vs fetching all cards every run per CONTEXT.md
 */

import { differenceInHours } from 'date-fns'
import { and, desc, eq, prices } from 'src/db/schema'
import { db } from '../db'
import { logger } from '../lib/logger'

/**
 * Smart refresh threshold in hours
 * Per CONTEXT.md: Only fetch if >8 hours since last successful fetch
 */
const SMART_REFRESH_THRESHOLD_HOURS = 8

/**
 * Check if price should be fetched for a specific card and source
 *
 * Returns true if:
 * - Never fetched before (no record in prices table)
 * - Last fetch was >8 hours ago (stale data)
 *
 * Returns false if:
 * - Last fetch was <=8 hours ago (fresh data)
 *
 * @param cardId - Oracle ID of the card
 * @param source - Price source name (e.g., 'ligamagic', 'tcgplayer')
 * @returns true if should fetch, false if data is fresh
 *
 * @example
 * ```ts
 * const shouldFetch = await shouldFetchPrice('oracle-id', 'ligamagic')
 * if (shouldFetch) {
 *   // Fetch price from Liga Magic
 * }
 * ```
 */
export async function shouldFetchPrice(cardId: string, source: string): Promise<boolean> {
  try {
    // Query prices table for most recent timestamp
    const lastPrice = await db.query.prices.findFirst({
      where: and(eq(prices.cardId, cardId), eq(prices.source, source)),
      orderBy: [desc(prices.timestamp)],
      columns: {
        timestamp: true,
      },
    })

    // Never fetched before
    if (!lastPrice) {
      logger.debug(`No previous price found for ${cardId} from ${source}, should fetch`)
      return true
    }

    // Check if stale (>8 hours old)
    const hoursSinceLastFetch = differenceInHours(new Date(), lastPrice.timestamp)

    if (hoursSinceLastFetch > SMART_REFRESH_THRESHOLD_HOURS) {
      logger.debug(
        `Price for ${cardId} from ${source} is ${hoursSinceLastFetch.toFixed(1)}h old (>8h threshold), should fetch`,
      )
      return true
    }

    logger.debug(
      `Price for ${cardId} from ${source} is ${hoursSinceLastFetch.toFixed(1)}h old (<=8h threshold), skip`,
    )
    return false
  } catch (error) {
    // Fail-open: if database query fails, log error and return true (better to fetch than skip)
    logger.error(`Error checking if should fetch price for ${cardId} from ${source}: ${error}`)
    return true
  }
}

/**
 * Get last fetch timestamp for a specific card and source
 *
 * Returns the timestamp of the most recent price fetch.
 * Useful for logging and debugging.
 *
 * @param cardId - Oracle ID of the card
 * @param source - Price source name
 * @returns Timestamp of last fetch or null if never fetched
 *
 * @example
 * ```ts
 * const lastFetch = await getLastFetchTime('oracle-id', 'ligamagic')
 * if (lastFetch) {
 *   console.log(`Last fetched: ${lastFetch.toISOString()}`)
 * }
 * ```
 */
export async function getLastFetchTime(cardId: string, source: string): Promise<Date | null> {
  try {
    const lastPrice = await db.query.prices.findFirst({
      where: and(eq(prices.cardId, cardId), eq(prices.source, source)),
      orderBy: [desc(prices.timestamp)],
      columns: {
        timestamp: true,
      },
    })

    return lastPrice?.timestamp ?? null
  } catch (error) {
    logger.error(`Error getting last fetch time for ${cardId} from ${source}: ${error}`)
    return null
  }
}
