/**
 * Token bucket rate limiting with Redis backing
 *
 * Placeholder for RED phase of TDD - this file will be implemented in Task 2
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

export interface RateLimitConfig {
  limit: number
  interval: number
}

export const RATE_LIMITS = {
  SCRYFALL: { limit: 10, interval: 1 },
  TELEGRAM: { limit: 100, interval: 60 },
  TCGPLAYER: { limit: 50, interval: 60 },
} as const

export async function checkRateLimit(
  key: string,
  limit: number,
  interval: number,
  tokens = 1,
): Promise<RateLimitResult> {
  throw new Error('Not implemented yet - RED phase of TDD')
}
