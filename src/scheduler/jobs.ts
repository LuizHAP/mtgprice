/**
 * Cron job scheduling for 2-3x daily price collection
 *
 * Provides functions to:
 * - Schedule price collection with node-cron
 * - Execute price collection for all monitored cards
 * - Prevent concurrent executions
 *
 * Per CONTEXT.md: 2-3x daily checks (NOT real-time per NOTIF-03)
 */

import { db } from '@/db'
import { cards } from '@/db/schema'
import { logger } from '@/lib/logger'
import {
  detectOpportunitiesForWishlist,
  loadDetectionConfig,
  sendDigestAndPersist,
} from '@/lib/opportunities'
import { executeMetagameRefresh } from '@/scraper/metagame'
import fetchAllPrices from '@/scraper/orchestrator'
import cron from 'node-cron'

/**
 * Flag to prevent concurrent executions
 */
let isRunning = false

/**
 * Get monitored card IDs from database
 *
 * Queries the cards table for all oracle IDs.
 * In Phase 2, this returns manually seeded 100-500 cards.
 * In Phase 3+, this will filter by wishlist membership.
 *
 * @returns Array of oracle IDs
 *
 * @example
 * ```ts
 * const cardIds = await getMonitoredCardIds()
 * console.log(`Monitoring ${cardIds.length} cards`)
 * ```
 */
async function getMonitoredCardIds(): Promise<string[]> {
  try {
    const allCards = await db.query.cards.findMany({
      columns: {
        oracleId: true,
      },
    })

    return allCards.map((card) => card.oracleId)
  } catch (error) {
    logger.error(`Error getting monitored card IDs: ${error}`)
    return []
  }
}

/**
 * Execute price collection for all monitored cards
 *
 * Runs full orchestration for all cards in the database.
 * Logs execution statistics and errors.
 * Prevents concurrent executions with isRunning flag.
 *
 * @returns Statistics object with success/failure counts
 *
 * @example
 * ```ts
 * const stats = await executePriceCollection()
 * console.log(`Fetched: ${stats.fetched}, Failed: ${stats.failed}`)
 * ```
 */
export async function executePriceCollection(): Promise<{
  total: number
  fetched: number
  skipped: number
  failed: number
}> {
  // Prevent concurrent executions
  if (isRunning) {
    logger.warn('Price collection already running, skipping this execution')
    return {
      total: 0,
      fetched: 0,
      skipped: 0,
      failed: 0,
    }
  }

  isRunning = true
  logger.info('Starting price collection')

  try {
    // Get monitored cards
    const cardIds = await getMonitoredCardIds()

    if (cardIds.length === 0) {
      logger.warn('No monitored cards found in database')
      return {
        total: 0,
        fetched: 0,
        skipped: 0,
        failed: 0,
      }
    }

    logger.info(`Fetching prices for ${cardIds.length} monitored cards`)

    // Execute orchestration
    const stats = await fetchAllPrices(cardIds)

    logger.info(
      `Price collection complete: ${stats.fetched} fetched, ${stats.skipped} skipped, ${stats.failed} failed`,
    )

    if (stats.errors.length > 0) {
      logger.warn(`Encountered ${stats.errors.length} errors during collection`)
      for (const error of stats.errors.slice(0, 5)) {
        logger.debug(`  - ${error}`)
      }
      if (stats.errors.length > 5) {
        logger.debug(`  ... and ${stats.errors.length - 5} more errors`)
      }
    }

    // Phase 4 D-22: Run opportunity detection synchronously after fetchAllPrices.
    // Detection failures are logged but MUST NOT mark the collection run as failed.
    try {
      const detectionConfig = loadDetectionConfig()
      // Single-user mode: userId = 1 per Phase 1 D-09.
      const opportunities = await detectOpportunitiesForWishlist(1, detectionConfig)
      const digestResult = await sendDigestAndPersist(opportunities)
      logger.info(
        `Opportunity detection complete: ${digestResult.persisted} persisted, sent=${digestResult.sent}${
          digestResult.error ? ` error=${digestResult.error}` : ''
        }`,
      )
    } catch (detectionError) {
      logger.error(
        `Opportunity detection failed (collection run NOT marked as failed): ${
          detectionError instanceof Error ? detectionError.message : String(detectionError)
        }`,
      )
    }

    return {
      total: cardIds.length,
      fetched: stats.fetched,
      skipped: stats.skipped,
      failed: stats.failed,
    }
  } catch (error) {
    logger.error(`Critical error during price collection: ${error}`)
    return {
      total: 0,
      fetched: 0,
      skipped: 0,
      failed: 1,
    }
  } finally {
    isRunning = false
  }
}

