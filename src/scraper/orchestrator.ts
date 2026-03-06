/**
 * Fetch orchestration for all price sources
 *
 * Coordinates fetching prices from all 4 sources (Liga Magic, TCGPlayer,
 * CardMarket, CardKingdom) with correct priority, currency conversion,
 * smart refresh filtering, and circuit breaker fault tolerance.
 *
 * This completes the data collection pipeline.
 */

import { insertPrice } from '../db/queries/prices'
import { type Currency, convertToBRL } from '../lib/currency'
import { logger } from '../lib/logger'
import { shouldFetchPrice } from './smart-refresh'

import { default as fetchCardKingdomPrice } from './providers/cardkingdom'
import { default as fetchCardMarketPrice } from './providers/cardmarket'
// Import all fetchers
import { fetchCardPrice as fetchLigaMagicPrice } from './providers/liga-magic'
import { default as fetchTCGPlayerPrice } from './providers/tcgplayer'

/**
 * Source metadata for orchestration
 */
interface SourceMetadata {
  name: 'ligamagic' | 'tcgplayer' | 'cardmarket' | 'cardkingdom'
  currency: Currency | 'BRL'
  fetch: (oracleId: string) => Promise<number | null>
}

/**
 * All price sources with their metadata
 */
const ALL_SOURCES: SourceMetadata[] = [
  {
    name: 'ligamagic',
    currency: 'BRL',
    fetch: fetchLigaMagicPrice,
  },
  {
    name: 'tcgplayer',
    currency: 'USD',
    fetch: fetchTCGPlayerPrice,
  },
  {
    name: 'cardmarket',
    currency: 'EUR',
    fetch: fetchCardMarketPrice,
  },
  {
    name: 'cardkingdom',
    currency: 'USD',
    fetch: fetchCardKingdomPrice,
  },
]

/**
 * Result type for fetchCardPriceFromAllSources
 */
export interface SourceFetchResult {
  success: boolean
  price?: number
  error?: string
}

export type AllSourcesResult = {
  [K in 'ligamagic' | 'tcgplayer' | 'cardmarket' | 'cardkingdom']: SourceFetchResult
}

/**
 * Fetch price from all 4 sources for a single card
 *
 * Orchestrates fetching from all sources with:
 * - Smart refresh filtering (skip if data is fresh)
 * - Liga Magic first (sequential, priority)
 * - International sources in parallel
 * - Currency conversion (USD/EUR → BRL with IOF)
 * - Database insertion for successful fetches
 *
 * @param oracleId - Oracle ID of the card
 * @returns Summary of successes/failures per source
 *
 * @example
 * ```ts
 * const results = await fetchCardPriceFromAllSources('oracle-id')
 * console.log(`Liga Magic: ${results.ligamagic.success ? results.ligamagic.price : 'failed'}`)
 * ```
 */
