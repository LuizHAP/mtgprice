/**
 * Bot message formatting utilities
 *
 * Helper functions for formatting Telegram bot messages including prices,
 * trends, and card information with emoji indicators.
 */

import type { BestPrice, PriceTrend, WishlistWithPrices } from '@/types/wishlist'

/**
 * Format price as BRL currency
 *
 * @param priceBrl - Price in BRL or null if unavailable
 * @returns Formatted price string (e.g., "R$ 123.45") or "N/A" if null
 */
export function formatPrice(priceBrl: number | null): string {
  if (priceBrl === null) {
    return 'N/A'
  }
  return `R$ ${priceBrl.toFixed(2)}`
}

/**
 * Format price trend with emoji indicator
 *
 * @param trend - Price trend object with direction and percentage change
 * @returns Formatted trend string with emoji (e.g., "↑10%" for up, "↓5%" for down, "±" for stable)
 */
export function formatTrend(trend: PriceTrend): string {
  if (trend.trend === 'up') {
    // Red (up is bad for buyers)
    const percentage = trend.percentChange !== null ? `${trend.percentChange}%` : ''
    return `↑${percentage}`
  }
  if (trend.trend === 'down') {
    // Green (down is good for buyers)
    const percentage = trend.percentChange !== null ? `${trend.percentChange}%` : ''
    return `↓${percentage}`
  }
  // Stable
  return '±'
}

/**
 * Format wishlist card entry for /list command
 *
 * @param card - Wishlist item with prices and trend
 * @param index - Index number in the list (1-based)
 * @returns Formatted card entry string (e.g., "📈 [1] Black Lotus - R$ 5000.00 (Liga Magic) - ↑10%")
 */
export function formatCardWithPrice(card: WishlistWithPrices, index: number): string {
  const bestPriceText = card.bestPrice
    ? `${formatPrice(card.bestPrice.priceBrl)} (${card.bestPrice.source})`
    : 'N/A'

  const trendText = formatTrend(card.priceTrend)

  return `📈 [${index}] ${card.name} - ${bestPriceText} - ${trendText}`
}

/**
 * Format price comparison for /price command
 *
 * Shows all 4 sources with their prices for a single card
 *
 * @param cardName - Name of the card
 * @param prices - Object with prices from all 4 sources
 * @param bestPrice - Best price across all sources
 * @param trend - Price trend vs last week
 * @returns Multi-line formatted message with all prices
 */
export function formatPriceComparison(
  cardName: string,
  prices: {
    ligaMagic: number | null
    tcgplayer: number | null
    cardmarket: number | null
    cardkingdom: number | null
  },
  bestPrice: BestPrice | null,
  trend: PriceTrend,
): string {
  const lines = [
    `💰 ${cardName}`,
    '',
    `💵 Liga Magic: ${formatPrice(prices.ligaMagic)}`,
    `💵 TCGPlayer: ${formatPrice(prices.tcgplayer)}`,
    `💵 CardMarket: ${formatPrice(prices.cardmarket)}`,
    `💵 CardKingdom: ${formatPrice(prices.cardkingdom)}`,
    '',
  ]

  if (bestPrice) {
    const trendText = formatTrend(trend)
    lines.push(`✅ Best: ${formatPrice(bestPrice.priceBrl)} (${bestPrice.source}) - ${trendText}`)
  } else {
    lines.push('❌ No prices available')
  }

  return lines.join('\n')
}

/**
 * Format success message for card added to wishlist
 *
 * @param cardName - Name of the card that was added
 * @returns Success message with confirmation
 */
export function formatAddSuccess(cardName: string): string {
  return `✅ ${cardName} added to wishlist!`
}

/**
 * Format error message for duplicate card
 *
 * @param cardName - Name of the card that's already in wishlist
 * @returns Error message explaining the duplicate
 */
export function formatDuplicateError(cardName: string): string {
  return `❌ ${cardName} is already in your wishlist.`
}

/**
 * Format success message for card removed from wishlist
 *
 * @param cardName - Name of the card that was removed
 * @returns Success message with confirmation
 */
export function formatRemoveSuccess(cardName: string): string {
  return `✅ ${cardName} removed from wishlist.`
}

/**
 * Format error message for card not in wishlist
 *
 * @param cardName - Name of the card that wasn't found
 * @returns Error message explaining the card isn't in wishlist
 */
export function formatNotInWishlistError(cardName: string): string {
  return `❌ ${cardName} is not in your wishlist. Use /list to see your wishlist.`
}

/**
 * Format error message for card not found
 *
 * @returns Error message for search with no results
 */
export function formatCardNotFoundError(): string {
  return '❌ Card not found. Try the exact card name.'
}

/**
 * Format empty wishlist message
 *
 * @returns Friendly message suggesting cards to add
 */
export function formatEmptyWishlist(): string {
  return 'Your wishlist is empty. Use /add to start tracking cards!'
}
