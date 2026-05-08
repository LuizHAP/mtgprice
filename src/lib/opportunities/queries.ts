/**
 * Database query layer for opportunity detection.
 *
 * This module provides:
 * 1. Individual DB query functions (getBaselineMean, getPriceSevenDaysAgo, etc.)
 * 2. D-07 candidate state machine helpers (getCandidate, insertCandidate, deleteCandidate, deleteStaleCandidates)
 * 3. Opportunity persistence (insertOpportunity, markOpportunitySent, getUnsentOpportunitiesLast24h, getRecentOpportunities)
 * 4. Orchestrator (detectOpportunitiesForWishlist) — joins wishlist × sources, runs the D-07 state machine
 *
 * NOTE: All (card, source) pair evaluations use the canonical source values:
 *   'ligamagic' | 'tcgplayer' | 'cardmarket' | 'cardkingdom'
 * The pre-existing Phase 3 typo 'liga_magic' (with underscore) is NEVER used here.
 *
 * Security: All user-adjacent inputs (cardId, source) pass through Drizzle eq() which
 * parameterizes the query. Raw SQL template literals only embed validated config numbers
 * (baselineDays, cooldownDays) and compile-time constants. No raw string interpolation
 * of cardId or source into SQL.
 */

import { db } from '@/db'
import { cards, detectionCandidates, opportunities, prices } from '@/db/schema'
import { logger } from '@/lib/logger'
import { getUserWishlist } from '@/lib/wishlist/queries'
import { and, desc, eq, gt, lt, sql } from 'drizzle-orm'
import type { DetectionConfig } from './config'
import { evaluateCandidate } from './detector'

// ─── Types ────────────────────────────────────────────────────────────────────

const OPPORTUNITY_SOURCES = ['ligamagic', 'tcgplayer', 'cardmarket', 'cardkingdom'] as const
type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number]

/**
 * Detected opportunity ready for persistence and notification.
 * Shape is fixed — Plan 04 (scheduler) and Plan 05 (/history) depend on these field names.
 */
export interface DetectedOpportunity {
  /** Oracle ID — primary key in cards table */
  cardId: string
  /** Card name joined from cards.name for digest display */
  cardName: string
  /** Price source — one of the canonical 4 sources */
  source: OpportunitySource
  /** Most recent price_brl */
  currentPrice: number
  /** 30-day mean of price_brl */
  baselinePrice: number
  /** Price approximately lookbackDays ago (±6h) */
  sevenDayAgoPrice: number
  /** Positive number, e.g. 18.34 for an 18.34% drop */
  dropPercent: number
}

/**
 * Row returned by getRecentOpportunities for the /history command.
 */
export interface OpportunityHistoryRow {
  detectedAt: Date
  cardName: string
  source: OpportunitySource
  currentPrice: number
  dropPercent: number
}

// ─── 1. getBaselineMean ────────────────────────────────────────────────────────

/**
 * Compute the average price_brl for a (card, source) pair over the past baselineDays days.
 *
 * @returns Average as a number, or null if no price rows exist in the window.
 */
export async function getBaselineMean(
  cardId: string,
  source: string,
  config: DetectionConfig,
): Promise<number | null> {
  const [row] = await db
    .select({ avg: sql<string>`AVG(${prices.priceBrl}::numeric)` })
    .from(prices)
    .where(
      and(
        eq(prices.cardId, cardId),
        eq(prices.source, source),
        gt(prices.timestamp, sql`now() - (${config.baselineDays} || ' days')::interval`),
      ),
    )
    .limit(1)
  return row?.avg ? Number(row.avg) : null
}

// ─── 2. getPriceSevenDaysAgo ───────────────────────────────────────────────────

/**
 * Find the price row closest to (now - lookbackDays days), within a ±6h tolerance window.
 *
 * @returns Price as a number, or null if no row exists within tolerance.
 */