export async function fetchCardPriceFromAllSources(oracleId: string): Promise<AllSourcesResult> {
  const results: Partial<AllSourcesResult> = {}

  // Phase 1: Liga Magic (sequential, priority)
  const ligaMagicSource = ALL_SOURCES[0]
  if (!ligaMagicSource) {
    throw new Error('Liga Magic source not found')
  }
  const ligaMagicKey = ligaMagicSource.name

  // Check smart refresh
  const shouldFetchLiga = await shouldFetchPrice(oracleId, ligaMagicKey)

  if (!shouldFetchLiga) {
    logger.info(`Skipping ${ligaMagicKey} for ${oracleId} (fresh data)`)
    results[ligaMagicKey] = { success: false, error: 'Skipped (fresh data)' }
  } else {
    try {
      const price = await ligaMagicSource.fetch(oracleId)

      if (price !== null) {
        // Liga Magic returns BRL directly, no conversion needed
        await insertPrice(oracleId, ligaMagicKey, price)
        results[ligaMagicKey] = { success: true, price }
        logger.info(`✓ ${ligaMagicKey}: ${oracleId} = R$ ${price.toFixed(2)}`)
      } else {
        results[ligaMagicKey] = { success: false, error: 'Price not found' }
        logger.warn(`✗ ${ligaMagicKey}: ${oracleId} - Price not found`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      results[ligaMagicKey] = { success: false, error: errorMsg }
      logger.error(`✗ ${ligaMagicKey}: ${oracleId} - ${errorMsg}`)
    }
  }

  // Phase 2: International sources (parallel)
  const intlSources = ALL_SOURCES.slice(1)

  // Use Promise.allSettled to handle individual failures
  const intlPromises = intlSources.map(async (source) => {
    const key = source.name

    // Check smart refresh
    const shouldFetch = await shouldFetchPrice(oracleId, key)

    if (!shouldFetch) {
      logger.info(`Skipping ${key} for ${oracleId} (fresh data)`)
      return { key, result: { success: false, error: 'Skipped (fresh data)' } as SourceFetchResult }
    }

    try {
      const price = await source.fetch(oracleId)

      if (price !== null) {
        // Convert international prices to BRL with IOF
        const priceBrl = source.currency === 'BRL' ? price : await convertToBRL(price, source.currency)

        await insertPrice(oracleId, key, priceBrl)
        logger.info(
          `✓ ${key}: ${oracleId} = ${source.currency} ${price.toFixed(2)} → R$ ${priceBrl.toFixed(2)}`,
        )

        return { key, result: { success: true, price: priceBrl } as SourceFetchResult }
      }

      logger.warn(`✗ ${key}: ${oracleId} - Price not found`)
      return { key, result: { success: false, error: 'Price not found' } as SourceFetchResult }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(`✗ ${key}: ${oracleId} - ${errorMsg}`)
      return { key, result: { success: false, error: errorMsg } as SourceFetchResult }
    }
  })

  // Wait for all international sources to complete
  const intlResults = await Promise.allSettled(intlPromises)

  // Process results
  for (const promiseResult of intlResults) {
    if (promiseResult.status === 'fulfilled') {
      const { key, result } = promiseResult.value
      results[key] = result
    }
    // Rejected promises are already handled in the try-catch above
  }

  return results as AllSourcesResult
}

/**
 * Statistics for fetchAllPrices batch operation
 */
export interface FetchAllPricesStats {
  total: number
  fetched: number
  skipped: number
  failed: number
  errors: string[]
}

/**
 * Fetch prices for multiple cards across all sources
 *
 * Orchestrates batch fetching with:
 * - Smart refresh filtering (skip fresh cards)
 * - Liga Magic sequential first (per card)
 * - International sources in parallel (per card)
 * - Returns overall statistics
 *
 * @param oracleIds - Array of oracle IDs to fetch
 * @returns Overall statistics with success/failure counts
 *
 * @example
 * ```ts
 * const stats = await fetchAllPrices(['id1', 'id2', 'id3'])
 * console.log(`Fetched: ${stats.fetched}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`)
 * ```
 */
export async function fetchAllPrices(oracleIds: string[]): Promise<FetchAllPricesStats> {
  const stats: FetchAllPricesStats = {
    total: oracleIds.length,
    fetched: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  logger.info(`Starting price collection for ${oracleIds.length} cards`)

  // Sequential per-card fetch (respects rate limits better)
  for (let i = 0; i < oracleIds.length; i++) {
    const oracleId = oracleIds[i]

    try {
      const results = await fetchCardPriceFromAllSources(oracleId)

      // Count successes
      const successCount = Object.values(results).filter((r) => r.success).length
      const skipCount = Object.values(results).filter((r) => r.error?.includes('Skipped')).length

      stats.fetched += successCount
      stats.skipped += skipCount

      // Log progress every 10 cards
      if ((i + 1) % 10 === 0) {
        logger.info(`Progress: ${i + 1}/${oracleIds.length} cards processed`)
      }
    } catch (error) {
      stats.failed += 1
      const errorMsg = error instanceof Error ? error.message : String(error)
      stats.errors.push(`${oracleId}: ${errorMsg}`)
      logger.error(`Failed to fetch prices for ${oracleId}: ${errorMsg}`)
    }
  }

  logger.info(
    `Price collection complete: ${stats.fetched} fetched, ${stats.skipped} skipped, ${stats.failed} failed`,
  )

  if (stats.errors.length > 0) {
    logger.warn(`Encountered ${stats.errors.length} errors during collection`)
  }

  return stats
}

// Export default function for convenience
export default fetchAllPrices