/**
 * Scheduled task instances
 */
let morningJob: cron.ScheduledTask | null = null
let afternoonJob: cron.ScheduledTask | null = null
let eveningJob: cron.ScheduledTask | null = null
let metagameJob: cron.ScheduledTask | null = null

/**
 * Schedule price collection with node-cron
 *
 * Configures 3 cron jobs for 2-3x daily price checks.
 * Default schedule: 9AM, 3PM, 9PM (Brazil time).
 *
 * Claude's discretion: Schedule times configurable via environment variables.
 *
 * @returns Object with start() and stop() methods
 *
 * @example
 * ```ts
 * const scheduler = schedulePriceCollection()
 * scheduler.start() // Begin scheduled collection
 * scheduler.stop() // Stop scheduled collection
 * ```
 */
export function schedulePriceCollection(): {
  start: () => void
  stop: () => void
} {
  // Schedule times (configurable via environment variables)
  const morningSchedule = process.env.CRON_MORNING || '0 9 * * *' // 9:00 AM daily
  const afternoonSchedule = process.env.CRON_AFTERNOON || '0 15 * * *' // 3:00 PM daily
  const eveningSchedule = process.env.CRON_EVENING || '0 21 * * *' // 9:00 PM daily

  logger.info(
    `Scheduling price collection: morning=${morningSchedule}, afternoon=${afternoonSchedule}, evening=${eveningSchedule}`,
  )

  // Create morning job
  morningJob = cron.schedule(
    morningSchedule,
    async () => {
      logger.info('Morning price collection triggered')
      await executePriceCollection()
    },
    { scheduled: false },
  )

  // Create afternoon job
  afternoonJob = cron.schedule(
    afternoonSchedule,
    async () => {
      logger.info('Afternoon price collection triggered')
      await executePriceCollection()
    },
    { scheduled: false },
  )

  // Create evening job
  eveningJob = cron.schedule(
    eveningSchedule,
    async () => {
      logger.info('Evening price collection triggered')
      await executePriceCollection()
    },
    { scheduled: false },
  )

  return {
    start: () => {
      logger.info('Starting price collection scheduler')
      morningJob?.start()
      afternoonJob?.start()
      eveningJob?.start()
    },
    stop: () => {
      logger.info('Stopping price collection scheduler')
      morningJob?.stop()
      afternoonJob?.stop()
      eveningJob?.stop()
    },
  }
}

/**
 * Schedule weekly metagame refresh with node-cron.
 *
 * Per CONTEXT.md D-02: Weekly Sunday refresh, dedicated cron job
 * (NOT interleaved inside executePriceCollection).
 *
 * Default schedule: '0 2 * * 0' = 2:00 AM every Sunday.
 * Override via process.env.CRON_METAGAME_REFRESH.
 *
 * The cron callback invokes executeMetagameRefresh() from @/scraper/metagame
 * and logs the returned summary. Defensive try/catch ensures the scheduler
 * never crashes even if the orchestrator throws.
 *
 * @returns Object with start() and stop() methods, mirroring schedulePriceCollection
 *
 * @example
 * ```ts
 * const refresher = scheduleMetagameRefresh()
 * refresher.start() // begin weekly cron
 * refresher.stop()  // halt weekly cron (e.g., on bot shutdown)
 * ```
 */
export function scheduleMetagameRefresh(): {
  start: () => void
  stop: () => void
} {
  const schedule = process.env.CRON_METAGAME_REFRESH || '0 2 * * 0' // Sunday 2:00 AM

  logger.info(`Scheduling metagame refresh: schedule=${schedule}`)

  metagameJob = cron.schedule(
    schedule,
    async () => {
      logger.info('Weekly metagame refresh triggered')
      try {
        const summary = await executeMetagameRefresh()
        logger.info(`Weekly metagame refresh complete: ${JSON.stringify(summary)}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Weekly metagame refresh threw an error (scheduler continues): ${message}`)
      }
    },
    { scheduled: false },
  )

  return {
    start: () => {
      logger.info('Starting metagame refresh scheduler')
      metagameJob?.start()
    },
    stop: () => {
      logger.info('Stopping metagame refresh scheduler')
      metagameJob?.stop()
    },
  }
}

// Export executePriceCollection for manual testing
export { executePriceCollection as default }
