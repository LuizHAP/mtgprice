import { db } from '@/db'
import { cards } from '@/db/schema'
import { ilike } from 'drizzle-orm'

/**
 * Card domain query functions.
 * Extracted from src/app/api/cards/search/route.ts so the same DB query
 * is reusable from API routes and from integration tests (per D-04).
 */

/**
 * The shape returned by searchCards — four columns from the cards table.
 * Nullability mirrors the schema: set and imageUrl are nullable varchar/text.
 */
export type CardSearchResult = {
  oracleId: string
  name: string
  set: string | null
  imageUrl: string | null
}

/**
 * Search for cards by name using a case-insensitive partial match.
 *
 * Throws when the query is too short so callers receive a clear error
 * message consistent with the HTTP 400 copy returned by the route handler.
 *
 * @param query - Search string; must be at least 2 characters long
 * @returns Up to 10 cards whose name matches the query (ilike)
 * @throws Error('Query must be at least 2 characters long') when query.length < 2
 */
export async function searchCards(query: string): Promise<CardSearchResult[]> {
  if (query.length < 2) {
    throw new Error('Query must be at least 2 characters long')
  }

  return db
    .select({
      oracleId: cards.oracleId,
      name: cards.name,
      set: cards.set,
      imageUrl: cards.imageUrl,
    })
    .from(cards)
    .where(ilike(cards.name, `%${query}%`))
    .limit(10)
}
