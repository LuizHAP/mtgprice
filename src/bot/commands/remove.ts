/**
 * /remove command handler
 *
 * Allows users to remove cards from their wishlist via Telegram bot.
 * Supports removal by card name (exact match) or index number (from /list).
 */

import { formatNotInWishlistError, formatRemoveSuccess } from '@/bot/utils/format'
import { bot } from '@/lib/telegram'
import { getUserWishlist, removeCardFromWishlist } from '@/lib/wishlist/queries'
import type { Context } from 'grammy'

/**
 * /remove command handler
 *
 * Removes cards from the user's wishlist.
 * - By name: searches for exact match (case-insensitive)
 * - By index: removes card at that position from /list output
 *
 * Usage: /remove Black Lotus
 * Usage: /remove 3
 */
bot.command('remove', async (ctx: Context) => {
  // Extract argument from command
  const arg = ctx.match

  if (!arg || typeof arg !== 'string') {
    await ctx.reply('Usage: /remove <card name or index>')
    return
  }

  const trimmedArg = arg.trim()

  if (!trimmedArg) {
    await ctx.reply('Usage: /remove <card name or index>')
    return
  }

  const userId = 1 // Single-user mode

  try {
    // Check if argument is a number (index)
    const isNumber = /^\d+$/.test(trimmedArg)

    if (isNumber) {
      // Remove by index
      await removeByIndex(ctx, userId, Number.parseInt(trimmedArg, 10))
    } else {
      // Remove by card name
      await removeByName(ctx, userId, trimmedArg)
    }
  } catch (error) {
    console.error('Error in /remove command:', error)
    await ctx.reply('An error occurred while removing the card. Please try again.')
  }
})

/**
 * Remove card from wishlist by index number
 *
 * Removes the card at the specified index from the user's wishlist.
 * Index is 1-based (matches /list output).
 *
 * @param ctx - grammY context
 * @param userId - User ID (single-user mode: 1)
 * @param index - Index number (1-based)
 */
async function removeByIndex(ctx: Context, userId: number, index: number): Promise<void> {
  // Get user's wishlist
  const wishlist = await getUserWishlist(userId)

  // Validate index is within range
  if (index < 1 || index > wishlist.length) {
    await ctx.reply(
      `Invalid index. Your wishlist has ${wishlist.length} cards. Use /list to see your wishlist.`,
    )
    return
  }

  // Get card at index
  const card = wishlist[index - 1]

  try {
    await removeCardFromWishlist(userId, card.oracleId)
    await ctx.reply(formatRemoveSuccess(card.name))
  } catch (error) {
    if (error instanceof Error && error.message === 'Card not in wishlist') {
      await ctx.reply(formatNotInWishlistError(card.name))
    } else {
      throw error
    }
  }
}

/**
 * Remove card from wishlist by name
 *
 * Searches for exact name match (case-insensitive) and removes it.
 *
 * @param ctx - grammY context
 * @param userId - User ID (single-user mode: 1)
 * @param cardName - Card name to search for
 */
async function removeByName(ctx: Context, userId: number, cardName: string): Promise<void> {
  // Get user's wishlist
  const wishlist = await getUserWishlist(userId)

  // Search for exact name match (case-insensitive)
  const card = wishlist.find((item) => item.name.toLowerCase() === cardName.toLowerCase())

  if (!card) {
    await ctx.reply(formatNotInWishlistError(cardName))
    return
  }

  try {
    await removeCardFromWishlist(userId, card.oracleId)
    await ctx.reply(formatRemoveSuccess(card.name))
  } catch (error) {
    if (error instanceof Error && error.message === 'Card not in wishlist') {
      await ctx.reply(formatNotInWishlistError(card.name))
    } else {
      throw error
    }
  }
}
