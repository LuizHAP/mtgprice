---
phase: 07-auth-rate-limit-tests
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/auth/__tests__/hash.test.ts
  - src/lib/auth/__tests__/jwt.test.ts
  - src/lib/ratelimit/__tests__/redis.test.ts
  - src/lib/ratelimit/rate-limiter.ts
  - src/lib/ratelimit/redis.ts
  - test/mocks/redis.ts
  - test/setup.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase introduces tests for password hashing (`hash.test.ts`), JWT signing/verification (`jwt.test.ts`), and a Redis-backed token-bucket rate limiter (`redis.test.ts`), together with the rate-limiter production code (`rate-limiter.ts`, `redis.ts`), a Redis mock (`test/mocks/redis.ts`), and a global test setup (`test/setup.ts`).

The code is generally well-structured and thoughtfully commented. The main concerns are:

1. **Critical** — `test/setup.ts` hardcodes database and service credentials that are committed to source control. While the values are described as test fixtures, `DATABASE_URL` contains a cleartext password and `TELEGRAM_BOT_TOKEN` a plaintext credential. Any accidental promotion of these values to a shared environment (e.g., CI that runs against a real DB) would expose them.
2. **Warnings** — The Lua EXPIRE TTL is set to `interval` seconds, which can prematurely expire a bucket that is actively being used (off-by-one with the refill window). The MockRedis `hmset` signature does not match the real ioredis API, meaning the mock would never be called correctly if the production code ever calls `hmset` directly. The `MockRedis` class is not exported with `export class`, requiring consumers to import via the named re-export, which is a minor but real coupling issue. The cluster-spy test mutates `process.env` without a try/finally guard, risking environment pollution if the assertions before cleanup throw.
3. **Info** — Minor items: the `MockRedis` `call` method is unused dead code (the mock's `eval` method never invokes it); the `__resetRateLimitCache` export leaks an internal test hook into the public module API; `numKeys` is silently ignored in the `eval` mock signature (always reading `args[0]` as the key).

---

## Critical Issues

### CR-01: Plaintext credentials hardcoded in committed test setup file

**File:** `test/setup.ts:6`
**Issue:** `DATABASE_URL` embeds a cleartext password (`postgres:postgres`) and `TELEGRAM_BOT_TOKEN` embeds a token string (`test-bot-token`) in a committed source file. Although both are labelled "test" values, committing any credential pattern normalises the practice and risks accidental reuse in CI environments that point at real infrastructure. Secret scanners (GitHub, GitLab, Snyk) will flag these and may block pipelines.
**Fix:**
```ts
// Use environment-variable indirection so the file never contains a literal secret.
// Provide defaults only for purely ephemeral values (JWT_SECRET is fine — it is never
// used against external infrastructure).
process.env.JWT_SECRET ??= 'test-secret-key-for-jwt-signing'
process.env.REDIS_URL ??= 'redis://localhost:6379'
// Pull real values from the environment; CI injects them as secrets.
// Fail clearly if they are missing rather than silently using a placeholder.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set before running integration tests')
}
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN must be set before running integration tests')
}
```
If these tests are purely unit tests that never touch a real database or Telegram API, use a clearly fake URL with no embedded password (e.g., `postgresql://test-user@localhost/test_db_no_password`) so no credential is present at all.

---

## Warnings

### WR-01: Lua EXPIRE TTL equals interval — bucket can expire before next refill window

**File:** `src/lib/ratelimit/rate-limiter.ts:98`
**Issue:** The Lua script sets `EXPIRE key interval` (line 98). When a bucket is accessed at the very beginning of an interval and tokens remain, the key will expire exactly when the next refill would be due — any request arriving a fraction of a second later will find a missing key and start with a fresh full bucket, effectively allowing a burst of `limit` requests every `interval` seconds regardless of prior usage within that window. The TTL should be at least `interval + 1` (or use the remaining seconds until the next refill) to ensure the bucket persists through its full window.
**Fix:**
```lua
-- Use interval + 1 to guarantee the key outlives the current window.
redis.call('EXPIRE', key, interval + 1)
```
Alternatively, store the next-refill timestamp and compute `EXPIREAT` to the end of the current window, but the simple `+1` guard is sufficient for correctness.

### WR-02: MockRedis `hmset` signature does not match ioredis API

**File:** `test/mocks/redis.ts:42`
**Issue:** The mock defines `hmset` as accepting `fieldValues: [string, string | number][]` (an array of pairs). The real ioredis `hmset` signature is variadic: `hmset(key, field1, value1, field2, value2, ...)` or `hmset(key, object)`. If production code ever calls `client.hmset(key, field, value)` directly (rather than through the Lua script), the mock would receive arguments in the wrong shape and silently produce incorrect behaviour (the for-loop over `fieldValues` would iterate over characters of the first string argument).
**Fix:**
```ts
hmset = async (key: string, ...fieldValues: (string | number)[]): Promise<'OK'> => {
  const hash = this.data.hashes.get(key) ?? {}
  for (let i = 0; i < fieldValues.length; i += 2) {
    hash[String(fieldValues[i])] = String(fieldValues[i + 1])
  }
  this.data.hashes.set(key, hash)
  return 'OK'
}
```

### WR-03: Cluster test mutates `process.env` without a try/finally guard

**File:** `src/lib/ratelimit/__tests__/redis.test.ts:103-125`
**Issue:** `REDIS_CLUSTER_NODES` is set at line 103 and deleted at line 125. If any assertion between those two lines throws (e.g., `expect(ClusterSpy).toHaveBeenCalledTimes(1)` fails), the `delete` and `ClusterSpy.mockRestore()` calls are skipped, leaving `process.env.REDIS_CLUSTER_NODES` set for all subsequent tests in the suite. This can cause unrelated tests that call `getClient()` to attempt a real cluster connection and fail.
**Fix:**
```ts
it('should support Redis cluster for high availability', async () => {
  const ClusterSpy = vi.spyOn(Redis, 'Cluster').mockImplementation(
    () => ({ quit: vi.fn().mockResolvedValue('OK'), eval: vi.fn() }) as unknown as InstanceType<typeof Redis.Cluster>,
  )
  process.env.REDIS_CLUSTER_NODES = 'redis-1:6379,redis-2:6380'

  try {
    const realRedisModule = await vi.importActual<typeof import('@/lib/ratelimit/redis')>('@/lib/ratelimit/redis')
    await realRedisModule.closeClient()
    const clusterClient = realRedisModule.getClient()

    expect(ClusterSpy).toHaveBeenCalledTimes(1)
    expect(ClusterSpy).toHaveBeenCalledWith([
      { host: 'redis-1', port: 6379 },
      { host: 'redis-2', port: 6380 },
    ])
    expect(clusterClient).toBeDefined()

    await realRedisModule.closeClient()
  } finally {
    ClusterSpy.mockRestore()
    delete process.env.REDIS_CLUSTER_NODES
  }
})
```

### WR-04: `eval` mock silently ignores `numKeys` — key extraction is always `args[0]`

**File:** `test/mocks/redis.ts:78`
**Issue:** The `eval` method receives `numKeys` but always reads `args[0]` as the key (line 85). If a caller ever passes `numKeys > 1` or `numKeys = 0`, the mock will read the wrong positional argument as the key and silently operate on an incorrect hash. This is not currently triggered (callers always pass `numKeys = 1`), but the mock does not enforce this assumption or throw on invalid `numKeys`, making it a latent correctness trap.
**Fix:**
```ts
eval = async (script: string, numKeys: number, ...args: (string | number)[]): Promise<[number, number]> => {
  if (numKeys !== 1) {
    throw new Error(`MockRedis.eval: expected numKeys=1, got ${numKeys}`)
  }
  const key = args[0] as string
  const limit = Number(args[numKeys])     // args[1]
  const interval = Number(args[numKeys + 1]) // args[2]
  const tokens = Number(args[numKeys + 2])   // args[3]
  // ... rest unchanged
}
```

---

## Info

### IN-01: `MockRedis.call` is dead code

**File:** `test/mocks/redis.ts:122`
**Issue:** The `call` method (lines 122-137) is never invoked by the mock's own `eval` implementation, which replaces the Lua script execution entirely rather than delegating to Redis commands. No test or source file calls `mockRedis.call(...)` directly. The method adds maintenance surface without being exercised.
**Fix:** Remove the `call` method, or add a comment explicitly noting it is provided for potential direct-command usage (e.g., by future tests that call `hmget`/`hmset` outside of `eval`).

### IN-02: `__resetRateLimitCache` is a test hook exported from a production module

**File:** `src/lib/ratelimit/rate-limiter.ts:56`
**Issue:** `__resetRateLimitCache` and the `globalThis.__rateLimitCacheReset` assignment (line 62) are test-only concerns leaking into the production module. While the function is harmless at runtime (it just clears a Map), the double-underscore convention signals "internal/test" but the function is still part of the public ESM export surface, visible to any importer.
**Fix:** Move the cache-clearing mechanism to a test-only helper file (e.g., `src/lib/ratelimit/__tests__/helpers.ts`) using `vi.importActual` and direct internal access, or use Vitest's module reset API (`vi.resetModules()`) between tests to avoid needing a shared reset hook at all.

### IN-03: JWT test functions declared `async` but contain no `await`

**File:** `src/lib/auth/__tests__/jwt.test.ts:18,29,36,46,54`
**Issue:** All five `it` callbacks are declared `async` but none actually `await` anything — `signToken` and `verifyToken` are synchronous. The `async` keyword is unnecessary noise and could mislead future developers into thinking these calls are async.
**Fix:**
```ts
it('should sign token with user payload', () => {
  // ... no async/await needed
})
```

---

_Reviewed: 2026-05-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
