/**
 * /add command handler
 *
 * Allows users to add cards to their wishlist via Telegram bot.
 * Implements search + select pattern for handling multiple matches.
 * Auto-adds exact matches without requiring selection.
 */

import { formatAddSuccess, formatDuplicateError } from '@/bot/utils/format'
import {
  findExactMatch,
  formatCardList,
  formatSearchResultsMessage,
  searchCardsByName,
} from '@/bot/utils/search'
import type { cards } from '@/db/schema'
import { bot } from '@/lib/telegram'
import { addCardToWishlist } from '@/lib/wishlist/queries'
import type { Context } from 'grammy'

/**
 * Pending searches storage for conversational flow
 *
 * Maps chat ID to search results for handling user selection replies.
 * Keys are chat IDs, values are arrays of card search results.
 *
 * Auto-clears after 10 minutes to prevent memory leaks.
 */
const pendingSearches = new Map<number, (typeof cards.$inferSelect)[]>()

/**
 * TTL for pending searches (10 minutes)
 */
const PENDING_SEARCH_TTL = 10 * 60 * 1000

/**
 * /add command handler
 *
 * Searches for cards by name and adds them to the user's wishlist.
 * - Exact match: auto-adds without showing selection list
 * - Multiple matches: shows numbered list, waits for user reply
 * - No results: shows error message
 *
 * Usage: /add Black Lotus
 */
bot.command('add', async (ctx: Context) => {
  // Extract query from command arguments
  const query = ctx.match

  if (!query || typeof query !== 'string') {
    await ctx.reply('Usage: /add <card name>')
    return
  }

  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    await ctx.reply('Usage: /add <card name>')
    return
  }

  try {
    // Search for cards in database
    const results = await searchCardsByName(trimmedQuery)

    if (results.length === 0) {
      await ctx.reply('No cards found. Try a different search term.')
      return
    }

    // Check for exact match (case-insensitive)
    const exactMatch = findExactMatch(results, trimmedQuery)

    if (exactMatch) {
      // Auto-add exact match without showing selection list
      await addCardToWishlistAndReply(ctx, exactMatch.name, exactMatch.oracleId)
      return
    }

    // Multiple matches found - show numbered list
    const message = formatSearchResultsMessage(results)
    await ctx.reply(message)

    // Store search results for user's reply
    const chatId = ctx.chat?.id
    if (chatId) {
      pendingSearches.set(chatId, results)

      // Auto-clear after TTL to prevent memory leaks
      setTimeout(() => {
        pendingSearches.delete(chatId)
      }, PENDING_SEARCH_TTL)
    }
  } catch (error) {
    console.error('Error in /add command:', error)
    await ctx.reply('An error occurred while searching for cards. Please try again.')
  }
})

/**
 * Message handler for number replies (card selection)
 *
 * Handles user replies to search result lists.
 * Expects a number corresponding to the card in the list.
 */
bot.on('msg:text', async (ctx: Context) => {
  const chatId = ctx.chat?.id
  const messageText = ctx.message?.text

  // Ignore if no chat ID or message text
  if (!chatId || !messageText) {
    return
  }

  // Check if this chat has a pending search
  const results = pendingSearches.get(chatId)
  if (!results) {
    return // No pending search, ignore message
  }

  // Parse user selection
  const selection = Number.parseInt(messageText.trim(), 10)

  // Validate selection is a valid number
  if (Number.isNaN(selection)) {
    await ctx.reply('Invalid selection. Please reply with a number from the list.')
    return
  }

  // Validate selection is within range
  if (selection < 1 || selection > results.length) {
    await ctx.reply(`Invalid selection. Please choose a number between 1 and ${results.length}.`)
    return
  }

  // Get selected card
  const selectedCard = results[selection - 1]

  // Add card to wishlist
  await addCardToWishlistAndReply(ctx, selectedCard.name, selectedCard.oracleId)

  // Clear pending search
  pendingSearches.delete(chatId)
})

/**
 * Add card to wishlist and send appropriate reply
 *
 * Handles duplicate card errors and sends success/error messages.
 *
 * @param ctx - grammY context
 * @param cardName - Name of the card
 * @param oracleId - Oracle ID of the card
 */
async function addCardToWishlistAndReply(ctx: Context, cardName: string, oracleId: string): Promise<void> {
  const userId = 1 // Single-user mode

  try {
    await addCardToWishlist(userId, oracleId)
    await ctx.reply(formatAddSuccess(cardName))
  } catch (error) {
    if (error instanceof Error && error.message === 'Card already in wishlist') {
      await ctx.reply(formatDuplicateError(cardName))
    } else {
      console.error('Error adding card to wishlist:', error)
      await ctx.reply('An error occurred while adding the card. Please try again.')
    }
  }
}
