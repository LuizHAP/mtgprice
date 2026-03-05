/**
 * Token bucket rate limiting algorithm tests
 *
 * Tests for PRICE-08 requirement: Rate limiting for external APIs
 *
 * RED phase: Tests are written but implementation doesn't exist yet
 */

import { MockRedis } from '@/../test/mocks/redis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RATE_LIMITS, checkRateLimit } from '../rate-limiter'

// Mock Redis client
const mockRedis = new MockRedis()

// Mock the getClient function
vi.mock('../redis', () => ({
  getClient: () => mockRedis,
}))

describe('Token bucket rate limiting algorithm', () => {
  beforeEach(() => {
    mockRedis.reset()
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockRedis.reset()
  })

  it('should allow first request with full bucket', async () => {
    // Given: limit=10, interval=1 second, tokens=1
    const limit = 10
    const interval = 1
    const tokens = 1

    // When: First call to checkRateLimit
    const result = await checkRateLimit('test-key', limit, interval, tokens)

    // Then: returns { allowed: true, remaining: 9 }
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
  })

  it('should reject requests exceeding limit', async () => {
    // Given: limit=10, interval=1
    const limit = 10
    const interval = 1
    const tokens = 1

    // When: 11 requests made
    const results = []
    for (let i = 0; i < 11; i++) {
      const result = await checkRateLimit('test-key', limit, interval, tokens)
      results.push(result)
    }

    // Then: First 10 return allowed: true, 11th returns allowed: false
    expect(results.slice(0, 10).every((r) => r.allowed)).toBe(true)
    expect(results[10].allowed).toBe(false)
    expect(results[10].remaining).toBe(0)
  })

  it('should refill tokens after interval', async () => {
    // Given: limit=10, interval=0.1 (100ms for testing)
    const limit = 10
    const interval = 0.1
    const tokens = 1

    // When: Exhaust bucket
    for (let i = 0; i < 10; i++) {
      await checkRateLimit('test-key', limit, interval, tokens)
    }

    // Should be exhausted
    const exhaustedResult = await checkRateLimit('test-key', limit, interval, tokens)
    expect(exhaustedResult.allowed).toBe(false)

    // Wait 150ms and request again
    mockRedis.advanceMockTime(0.15)
    const newResult = await checkRateLimit('test-key', limit, interval, tokens)

    // Then: New request returns allowed: true with remaining=9
    expect(newResult.allowed).toBe(true)
    expect(newResult.remaining).toBe(9)
  })

  it('should handle concurrent requests atomically', async () => {
    // Given: limit=10, interval=1
    const limit = 10
    const interval = 1
    const tokens = 1

    // When: 10 concurrent requests
    const promises = Array.from({ length: 10 }, () => checkRateLimit('test-key', limit, interval, tokens))
    const results = await Promise.all(promises)

    // Then: All 10 return allowed: true (no race conditions)
    expect(results.every((r) => r.allowed)).toBe(true)
    expect(results.every((r) => r.remaining >= 0)).toBe(true)
    // Total tokens consumed should be exactly 10
    const totalRemaining = results.reduce((sum, r) => sum + r.remaining, 0)
    expect(totalRemaining).toBeLessThanOrEqual(90) // 10 * (10-1) = 90 max
  })

  it('should expire Redis key after interval', async () => {
    // Given: limit=10, interval=0.1
    const limit = 10
    const interval = 0.1
    const tokens = 1

    // When: Make request
    await checkRateLimit('test-key', limit, interval, tokens)

    // Key should exist
    const existsBefore = await mockRedis.exists('ratelimit:test-key')
    expect(existsBefore).toBe(1)

    // Wait 200ms and check Redis
    mockRedis.advanceMockTime(0.2)

    // Check TTL (should be expired or close to it)
    const ttl = await mockRedis.ttl('ratelimit:test-key')
    expect(ttl).toBeLessThan(100) // Should be expired or nearly expired
  })

  it('should enforce Scryfall preset (10 req/sec)', async () => {
    // Given: Scryfall preset (10 req/sec)
    const scryfallLimit = RATE_LIMITS.SCRYFALL

    // When: 11 requests in 1 second
    const results = []
    for (let i = 0; i < 11; i++) {
      const result = await checkRateLimit(
        'scryfall:test-user',
        scryfallLimit.limit,
        scryfallLimit.interval,
        1,
      )
      results.push(result)
    }

    // Then: 10 succeed, 1 fails
    const successCount = results.filter((r) => r.allowed).length
    expect(successCount).toBe(10)
    expect(results[10].allowed).toBe(false)
  })

  it('should enforce Telegram preset (100 req/60sec)', async () => {
    // Given: Telegram preset (100 req/60sec)
    const telegramLimit = RATE_LIMITS.TELEGRAM

    // When: 101 requests
    const results = []
    for (let i = 0; i < 101; i++) {
      const result = await checkRateLimit(
        'telegram:test-user',
        telegramLimit.limit,
        telegramLimit.interval,
        1,
      )
      results.push(result)
    }

    // Then: 100 succeed, 1 fails
    const successCount = results.filter((r) => r.allowed).length
    expect(successCount).toBe(100)
    expect(results[100].allowed).toBe(false)
  })

  it('should support custom rate limit configurations', async () => {
    // Given: Custom limit (5 req/2 sec)
    const customLimit = { limit: 5, interval: 2 }

    // When: 6 requests
    const results = []
    for (let i = 0; i < 6; i++) {
      const result = await checkRateLimit('custom:test-user', customLimit.limit, customLimit.interval, 1)
      results.push(result)
    }

    // Then: 5 succeed, 1 fails
    const successCount = results.filter((r) => r.allowed).length
    expect(successCount).toBe(5)
    expect(results[5].allowed).toBe(false)
  })

  it('should maintain separate buckets for different keys', async () => {
    // Given: Two different users
    const limit = 5
    const interval = 1

    // When: User A makes 5 requests, User B makes 5 requests
    const userAResults = []
    const userBResults = []

    for (let i = 0; i < 5; i++) {
      userAResults.push(await checkRateLimit('user-a', limit, interval, 1))
      userBResults.push(await checkRateLimit('user-b', limit, interval, 1))
    }

    // Then: Both users should have all requests allowed
    expect(userAResults.every((r) => r.allowed)).toBe(true)
    expect(userBResults.every((r) => r.allowed)).toBe(true)
  })

  it('should consume multiple tokens if requested', async () => {
    // Given: limit=10, consuming 3 tokens per request
    const limit = 10
    const interval = 1
    const tokens = 3

    // When: 4 requests (should consume 12 tokens total, but only 10 available)
    const results = []
    for (let i = 0; i < 4; i++) {
      const result = await checkRateLimit('test-key', limit, interval, tokens)
      results.push(result)
    }

    // Then: First 3 succeed (9 tokens), 4th fails (only 1 token left)
    expect(results[0].allowed).toBe(true)
    expect(results[0].remaining).toBe(7)
    expect(results[1].allowed).toBe(true)
    expect(results[1].remaining).toBe(4)
    expect(results[2].allowed).toBe(true)
    expect(results[2].remaining).toBe(1)
    expect(results[3].allowed).toBe(false)
    expect(results[3].remaining).toBe(1)
  })
})
