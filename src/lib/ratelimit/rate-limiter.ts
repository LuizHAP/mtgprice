/**
 * Token bucket rate limiting with Redis backing
 *
 * Implements token bucket algorithm using Redis Lua scripts for atomic operations.
 * Ensures rate limits are enforced correctly without race conditions.
 *
 * Lua script handles:
 * 1. Token refill based on elapsed time
 * 2. Token consumption if available
 * 3. Atomic state updates in Redis
 * 4. TTL management for automatic cleanup
 */

import type Redis from 'ioredis'
import { getClient } from './redis'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

export interface RateLimitConfig {
  limit: number
  interval: number
}

/**
 * Rate limit presets for external APIs
 *
 * Based on documented API limits with 80% safety buffer (per CONTEXT.md):
 * - Scryfall: 10 requests per second
 * - Telegram: 100 requests per 60 seconds
 * - TCGplayer: 50 req/min documented → 80% = 40 req/min
 * - CardMarket: Unknown → conservative 40 req/min
 * - CardKingdom: Unknown → conservative 40 req/min
 * - LigaMagic: Unknown → conservative 30 req/min (scraping, slower)
 */
export const RATE_LIMITS = {
  SCRYFALL: { limit: 10, interval: 1 }, // 10 req/sec
  TELEGRAM: { limit: 100, interval: 60 }, // 100 req/min
  TCGPLAYER: { limit: 40, interval: 60 }, // 50 req/min → 80% = 40
  CARDMARKET: { limit: 40, interval: 60 }, // Unknown → conservative 40
  CARDKINGDOM: { limit: 40, interval: 60 }, // Unknown → conservative 40
  LIGAMAGIC: { limit: 30, interval: 60 }, // Unknown → conservative 30
} as const

/**
 * Lua script for atomic token bucket operations
 *
 * This script runs atomically in Redis, preventing race conditions
 * from concurrent requests. It handles:
 * - Getting current bucket state
 * - Refilling tokens if interval has elapsed
 * - Consuming tokens if available
 * - Setting expiration for automatic cleanup
 *
 * Returns: [allowed: 0|1, remaining: number]
 */
const TOKEN_BUCKET_SCRIPT = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local interval = tonumber(ARGV[2])
  local tokens = tonumber(ARGV[3])
  local now = tonumber(redis.call('TIME')[1])

  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local current_tokens = tonumber(bucket[1]) or limit
  local last_refill = tonumber(bucket[2]) or now

  -- Refill tokens based on time elapsed
  local elapsed = now - last_refill
  if elapsed >= interval then
    current_tokens = limit
    last_refill = now
  end

  -- Check if enough tokens
  if current_tokens >= tokens then
    current_tokens = current_tokens - tokens
    redis.call('HMSET', key, 'tokens', current_tokens, 'last_refill', last_refill)
    redis.call('EXPIRE', key, interval)
    return {1, current_tokens}
  else
    return {0, current_tokens}
  end
`

/**
 * Check rate limit using token bucket algorithm
 *
 * @param key - Unique identifier for rate limit bucket (e.g., "scryfall:user-123")
 * @param limit - Maximum number of tokens (requests)
 * @param interval - Refill interval in seconds
 * @param tokens - Number of tokens to consume (default: 1)
 * @returns Rate limit result with allowed status and remaining tokens
 *
 * @example
 * ```ts
 * // Check if user can make a Scryfall API call
 * const { allowed, remaining } = await checkRateLimit('scryfall:user-123', 10, 1)
 * if (!allowed) {
 *   throw new Error('Rate limit exceeded')
 * }
 * ```
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  interval: number,
  tokens = 1,
): Promise<RateLimitResult> {
  const redis = getClient()

  const result = await redis.eval(TOKEN_BUCKET_SCRIPT, 1, `ratelimit:${key}`, limit, interval, tokens)

  // ioredis returns Lua script results as [number, number]
  const [allowed, remaining] = result as [number, number]

  return {
    allowed: allowed === 1,
    remaining,
  }
}

/**
 * Check rate limit using predefined preset
 *
 * @param key - Unique identifier for rate limit bucket
 * @param preset - Rate limit preset (e.g., RATE_LIMITS.SCRYFALL)
 * @param tokens - Number of tokens to consume (default: 1)
 * @returns Rate limit result with allowed status and remaining tokens
 *
 * @example
 * ```ts
 * const { allowed } = await checkRateLimitPreset('scryfall:user-123', RATE_LIMITS.SCRYFALL)
 * ```
 */
export async function checkRateLimitPreset(
  key: string,
  preset: RateLimitConfig,
  tokens = 1,
): Promise<RateLimitResult> {
  return checkRateLimit(key, preset.limit, preset.interval, tokens)
}
