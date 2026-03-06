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

import { db } from '@/db'
import { prices } from '@/db/schema'
import { logger } from '@/lib/logger'
import { differenceInHours } from 'date-fns'
import { and, desc, eq, sql } from 'drizzle-orm'

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

/**
 * All price sources in the system
 */
const ALL_SOURCES = ['ligamagic', 'tcgplayer', 'cardmarket', 'cardkingdom'] as const

/**
 * Check if any source needs refresh for a card
 *
 * Returns true if ANY of the 4 sources needs refresh (>8 hours old).
 * Returns false only if ALL sources are fresh (<=8 hours old).
 *
 * This is used by the orchestrator to skip cards that are fresh across all sources,
 * reducing unnecessary API calls.
 *
 * @param cardId - Oracle ID of the card
 * @returns true if any source needs refresh, false if all are fresh
 *
 * @example
 * ```ts
 * const needsRefresh = await shouldFetchAnyPrice('oracle-id')
 * if (!needsRefresh) {
 *   console.log('All sources fresh for this card, skip')
 * }
 * ```
 */
export async function shouldFetchAnyPrice(cardId: string): Promise<boolean> {
  try {
    // Check all 4 sources in parallel
    const results = await Promise.all(ALL_SOURCES.map((source) => shouldFetchPrice(cardId, source)))

    // Return true if ANY source needs refresh
    const anyNeedsRefresh = results.some((result) => result === true)

    if (!anyNeedsRefresh) {
      logger.info(`All 4 sources fresh for ${cardId}, skipping fetch`)
    }

    return anyNeedsRefresh
  } catch (error) {
    logger.error(`Error checking if any source needs refresh for ${cardId}: ${error}`)
    // Fail-open: if check fails, assume stale
    return true
  }
}

/**
 * Filter cards that need refresh from a list
 *
 * Checks shouldFetchAnyPrice() for each card and returns only the cards
 * that need at least one source refresh.
 *
 * This enables the orchestrator to filter out fresh cards before fetching,
 * significantly reducing API calls (~66% reduction per CONTEXT.md).
 *
 * @param cardIds - Array of oracle IDs to check
 * @returns Array of card IDs that need refresh
 *
 * @example
 * ```ts
 * const allCardIds = ['id1', 'id2', 'id3', 'id4', 'id5']
 * const staleCards = await getStaleCards(allCardIds)
 * console.log(`Need to fetch ${staleCards.length} out of ${allCardIds.length} cards`)
 * ```
 */
export async function getStaleCards(cardIds: string[]): Promise<string[]> {
  try {
    // Check all cards in parallel for performance
    const results = await Promise.all(
      cardIds.map(async (cardId) => ({
        cardId,
        needsRefresh: await shouldFetchAnyPrice(cardId),
      })),
    )

    // Filter to only cards that need refresh
    const staleCards = results.filter((r) => r.needsRefresh).map((r) => r.cardId)

    logger.info(
      `Smart refresh: ${staleCards.length}/${cardIds.length} cards need refresh (${Math.round((1 - staleCards.length / cardIds.length) * 100)}% filtered)`,
    )

    return staleCards
  } catch (error) {
    logger.error(`Error filtering stale cards: ${error}`)
    // Fail-open: if filter fails, return all cards
    return cardIds
  }
}
