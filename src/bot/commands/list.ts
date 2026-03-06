/**
 * /list command handler
 *
 * Displays the user's wishlist as a numbered list with prices and trends.
 * Shows best price, source, and price trend for each card.
 * Applies rate limiting to prevent spam (10 requests per minute).
 */

import { rateLimitMiddleware } from '@/bot/middleware/rate-limit'
import { formatCardWithPrice, formatEmptyWishlist } from '@/bot/utils/format'
import { bot } from '@/lib/telegram'
import { getUserWishlist } from '@/lib/wishlist/queries'
import {
  calculatePriceTrend,
  getBestPrice,
  getLatestPricesForCard,
  getPriceHistory,
} from '@/lib/wishlist/queries'
import type { Context } from 'grammy'

/**
 * Telegram message size limit
 *
 * Telegram messages are limited to 4096 characters.
 * Long wishlists need to be split into multiple messages.
 */
const TELEGRAM_MESSAGE_LIMIT = 4096

/**
 * /list command handler with rate limiting
 *
 * Displays the user's wishlist as a numbered list.
 * Each entry shows: index, card name, best price, source, trend
 *
 * Format: "📈 [N] Card Name - R$ X (Source) - ↑10%"
 *
 * Handles empty wishlist and splits long messages.
 */
bot.command('list', rateLimitMiddleware, async (ctx: Context) => {
  const userId = 1 // Single-user mode

  try {
    // Get user's wishlist
    const wishlist = await getUserWishlist(userId)

    // Handle empty wishlist
    if (wishlist.length === 0) {
      await ctx.reply(formatEmptyWishlist())
      return
    }

    // Build message with prices and trends for each card
    const cardEntries = []

    for (let i = 0; i < wishlist.length; i++) {
      const card = wishlist[i]

      // Get latest prices from all 4 sources
      const prices = await getLatestPricesForCard(card.oracleId)

      // Find best price
      const bestPrice = getBestPrice(prices)

      // Get price history for trend calculation
      const priceHistory = await getPriceHistory(card.oracleId, 100)

      // Calculate trend (use best price or 0 if no prices)
      const currentPrice = bestPrice?.priceBrl || 0
      const trend = calculatePriceTrend(currentPrice, priceHistory)

      // Format card entry with index (1-based)
      const entry = formatCardWithPrice(
        {
          ...card,
          prices,
          bestPrice,
          priceTrend: trend,
        },
        i + 1,
      )

      cardEntries.push(entry)
    }

    // Join entries with newlines
    const fullMessage = cardEntries.join('\n')

    // Check if message exceeds Telegram limit
    if (fullMessage.length <= TELEGRAM_MESSAGE_LIMIT) {
      // Send as single message
      await ctx.reply(fullMessage)
    } else {
      // Split into multiple messages
      const messages = splitMessage(fullMessage, TELEGRAM_MESSAGE_LIMIT)

      for (const msg of messages) {
        await ctx.reply(msg)
      }
    }
  } catch (error) {
    console.error('Error in /list command:', error)
    await ctx.reply('An error occurred while fetching your wishlist. Please try again.')
  }
})

/**
 * Split long message into chunks
 *
 * Splits a message at newlines to avoid breaking card entries.
 * Each chunk is guaranteed to be under the limit.
 *
 * @param message - Full message to split
 * @param limit - Maximum length per chunk
 * @returns Array of message chunks
 */
function splitMessage(message: string, limit: number): string[] {
  const chunks: string[] = []
  const lines = message.split('\n')

  let currentChunk = ''

  for (const line of lines) {
    // Check if adding this line would exceed the limit
    if (currentChunk.length + line.length + 1 > limit) {
      // Save current chunk and start new one
      if (currentChunk) {
        chunks.push(currentChunk)
      }
      currentChunk = line
    } else {
      // Add line to current chunk
      currentChunk = currentChunk ? `${currentChunk}\n${line}` : line
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks
}
