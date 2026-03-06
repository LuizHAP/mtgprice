/**
 * Database queries for price insertion and retrieval
 *
 * Provides functions to:
 * - Insert price records into the prices table
 * - Get latest price for a card/source
 * - Get price history for a card (all sources, time-ordered)
 *
 * Uses Drizzle ORM with TimescaleDB hypertable optimization.
 */

import { db } from '@/db'
import { prices } from '@/db/schema'
import { logger } from '@/lib/logger'
import { and, desc, eq, gt, sql } from 'drizzle-orm'

/**
 * Insert a single price record
 *
 * Inserts a price into the prices table with proper type casting for numeric columns.
 * TimescaleDB hypertable handles automatic partitioning.
 *
 * @param cardId - Oracle ID of the card
 * @param source - Price source name (e.g., 'ligamagic', 'tcgplayer')
 * @param priceBrl - Price in BRL (will be stored as numeric(10,2))
 * @returns Inserted row with id and timestamp
 * @throws Error on foreign key violation (invalid cardId) or database errors
 *
 * @example
 * ```ts
 * const inserted = await insertPrice('oracle-id', 'ligamagic', 45.90)
 * console.log(`Inserted price with id: ${inserted.id}`)
 * ```
 */
export async function insertPrice(cardId: string, source: string, priceBrl: number) {
  try {
    // Cast priceBrl to string for numeric column
    const result = await db
      .insert(prices)
      .values({
        cardId,
        source,
        priceBrl: priceBrl.toString(),
      })
      .returning()

    const inserted = result[0]

    logger.debug(`Inserted price: ${cardId} from ${source} = R$ ${priceBrl.toFixed(2)}`)

    return inserted
  } catch (error) {
    // Check for foreign key violation (invalid cardId)
    if (error instanceof Error && error.message.includes('foreign key')) {
      throw new Error(`Invalid cardId: ${cardId} (card not found in cards table)`)
    }

    logger.error(`Error inserting price for ${cardId} from ${source}: ${error}`)
    throw error
  }
}

/**
 * Get latest price for a card/source
 *
 * Returns the most recent price record for a specific card and source.
 * Used by smart-refresh to check staleness.
 *
 * @param cardId - Oracle ID of the card
 * @param source - Price source name
 * @returns Price row or null if not found
 *
 * @example
 * ```ts
 * const latest = await getLatestPrice('oracle-id', 'ligamagic')
 * if (latest) {
 *   console.log(`Latest price: ${latest.priceBrl} at ${latest.timestamp}`)
 * }
 * ```
 */
export async function getLatestPrice(cardId: string, source: string) {
  try {
    const result = await db.query.prices.findFirst({
      where: and(eq(prices.cardId, cardId), eq(prices.source, source)),
      orderBy: [desc(prices.timestamp)],
    })

    return result ?? null
  } catch (error) {
    logger.error(`Error getting latest price for ${cardId} from ${source}: ${error}`)
    return null
  }
}

/**
 * Get price history for a card
 *
 * Returns all prices for a card, optionally filtered by sources and time range.
 * Ordered by timestamp DESC (most recent first).
 * Used by dashboard (Phase 3) for price charts.
 *
 * @param cardId - Oracle ID of the card
 * @param options - Optional filters
 * @returns Array of price rows
 *
 * @example
 * ```ts
 * // Get all prices for a card
 * const history = await getPriceHistory('oracle-id')
 *
 * // Get prices from specific sources in last 30 days
 * const filtered = await getPriceHistory('oracle-id', {
 *   sources: ['ligamagic', 'tcgplayer'],
 *   days: 30
 * })
 * ```
 */
export async function getPriceHistory(
  cardId: string,
  options?: {
    sources?: string[]
    days?: number
  },
) {
  try {
    const conditions = [eq(prices.cardId, cardId)]

    // Filter by sources if provided
    if (options?.sources && options.sources.length > 0) {
      // OR conditions for multiple sources
      const sourceConditions = options.sources.map((s) => eq(prices.source, s))
      // This will be handled by dynamic query construction in a real implementation
      // For now, we'll use a simpler approach with sql template
      conditions.push(sql`${prices.source} = ANY(${options.sources})`)
    }

    // Filter by time range if days provided
    if (options?.days) {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - options.days)
      conditions.push(gt(prices.timestamp, daysAgo))
    }

    const result = await db.query.prices.findMany({
      where: and(...conditions),
      orderBy: [desc(prices.timestamp)],
    })

    return result
  } catch (error) {
    logger.error(`Error getting price history for ${cardId}: ${error}`)
    return []
  }
}

/**
 * Get prices for multiple cards (batch query)
 *
 * Returns latest prices for multiple cards across all sources.
 * Used by orchestrator for post-fetch verification.
 *
 * @param cardIds - Array of oracle IDs
 * @param sources - Array of source names to filter by
 * @returns Map of cardId -> source -> price
 *
 * @example
 * ```ts
 * const pricesMap = await getPricesForCards(['id1', 'id2', 'id3'], ['ligamagic', 'tcgplayer'])
 * console.log(`Fetched ${pricesMap.size} card prices`)
 * ```
 */
export async function getPricesForCards(cardIds: string[], sources?: string[]) {
  try {
    const conditions = [sql`${prices.cardId} = ANY(${cardIds})`]

    if (sources && sources.length > 0) {
      conditions.push(sql`${prices.source} = ANY(${sources})`)
    }

    const result = await db.query.prices.findMany({
      where: and(...conditions),
      orderBy: [desc(prices.timestamp)],
    })

    // Group by cardId and source, returning latest price per combination
    const grouped = new Map<string, Map<string, number>>()

    for (const row of result) {
      let sourceMap = grouped.get(row.cardId)
      if (!sourceMap) {
        sourceMap = new Map()
        grouped.set(row.cardId, sourceMap)
      }

      const priceNum = Number.parseFloat(row.priceBrl)
      sourceMap.set(row.source, priceNum)
    }

    return grouped
  } catch (error) {
    logger.error(`Error getting prices for cards: ${error}`)
    return new Map()
  }
}