export async function getPriceSevenDaysAgo(
  cardId: string,
  source: string,
  config: DetectionConfig,
): Promise<number | null> {
  const [row] = await db
    .select({ priceBrl: prices.priceBrl })
    .from(prices)
    .where(
      and(
        eq(prices.cardId, cardId),
        eq(prices.source, source),
        // Within ±6h of the target lookback timestamp
        gt(prices.timestamp, sql`now() - (${config.lookbackDays} || ' days')::interval - interval '6 hours'`),
        lt(prices.timestamp, sql`now() - (${config.lookbackDays} || ' days')::interval + interval '6 hours'`),
      ),
    )
    .orderBy(
      sql`ABS(EXTRACT(EPOCH FROM (${prices.timestamp} - (now() - (${config.lookbackDays} || ' days')::interval))))`,
    )
    .limit(1)
  return row?.priceBrl ? Number(row.priceBrl) : null
}

// ─── 3. getLatestPrice ────────────────────────────────────────────────────────

/**
 * Retrieve the most recent price_brl for a (card, source) pair.
 *
 * @returns Price as a number, or null if no row exists.
 */
export async function getLatestPrice(cardId: string, source: string): Promise<number | null> {
  const [row] = await db
    .select({ priceBrl: prices.priceBrl })
    .from(prices)
    .where(and(eq(prices.cardId, cardId), eq(prices.source, source)))
    .orderBy(desc(prices.timestamp))
    .limit(1)
  return row?.priceBrl ? Number(row.priceBrl) : null
}

// ─── 4. getHistoryDaysForPair ──────────────────────────────────────────────────

/**
 * Number of days of price history available for a (card, source) pair.
 *
 * Computed as the elapsed time (in days) from the earliest price row to now.
 *
 * @returns Days as a number (0 if no rows exist).
 */
export async function getHistoryDaysForPair(cardId: string, source: string): Promise<number> {
  const [row] = await db
    .select({
      days: sql<string>`EXTRACT(EPOCH FROM (now() - MIN(${prices.timestamp}))) / 86400`,
    })
    .from(prices)
    .where(and(eq(prices.cardId, cardId), eq(prices.source, source)))
    .limit(1)
  return row?.days ? Number(row.days) : 0
}

// ─── 5. isInCooldown ──────────────────────────────────────────────────────────

/**
 * Return true when a prior alert for (card, source) was fired within cooldownDays days.
 *
 * Implements D-12/D-13. A pair in cooldown is silenced regardless of candidate state.
 */
export async function isInCooldown(
  cardId: string,
  source: string,
  config: DetectionConfig,
): Promise<boolean> {
  const rows = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.cardId, cardId),
        eq(opportunities.source, source),
        gt(opportunities.detectedAt, sql`now() - (${config.cooldownDays} || ' days')::interval`),
      ),
    )
    .limit(1)
  return rows.length > 0
}

// ─── 6. getCandidate ──────────────────────────────────────────────────────────

/**
 * Retrieve the D-07 candidate row for a (card, source) pair.
 *
 * @returns Candidate data, or null if no candidate row exists.
 */
export async function getCandidate(
  cardId: string,
  source: string,
): Promise<{ id: number; firstSeenAt: Date } | null> {
  const [row] = await db
    .select({ id: detectionCandidates.id, firstSeenAt: detectionCandidates.firstSeenAt })
    .from(detectionCandidates)
    .where(and(eq(detectionCandidates.cardId, cardId), eq(detectionCandidates.source, source)))
    .limit(1)
  return row ?? null
}

// ─── 7. insertCandidate ───────────────────────────────────────────────────────

/**
 * Insert a D-07 candidate row for (card, source).
 *
 * Idempotent: uses ON CONFLICT DO NOTHING (UNIQUE constraint on card_id, source).
 */
export async function insertCandidate(cardId: string, source: string): Promise<void> {
  await db.insert(detectionCandidates).values({ cardId, source }).onConflictDoNothing()
}

// ─── 8. deleteCandidate ───────────────────────────────────────────────────────

/**
 * Delete the D-07 candidate row for (card, source). No-op if no row exists.
 */
export async function deleteCandidate(cardId: string, source: string): Promise<void> {
  await db
    .delete(detectionCandidates)
    .where(and(eq(detectionCandidates.cardId, cardId), eq(detectionCandidates.source, source)))
}

// ─── 9. deleteStaleCandidates ─────────────────────────────────────────────────

