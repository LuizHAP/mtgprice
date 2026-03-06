/**
 * Bot-specific rate limiting middleware
 *
 * grammY middleware for rate limiting bot commands per user.
 * Prevents spam by limiting requests to 10 per minute per user.
 * Uses Redis-backed token bucket algorithm from Phase 1.
 */

import { checkRateLimit } from '@/lib/ratelimit/rate-limiter'
import type { Context, MiddlewareFn } from 'grammy'

/**
 * Rate limit middleware for bot commands
 *
 * Limits each user to 10 requests per minute to prevent spam.
 * Uses chat ID as the rate limit key for per-user limits.
 *
 * Applied to /list and /price commands to prevent abuse.
 * Not applied to /add which has conversational flow with natural delays.
 *
 * @param ctx - grammY context
 * @param next - Next middleware function
 */
export const rateLimitMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  // Extract chat ID from context
  const chatId = ctx.chat?.id

  // Handle missing chat ID gracefully (shouldn't happen with whitelist middleware)
  if (!chatId) {
    await ctx.reply('Unable to identify your chat. Please try again.')
    return
  }

  // Check rate limit: 10 requests per 60 seconds per user
  const { allowed } = await checkRateLimit(`bot:${chatId}`, 10, 60)

  if (!allowed) {
    await ctx.reply('Too many requests. Please wait a minute.')
    return
  }

  // Rate limit check passed, continue to command handler
  await next()
}
