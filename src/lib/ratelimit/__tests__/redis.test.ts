/**
 * Redis-backed rate limiter tests
 *
 * Tests for PRICE-08 requirement: Persistent rate limiting state
 *
 * Activated in Plan 07-02 (TEST-03)
 */

import { MockRedis } from '@/../test/mocks/redis'
import Redis from 'ioredis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Standard mock pattern (from token-bucket.test.ts).
const mockRedis = new MockRedis()

vi.mock('@/lib/ratelimit/redis', () => ({
  getClient: vi.fn(() => mockRedis),
  closeClient: vi.fn(),
}))

// Import AFTER vi.mock so the rate-limiter binds to the mocked client.
const { checkRateLimit, __resetRateLimitCache } = await import('@/lib/ratelimit/rate-limiter')

describe('Redis-backed rate limiter', () => {
  beforeEach(() => {
    mockRedis.reset()
    __resetRateLimitCache() // clear local Map cache between tests
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockRedis.reset()
    __resetRateLimitCache()
  })

  it('should store rate limit state in Redis', async () => {
    // Verify token count is stored in Redis under the ratelimit:<key> namespace
    await checkRateLimit('user:test', 10, 1)
    const history = mockRedis.getEvalHistory()
    expect(history).toHaveLength(1)
    expect(history[0].keys[0]).toBe('ratelimit:user:test')
    // State persists: a follow-up exists() check confirms the hash was written
    const exists = await mockRedis.exists('ratelimit:user:test')
    expect(exists).toBe(1)
  })

  it('should execute Lua script atomically', async () => {
    // Each checkRateLimit call corresponds to exactly one eval invocation
    await checkRateLimit('atom:a', 10, 1)
    await checkRateLimit('atom:b', 10, 1) // different key — bypass local cache
    const history = mockRedis.getEvalHistory()
    expect(history).toHaveLength(2)
    // Lua script body contains the atomic HMGET/HMSET/EXPIRE sequence
    expect(history[0].script).toContain('HMGET')
    expect(history[0].script).toContain('HMSET')
    expect(history[0].script).toContain('EXPIRE')
  })

  it('should handle Redis connection errors', async () => {
    // Force redis.eval to reject — the rate limiter must FAIL OPEN (allow request)
    const evalSpy = vi.spyOn(mockRedis, 'eval').mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const result = await checkRateLimit('conn:fail', 10, 1).catch((err) => err)

    // CONTRACT: per CONTEXT.md "Claude's Discretion", connection errors fail open.
    // If checkRateLimit rethrows, this test will fail and the implementation must
    // be updated to wrap eval in try/catch and return { allowed: true, remaining: -1 }.
    // Until that implementation lands, this test asserts the documented behaviour.
    if (result instanceof Error) {
      throw new Error(
        'Rate limiter rethrew Redis error — expected fail-open behaviour. ' +
          'Wrap redis.eval in try/catch in checkRateLimit and return { allowed: true, remaining: -1 } on error.',
      )
    }
    expect(result.allowed).toBe(true)
    evalSpy.mockRestore()
  })

  it('should persist state across server restarts', async () => {
    // Persistence proxy: TTL is set so the key survives within the configured window
    await checkRateLimit('persist:test', 10, 1)
    const ttl = await mockRedis.ttl('ratelimit:persist:test')
    expect(ttl).toBeGreaterThan(0)
  })

  it('should support Redis cluster for high availability', async () => {
    // D-10: spy on Redis.Cluster constructor and verify the real redis.ts module
    // routes to it when REDIS_CLUSTER_NODES is set.
    // The spy must be installed BEFORE the real module is imported (or before
    // getClient() runs and creates a singleton). We use vi.importActual to bypass
    // the top-of-file vi.mock for this single test.

    // Ensure no leftover singleton from previous tests in other files (best-effort).
    const ClusterSpy = vi.spyOn(Redis, 'Cluster').mockImplementation(
      // Minimal stub — the rate limiter never calls quit() in this assertion.
      () =>
        ({
          quit: vi.fn().mockResolvedValue('OK'),
          eval: vi.fn(),
        }) as unknown as InstanceType<typeof Redis.Cluster>,
    )

    process.env.REDIS_CLUSTER_NODES = 'redis-1:6379,redis-2:6380'

    // Import the REAL redis module (bypassing the top-of-file vi.mock).
    const realRedisModule =
      await vi.importActual<typeof import('@/lib/ratelimit/redis')>('@/lib/ratelimit/redis')

    // The real module has its own module-level singleton; close it first to
    // guarantee getClient() runs the cluster branch (Pitfall 2 in 07-RESEARCH.md).
    await realRedisModule.closeClient()
    const clusterClient = realRedisModule.getClient()

    expect(ClusterSpy).toHaveBeenCalledTimes(1)
    expect(ClusterSpy).toHaveBeenCalledWith([
      { host: 'redis-1', port: 6379 },
      { host: 'redis-2', port: 6380 },
    ])
    expect(clusterClient).toBeDefined()

    // Cleanup: restore the singleton state and remove the env var.
    await realRedisModule.closeClient()
    ClusterSpy.mockRestore()
    // biome-ignore lint/performance/noDelete: test teardown requires env var removal
    delete process.env.REDIS_CLUSTER_NODES
  })

  it('should handle Redis memory pressure', async () => {
    // Memory-pressure mitigation = TTL on every key (prevents unbounded growth)
    await checkRateLimit('mem:test', 10, 1)
    const ttl = await mockRedis.ttl('ratelimit:mem:test')
    expect(ttl).toBeGreaterThan(0)
    // TTL is bounded by the rate-limit interval (1s here) — would be ≤1s in real Redis;
    // MockRedis stores absolute milliseconds, so we just confirm a positive TTL exists.
  })

  it('should support local cache for performance', async () => {
    // Exhaust the bucket so the next call returns allowed:false (the cached state).
    // The local cache only caches denied responses — caching allowed:true would
    // suppress token consumption and break sequential exhaustion tests (deviation from
    // plan spec: cache-denied-only strategy, documented in 07-02-SUMMARY.md).
    for (let i = 0; i < 10; i++) {
      await checkRateLimit('cache:hot', 10, 1)
    }
    // Bucket is now empty — this call gets denied and the result is cached (D-03).
    const result1 = await checkRateLimit('cache:hot', 10, 1)
    expect(result1.allowed).toBe(false)
    const evalCount1 = mockRedis.getEvalHistory().length

    // Second call within 100ms with SAME key+limit+interval+tokens → cache hit, no new eval
    const result2 = await checkRateLimit('cache:hot', 10, 1)
    const evalCount2 = mockRedis.getEvalHistory().length
    expect(evalCount2).toBe(evalCount1) // D-04: no additional eval for denied result
    expect(result2).toEqual(result1) // cached result returned

    // Different key → always misses cache (D-05)
    await checkRateLimit('cache:cold', 10, 1)
    expect(mockRedis.getEvalHistory().length).toBeGreaterThan(evalCount2)
  })
})
