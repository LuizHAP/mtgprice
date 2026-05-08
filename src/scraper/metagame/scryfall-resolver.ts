/**
 * Scryfall name → oracle_id batch resolver.
 *
 * Resolves card names harvested from EDHREC/MTGTop8 to Scryfall oracle_ids
 * via the /cards/collection batch endpoint (RESEARCH.md Pattern 3).
 *
 * Rate limit: 2 req/s on heavy endpoints (RESEARCH.md Pitfall 3).
 * MUST use RATE_LIMITS.SCRYFALL_HEAVY (NOT SCRYFALL) — using the regular
 * SCRYFALL preset (10 req/s) will trigger HTTP 429 from Scryfall.
 *
 * Resilience:
 * - Empty input → returns [] without any HTTP call
 * - Single batch failure → logs error, continues with remaining batches
 * - Rate-limit denial → sleeps 500ms and retries once before skipping batch
 * - not_found names → logged as warnings, skipped from result
 *
 * Returns full ScryfallCard metadata alongside oracleId so the orchestrator
 * (Plan 04) can call upsertCards() without a second Scryfall round-trip
 * for D-06 (cards table upsert before wishlist insert).
 */

import axios from 'axios'
import { logger } from '@/lib/logger'
import { RATE_LIMITS, checkRateLimitPreset } from '@/lib/ratelimit/rate-limiter'
import type { ScryfallCard } from '@/scraper/providers/scryfall'

const SCRYFALL_COLLECTION_URL = 'https://api.scryfall.com/cards/collection'
const BATCH_SIZE = 75 // Scryfall documented limit
const RATE_LIMIT_KEY = 'scryfall:collection'
const RETRY_SLEEP_MS = 500

export interface ResolvedCard {
  name: string
  oracleId: string
  metadata: ScryfallCard
}

interface ScryfallCollectionResponse {
  data: ScryfallCard[]
  not_found?: Array<{ name?: string }>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Resolve a list of card names to oracle_ids via Scryfall /cards/collection.
 *
 * @param names Card names to resolve (already trimmed and length-capped by Plan 02 fetchers)
 * @returns Array of { name, oracleId, metadata } for each successfully resolved card
 */
export async function resolveNamesToOracleIds(names: string[]): Promise<ResolvedCard[]> {
  // Defensive: filter empty/whitespace names AND short-circuit on empty input
  const validNames = names.map((n) => n.trim()).filter((n) => n.length > 0)
  if (validNames.length === 0) {
    return []
  }

  const results: ResolvedCard[] = []

  for (let i = 0; i < validNames.length; i += BATCH_SIZE) {
    const batch = validNames.slice(i, i + BATCH_SIZE)

    // Rate limit gate (Pitfall 3)
    let rl = await checkRateLimitPreset(RATE_LIMIT_KEY, RATE_LIMITS.SCRYFALL_HEAVY)
    if (!rl.allowed) {
      await sleep(RETRY_SLEEP_MS)
      rl = await checkRateLimitPreset(RATE_LIMIT_KEY, RATE_LIMITS.SCRYFALL_HEAVY)
      if (!rl.allowed) {
        logger.warn(
          `Scryfall rate limit still blocking after retry; skipping batch of ${batch.length} names`,
        )
        continue
      }
    }

    try {
      const { data } = await axios.post<ScryfallCollectionResponse>(SCRYFALL_COLLECTION_URL, {
        identifiers: batch.map((name) => ({ name })),
      })

      for (const card of data.data ?? []) {
        if (card.oracle_id && card.name) {
          results.push({ name: card.name, oracleId: card.oracle_id, metadata: card })
        }
      }

      for (const nf of data.not_found ?? []) {
        logger.warn(`Scryfall could not resolve name: ${nf?.name ?? '(unknown)'}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(
        `Scryfall /cards/collection batch failed (${batch.length} names; continuing with next batch): ${message}`,
      )
      // continue — partial success is preferred over abort
    }
  }

  logger.info(`Scryfall resolver: resolved ${results.length}/${validNames.length} names`)
  return results
}
