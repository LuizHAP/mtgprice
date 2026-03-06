/**
 * /price command handler
 *
 * Shows the current best price for a specific card across all 4 sources.
 * Aggregates prices by oracle_id (multiple printings).
 * Shows price trend vs last week.
 */

import { formatCardNotFoundError, formatPriceComparison } from '@/bot/utils/format'
import { db } from '@/db'
import { cards } from '@/db/schema'
import { bot } from '@/lib/telegram'
import {
  calculatePriceTrend,
  getBestPrice,
  getLatestPricesForCard,
  getPriceHistory,
} from '@/lib/wishlist/queries'
import { ilike } from 'drizzle-orm'
import type { Context } from 'grammy'

/**
 * /price command handler
 *
 * Shows the best price for a card across all 4 sources.
 * Aggregates prices by oracle_id (all printings of the same card).
 *
 * Format: "Card Name - R$ X (Source) - ↑10%"
 *
 * Usage: /price Black Lotus
 */
bot.command('price', async (ctx: Context) => {
  // Extract query from command arguments
  const query = ctx.match

  if (!query || typeof query !== 'string') {
    await ctx.reply('Usage: /price <card name>')
    return
  }

  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    await ctx.reply('Usage: /price <card name>')
    return
  }

  try {
    // Search for card in database
    const results = await db
      .select()
      .from(cards)
      .where(ilike(cards.name, `%${trimmedQuery}%`))
      .limit(1)

    if (results.length === 0) {
      await ctx.reply(formatCardNotFoundError())
      return
    }

    const card = results[0]

    // Get latest prices from all 4 sources
    const prices = await getLatestPricesForCard(card.oracleId)

    // Find best price
    const bestPrice = getBestPrice(prices)

    // Get price history for trend calculation
    const priceHistory = await getPriceHistory(card.oracleId, 100)

    // Calculate trend (use best price or 0 if no prices)
    const currentPrice = bestPrice?.priceBrl || 0
    const trend = calculatePriceTrend(currentPrice, priceHistory)

    // Format message with all prices and best price
    const message = formatPriceComparison(card.name, prices, bestPrice, trend)

    await ctx.reply(message)
  } catch (error) {
    console.error('Error in /price command:', error)
    await ctx.reply('An error occurred while fetching the price. Please try again.')
  }
})
