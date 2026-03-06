/**
 * Bot card search utilities
 *
 * Shared card search logic used by multiple bot commands.
 * Provides database queries for searching cards by name.
 */

import { db } from '@/db'
import { cards } from '@/db/schema'
import { ilike, or } from 'drizzle-orm'

/**
 * Search cards by name in the database
 *
 * Performs case-insensitive partial match search on card names.
 * Limited to 10 results to prevent spam in Telegram.
 *
 * @param query - Search query string
 * @returns Array of matching cards (max 10)
 */
export async function searchCardsByName(query: string): Promise<(typeof cards.$inferSelect)[]> {
  const results = await db
    .select()
    .from(cards)
    .where(or(ilike(cards.name, `%${query}%`)))
    .limit(10)

  return results
}

/**
 * Find exact match among search results
 *
 * Checks if any card in the results exactly matches the query (case-insensitive).
 * Used to auto-add cards when there's an exact match without showing selection list.
 *
 * @param searchResults - Array of cards from search
 * @param query - Original search query
 * @returns Exact matching card or undefined if no exact match
 */
export function findExactMatch(
  searchResults: (typeof cards.$inferSelect)[],
  query: string,
): typeof cards.$inferSelect | undefined {
  const normalizedQuery = query.toLowerCase().trim()

  return searchResults.find((card) => {
    const normalizedName = card.name.toLowerCase().trim()
    return normalizedName === normalizedQuery
  })
}

/**
 * Format search results as numbered list for Telegram
 *
 * Creates a formatted message showing search results with numbers for user selection.
 * Includes set name to help disambiguate between different printings.
 *
 * @param searchResults - Array of cards from search
 * @returns Formatted numbered list string
 */
export function formatCardList(searchResults: (typeof cards.$inferSelect)[]): string {
  const lines = searchResults.map((card, index) => {
    const setName = card.set || 'Unknown Set'
    return `${index + 1}. ${card.name} (${setName})`
  })

  return lines.join('\n')
}

/**
 * Format search results message with instructions
 *
 * Creates the complete message shown to user after search, including
 * the numbered list and instructions for selection.
 *
 * @param searchResults - Array of cards from search
 * @returns Complete message with list and instructions
 */
export function formatSearchResultsMessage(searchResults: (typeof cards.$inferSelect)[]): string {
  const cardList = formatCardList(searchResults)

  return `Multiple cards found:\n\n${cardList}\n\nReply with the number to add.`
}