/**
 * Delete all candidate rows where first_seen_at < now() - 2 days.
 *
 * Rationale (D-07): if a card temporarily disappears from the scrape (network failure,
 * provider outage), its candidate row would linger forever without this sweep.
 *
 * @returns Number of rows deleted.
 */
export async function deleteStaleCandidates(): Promise<number> {
  const result = await db
    .delete(detectionCandidates)
    .where(sql`${detectionCandidates.firstSeenAt} < now() - interval '2 days'`)
    .returning({ id: detectionCandidates.id })
  return result.length
}

// ─── 10. insertOpportunity ────────────────────────────────────────────────────

/**
 * Insert a promoted opportunity into the opportunities table.
 *
 * All numeric columns are sent as strings (Drizzle numeric mapping requirement).
 *
 * Uses onConflictDoNothing() to guard against duplicate inserts from concurrent
 * runs (paired with the partial unique index on (card_id, source) where
 * sent_to_user = false). Returns null when a conflict is silently skipped.
 *
 * @returns The inserted row with id and sentToUser, or null on conflict.
 */
export async function insertOpportunity(
  op: DetectedOpportunity,
): Promise<{ id: number; sentToUser: boolean } | null> {
  const [row] = await db
    .insert(opportunities)
    .values({
      cardId: op.cardId,
      source: op.source,
      currentPrice: op.currentPrice.toFixed(2),
      baselinePrice: op.baselinePrice.toFixed(2),
      dropPercent: op.dropPercent.toFixed(2),
    })
    .onConflictDoNothing()
    .returning({ id: opportunities.id, sentToUser: opportunities.sentToUser })
  return row ?? null
}

// ─── 11. markOpportunitySent ──────────────────────────────────────────────────

/**
 * Mark an opportunity as sent to the user.
 */
export async function markOpportunitySent(id: number): Promise<void> {
  await db.update(opportunities).set({ sentToUser: true }).where(eq(opportunities.id, id))
}

// ─── 12. getUnsentOpportunitiesLast24h ────────────────────────────────────────

/**
 * Retrieve unsent opportunities from the last 24 hours (D-24 retry support).
 *
 * Joins opportunities with cards to populate cardName.
 *
 * @returns Array of DetectedOpportunity & { id: number } for each unsent row.
 */
export async function getUnsentOpportunitiesLast24h(): Promise<(DetectedOpportunity & { id: number })[]> {
  const rows = await db
    .select({
      id: opportunities.id,
      cardId: opportunities.cardId,
      cardName: cards.name,
      source: opportunities.source,
      currentPrice: opportunities.currentPrice,
      baselinePrice: opportunities.baselinePrice,
      dropPercent: opportunities.dropPercent,
    })
    .from(opportunities)
    .innerJoin(cards, eq(cards.oracleId, opportunities.cardId))
    .where(
      and(
        eq(opportunities.sentToUser, false),
        gt(opportunities.detectedAt, sql`now() - interval '24 hours'`),
      ),
    )
    .orderBy(desc(opportunities.detectedAt))

  return rows.map((row) => ({
    id: row.id,
    cardId: row.cardId,
    cardName: row.cardName,
    source: row.source as OpportunitySource,
    currentPrice: Number(row.currentPrice),
    baselinePrice: Number(row.baselinePrice),
    sevenDayAgoPrice: 0, // Not stored in DB; use 0 as placeholder for retry path
    dropPercent: Number(row.dropPercent),
  }))
}

// ─── 13. getRecentOpportunities ───────────────────────────────────────────────

/**
 * Retrieve the N most recent opportunities for the /history command.
 *
 * @param limit - Maximum rows to return (default 10).
 * @returns Array of OpportunityHistoryRow ordered by detectedAt DESC.
 */
export async function getRecentOpportunities(limit = 10): Promise<OpportunityHistoryRow[]> {
  const rows = await db
    .select({
      detectedAt: opportunities.detectedAt,
      cardName: cards.name,
      source: opportunities.source,
      currentPrice: opportunities.currentPrice,
      dropPercent: opportunities.dropPercent,
    })
    .from(opportunities)
    .innerJoin(cards, eq(cards.oracleId, opportunities.cardId))
    .orderBy(desc(opportunities.detectedAt))
    .limit(limit)

  return rows.map((row) => ({
    detectedAt: row.detectedAt,
    cardName: row.cardName,
    source: row.source as OpportunitySource,
    currentPrice: Number(row.currentPrice),
    dropPercent: Number(row.dropPercent),
  }))
}

