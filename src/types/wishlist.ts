/**
 * Wishlist type definitions
 *
 * Type definitions for wishlist management including card metadata,
 * price information, and input types for API operations.
 */

import type { cards, wishlists } from '@/db/schema'

/**
 * Wishlist item with card metadata
 * Extends card information with the date it was added to wishlist
 */
export type WishlistItem = typeof cards.$inferSelect & {
  addedAt: Date
}

/**
 * Wishlist item enriched with prices from all 4 sources
 * Includes latest prices, best price calculation, and price trend
 */
export type WishlistWithPrices = WishlistItem & {
  prices: {
    ligaMagic: number | null
    tcgplayer: number | null
    cardmarket: number | null
    cardkingdom: number | null
  }
  bestPrice: BestPrice | null
  priceTrend: PriceTrend
}

/**
 * Best price across all sources
 */
export type BestPrice = {
  source: string
  priceBrl: number
}

/**
 * Price trend indicator
 */
export type PriceTrend = {
  trend: 'up' | 'down' | 'stable'
  percentChange: number | null
}

/**
 * Input type for adding card to wishlist
 */
export type AddCardInput = {
  cardId: string
}

/**
 * Input type for removing card from wishlist
 */
export type RemoveCardInput = {
  cardId: string
}
