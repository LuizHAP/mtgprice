/**
 * Fetch orchestration for all price sources
 *
 * Coordinates fetching prices from all 4 sources (Liga Magic, TCGPlayer,
 * CardMarket, CardKingdom) with correct priority, currency conversion,
 * smart refresh filtering, circuit breaker fault tolerance, and
 * per-source concurrency capping via p-limit.
 *
 * Composition order (per D-06): raw fetcher → withRetry → wrapWithCircuitBreaker
 * This ensures transient failures are retried BEFORE the circuit breaker
 * counts them toward its failure threshold.
 */

import { withRetry } from '@/lib/retry'
import { insertPrice } from '../db/queries/prices'
import { type Currency, convertToBRL } from '../lib/currency'
import { logger } from '../lib/logger'
import { wrapWithCircuitBreaker } from './circuit-breaker'
import { shouldFetchPrice } from './smart-refresh'

import pLimit from 'p-limit'

import { fetchCardPrice as fetchCardKingdomPrice } from './providers/cardkingdom'
import { fetchCardPrice as fetchCardMarketPrice } from './providers/cardmarket'
// Import raw (unwrapped) fetchCardPrice from each provider for retry composition
import { fetchCardPrice as fetchLigaMagicPrice } from './providers/liga-magic'
import { fetchCardPrice as fetchTCGPlayerPrice } from './providers/tcgplayer'

/**
 * Per-source concurrency cap (D-08/D-09).
 * Default 5: 5 concurrent × 4 sources = up to 20 in-flight requests,
 * well within LIGAMAGIC (30/min) and TCGPLAYER (40/min) rate limit budgets.
 */
const CONCURRENCY_PER_SOURCE = Number(process.env.SCRAPER_CONCURRENCY_PER_SOURCE) || 5

/**
 * Source metadata for orchestration
 */
interface SourceMetadata {
  name: 'ligamagic' | 'tcgplayer' | 'cardmarket' | 'cardkingdom'
  currency: Currency | 'BRL'
  fetch: (oracleId: string) => Promise<number | null>
}

/**
 * Compose a reliable fetcher: raw fetch → withRetry → wrapWithCircuitBreaker (D-06 order)
 *
 * withRetry wraps the raw fn BEFORE the circuit breaker sees any failure.
 * Only after all retry attempts are exhausted does the circuit breaker
 * count a failure toward its threshold.
 */
function composeReliable(
  rawFetch: (oracleId: string) => Promise<number | null>,
  sourceName: string,
): (oracleId: string) => Promise<number | null> {
  const retried = (oracleId: string) => withRetry(() => rawFetch(oracleId))
  const breakered = wrapWithCircuitBreaker(retried, sourceName)
  return (oracleId: string) => breakered(oracleId).then((v) => v ?? null)
}

/**
 * All price sources with their metadata.
 * Each fetch is composed: raw → withRetry → circuit breaker (D-06 ordering).
 */
const ALL_SOURCES: SourceMetadata[] = [
  { name: 'ligamagic', currency: 'BRL', fetch: composeReliable(fetchLigaMagicPrice, 'Liga Magic') },
  { name: 'tcgplayer', currency: 'USD', fetch: composeReliable(fetchTCGPlayerPrice, 'TCGPlayer') },
  { name: 'cardmarket', currency: 'EUR', fetch: composeReliable(fetchCardMarketPrice, 'CardMarket') },
  { name: 'cardkingdom', currency: 'USD', fetch: composeReliable(fetchCardKingdomPrice, 'CardKingdom') },
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
 * - p-limit concurrency cap (SCRAPER_CONCURRENCY_PER_SOURCE, default 5)
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

  logger.info(
    `Starting price collection for ${oracleIds.length} cards (concurrency=${CONCURRENCY_PER_SOURCE})`,
  )

  const limit = pLimit(CONCURRENCY_PER_SOURCE)
  let completedCount = 0

  const tasks = oracleIds.map((oracleId) =>
    limit(async () => {
      try {
        const results = await fetchCardPriceFromAllSources(oracleId)
        const successCount = Object.values(results).filter((r) => r.success).length
        const skipCount = Object.values(results).filter((r) => r.error?.includes('Skipped')).length
        stats.fetched += successCount
        stats.skipped += skipCount
        completedCount++
        if (completedCount % 10 === 0) {
          logger.info(`Progress: ${completedCount}/${oracleIds.length} cards processed`)
        }
      } catch (error) {
        completedCount++
        stats.failed += 1
        const errorMsg = error instanceof Error ? error.message : String(error)
        stats.errors.push(`${oracleId}: ${errorMsg}`)
        logger.error(`Failed to fetch prices for ${oracleId}: ${errorMsg}`)
      }
    }),
  )

  await Promise.all(tasks)

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