// ─── 14. detectOpportunitiesForWishlist (Orchestrator) ───────────────────────

/**
 * Orchestrate opportunity detection for a user's wishlist.
 *
 * Implements the D-07 candidate state machine:
 *   - Step 3 (before loop): delete stale detection_candidates rows
 *   - Precondition: skip pairs in cooldown (D-12/D-13)
 *   - Step 1: evaluateCandidate fires=false → deleteCandidate (streak broken)
 *   - Step 2a: evaluateCandidate fires=true, no existing candidate → insertCandidate (run 1)
 *   - Step 2b: evaluateCandidate fires=true, existing candidate → PROMOTE + deleteCandidate (run 2)
 *
 * Logging: logs card IDs and source names at debug, summary counts at info.
 * NEVER logs userId, Telegram tokens, or raw prices at info level.
 *
 * @param userId - User whose wishlist is scanned
 * @param config - Detection configuration
 * @returns Array of DetectedOpportunity objects ready for persistence by Plan 04
 */
export async function detectOpportunitiesForWishlist(
  userId: number,
  config: DetectionConfig,
): Promise<DetectedOpportunity[]> {
  // Step 3 (once per run, before pair loop): stale housekeeping
  const staleDeleted = await deleteStaleCandidates()
  logger.debug(`D-07 housekeeping: deleted ${staleDeleted} stale detection_candidates rows`)

  const wishlist = await getUserWishlist(userId)
  const results: DetectedOpportunity[] = []
  let eligiblePairs = 0

  for (const card of wishlist) {
    for (const source of OPPORTUNITY_SOURCES) {
      // Precondition: cooldown check (D-12/D-13)
      if (await isInCooldown(card.oracleId, source, config)) {
        logger.debug(`Skipping ${card.oracleId}/${source}: in cooldown`)
        continue
      }
      eligiblePairs += 1

      // Gather all price data for the pair in parallel
      const [latest, baseline, sevenDayAgo, historyDays] = await Promise.all([
        getLatestPrice(card.oracleId, source),
        getBaselineMean(card.oracleId, source, config),
        getPriceSevenDaysAgo(card.oracleId, source, config),
        getHistoryDaysForPair(card.oracleId, source),
      ])

      logger.debug(
        `Evaluating ${card.oracleId}/${source}: latest=${latest}, baseline=${baseline}, sevenDayAgo=${sevenDayAgo}, historyDays=${historyDays}`,
      )

      const result = evaluateCandidate({ latest, baseline, sevenDayAgo, historyDays }, config)

      if (!result.fires) {
        // Step 1: evaluation did NOT confirm the pair — break any existing streak
        await deleteCandidate(card.oracleId, source)
        logger.debug(`D-07 streak broken for ${card.oracleId}/${source}: reason=${result.reason}`)
        continue
      }

      // Step 2: pair confirmed this run — check existing candidate row
      const existing = await getCandidate(card.oracleId, source)

      if (existing === null) {
        // Step 2a: first confirming run — record candidate, do NOT alert yet
        await insertCandidate(card.oracleId, source)
        logger.debug(`D-07 candidate created for ${card.oracleId}/${source}`)
        continue
      }

      // Step 2b: second consecutive confirming run — PROMOTE
      // At this point latest, baseline, sevenDayAgo are non-null (evaluateCandidate verified them)
      // and result.dropPercent is set (fires === true). Use nullish coalescing as a biome-safe fallback.
      results.push({
        cardId: card.oracleId,
        cardName: card.name,
        source,
        currentPrice: latest ?? 0,
        baselinePrice: baseline ?? 0,
        sevenDayAgoPrice: sevenDayAgo ?? 0,
        dropPercent: result.dropPercent ?? 0,
      })
      await deleteCandidate(card.oracleId, source)
      logger.debug(`D-07 promotion for ${card.oracleId}/${source}`)
    }
  }

  logger.info(
    `Detection complete: wishlist=${wishlist.length} cards, eligible pairs=${eligiblePairs}, promotions=${results.length}`,
  )
  return results
}
