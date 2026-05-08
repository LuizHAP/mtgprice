/**
 * Metagame refresh orchestrator.
 *
 * Composes Plan 02's fetchers (EDHREC + MTGTop8) with Plan 03's resolver
 * to upsert top 50 Standard, Modern, and Commander cards into the wishlist
 * for monitoring by Phase 2's price collection pipeline.
 *
 * Decisions implemented:
 * - D-01: Top 50 per format (50 x 3 = max 150 cards)
 * - D-04: Cards inserted into the existing wishlists table
 * - D-05: Stale auto-added rows removed; user-added rows preserved
 * - D-06: Missing cards upserted into cards table BEFORE wishlist insert
 * - D-07: All auto-added cards use userId = 1 (single-user mode)
 *
 * Resilience:
 * - If a fetcher returns empty (source outage), that format is skipped
 * - If ALL sources return empty, the orchestrator skips DB activity entirely
 * - DB errors are caught and logged; never propagate to the scheduler
 */

import { db } from '@/db'
import { cards, wishlists } from '@/db/schema'
import { logger } from '@/lib/logger'
import type { ScryfallCard } from '@/scraper/providers/scryfall'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { fetchEDHRECTopCards } from './edhrec'
import { fetchMTGTop8TopCards } from './mtgtop8'
import { resolveNamesToOracleIds } from './scryfall-resolver'

const METAGAME_USER_ID = 1 // D-07: single-user mode
const TOP_LIMIT_PER_FORMAT = 50 // D-01

export interface MetagameRefreshSummary {
  addedCount: number
  removedCount: number
  skippedCount: number
  perFormat: {
    commander: number
    standard: number
    modern: number
  }
}

/**
 * Upsert ScryfallCards directly into the cards table without the recentSetCodes filter
 * that Phase 2's `upsertCards()` applies. Metagame staples span all sets so the
 * recent-only filter would wrongly exclude them.
 *
 * Idempotent: ON CONFLICT (oracleId) DO UPDATE keeps cards table fresh.
 */
async function upsertResolvedCards(scryfallCards: ScryfallCard[]): Promise<number> {
  if (scryfallCards.length === 0) return 0

  const cardsToInsert = scryfallCards
    .filter((c) => c.oracle_id && c.name)
    .map((card) => {
      let imageUrl: string | undefined
      if (card.image_uris?.normal) imageUrl = card.image_uris.normal
      else if (card.card_faces?.[0]?.image_uris?.normal)
        imageUrl = card.card_faces[0].image_uris.normal

      return {
        oracleId: card.oracle_id,
        name: card.name.slice(0, 255),
        set: card.set ? card.set.slice(0, 10) : null,
        rarity: card.rarity ? card.rarity.slice(0, 50) : null,
        color: card.colors && card.colors.length > 0 ? card.colors.join(',').slice(0, 50) : null,
        imageUrl: imageUrl ?? null,
        lastFetched: new Date(),
      }
    })

  let upserted = 0
  for (const cardData of cardsToInsert) {
    await db
      .insert(cards)
      .values(cardData)
      .onConflictDoUpdate({
        target: cards.oracleId,
        set: {
          name: cardData.name,
          set: cardData.set,
          rarity: cardData.rarity,
          color: cardData.color,
          imageUrl: cardData.imageUrl,
          lastFetched: cardData.lastFetched,
        },
      })
    upserted += 1
  }
  return upserted
}

/**
 * Run the weekly metagame refresh: fetch top 50 per format, resolve to oracle_ids,
 * upsert missing cards, insert auto-added wishlist rows, remove stale auto-added rows.
 */
export async function executeMetagameRefresh(): Promise<MetagameRefreshSummary> {
  const summary: MetagameRefreshSummary = {
    addedCount: 0,
    removedCount: 0,
    skippedCount: 0,
    perFormat: { commander: 0, standard: 0, modern: 0 },
  }

  logger.info('Metagame refresh starting (Standard + Modern + Commander, top 50 each)')

  try {
    // Fetch all three sources in parallel — each returns [] on outage (does not throw)
    const [standardNames, modernNames, commanderNames] = await Promise.all([
      fetchMTGTop8TopCards('ST', TOP_LIMIT_PER_FORMAT),
      fetchMTGTop8TopCards('MO', TOP_LIMIT_PER_FORMAT),
      fetchEDHRECTopCards(TOP_LIMIT_PER_FORMAT),
    ])

    summary.perFormat.standard = standardNames.length
    summary.perFormat.modern = modernNames.length
    summary.perFormat.commander = commanderNames.length

    logger.info(
      `Metagame fetcher results: standard=${standardNames.length} modern=${modernNames.length} commander=${commanderNames.length}`,
    )

    // De-duplicate across formats
    const combined = new Set<string>()
    for (const n of standardNames) combined.add(n)
    for (const n of modernNames) combined.add(n)
    for (const n of commanderNames) combined.add(n)

    if (combined.size === 0) {
      logger.warn('All metagame sources returned empty; skipping DB updates this run')
      return summary
    }

    // Resolve all names to oracle_ids in batched POST(s)
    const resolved = await resolveNamesToOracleIds(Array.from(combined))
    if (resolved.length === 0) {
      logger.warn('Metagame resolver returned 0 cards; skipping DB updates this run')
      return summary
    }

    const newTop150OracleIds = resolved.map((r) => r.oracleId)

    // D-06: identify cards NOT yet in cards table; upsert them BEFORE wishlist insert
    const existingRows = await db
      .select({ oracleId: cards.oracleId })
      .from(cards)
      .where(inArray(cards.oracleId, newTop150OracleIds))
    const existingSet = new Set(existingRows.map((r) => r.oracleId))
    const missingCards = resolved.filter((r) => !existingSet.has(r.oracleId)).map((r) => r.metadata)
    if (missingCards.length > 0) {
      const upserted = await upsertResolvedCards(missingCards)
      logger.info(`Metagame: upserted ${upserted} missing cards into cards table (D-06)`)
    }

    // D-07 + D-04: insert wishlist rows; UNIQUE(userId, cardId) handles duplicates
    const wishlistRows = newTop150OracleIds.map((oracleId) => ({
      userId: METAGAME_USER_ID,
      cardId: oracleId,
      isAutoAdded: true,
    }))
    await db.insert(wishlists).values(wishlistRows).onConflictDoNothing()
    summary.addedCount = wishlistRows.length

    // D-05 + Pitfall 4: remove stale auto-added rows. CRITICAL: filter on isAutoAdded=true
    // so user-added rows are NEVER touched.
    await db
      .delete(wishlists)
      .where(
        and(
          eq(wishlists.userId, METAGAME_USER_ID),
          eq(wishlists.isAutoAdded, true),
          notInArray(wishlists.cardId, newTop150OracleIds),
        ),
      )
    summary.removedCount = 0 // Drizzle delete doesn't return affected count without .returning(); v1 leaves count unsourced

    logger.info(
      `Metagame refresh complete: added=${summary.addedCount} (with conflicts dropped) perFormat=${JSON.stringify(summary.perFormat)}`,
    )
  } catch (error) {
    summary.skippedCount += 1
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`Metagame refresh hit an unexpected error (run NOT aborted): ${message}`)
  }

  return summary
}
