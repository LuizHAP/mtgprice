# Phase 7: Auth & Rate Limit Tests - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Activate all `it.todo()` stubs in three test files:
- `src/lib/auth/__tests__/hash.test.ts` — bcrypt hash/compare/salt-uniqueness (4 cases)
- `src/lib/auth/__tests__/jwt.test.ts` — sign, verify, invalid token, expired token, iat/exp claims (5 cases)
- `src/lib/ratelimit/__tests__/redis.test.ts` — Lua script atomicity, connection errors, memory pressure, cluster HA, local cache (7 cases)

Two source files require minimal additions to support the redis tests: `rate-limiter.ts` (local cache) and `redis.ts` (cluster HA). Everything else is test-only work.

</domain>

<decisions>
## Implementation Decisions

### Hash test import target
- **D-01:** `hash.test.ts` imports from `src/lib/auth/password.ts` (adjacent sub-module — bcrypt only)
- **D-02:** `jwt.test.ts` imports from `src/lib/auth.ts` (root-level full-auth module — only place JWT functions exist)

### Redis local cache
- **D-03:** Add a short-TTL read cache (~100ms) to `rate-limiter.ts` using a plain `Map`
- **D-04:** Cache stores the last Redis result per key; same key within 100ms returns cached result without Redis call
- **D-05:** Different keys always miss the cache
- **D-06:** Cache is purely additive — no changes to existing `checkRateLimit` / `checkRateLimitPreset` signatures

### Cluster HA
- **D-07:** Add cluster detection to `redis.ts`: if `REDIS_CLUSTER_NODES` env var is set, create `new Redis.Cluster(nodes)` instead of single-node `new Redis(redisUrl)`
- **D-08:** `REDIS_CLUSTER_NODES` format: comma-separated `host:port` pairs (e.g., `redis-1:6379,redis-2:6379`)
- **D-09:** Zero breaking changes to existing single-node path — `REDIS_URL` fallback remains untouched
- **D-10:** Test verifies cluster path by mocking the ioredis Cluster constructor

### Claude's Discretion
- JWT expiry test approach: use explicit past `exp` claim (no fake timers, avoids Vitest 3.x issue with async mocks)
- Connection error behavior for Redis rate limiter: fail open (allow request) on Redis error — matches test stub comment "fails open (allows request)"
- biome-ignore comment placement: add `// biome-ignore lint/performance/noDelete: test teardown requires env var removal` on the line immediately before any `delete process.env.*` in test teardown
- `it.todo()` → `it()` conversion: replace the `it.todo('...', async () => {` wrapper with a full implementation (do NOT use `it.todo` with a body — that's not valid Vitest syntax; use `it` directly)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth implementation
- `src/lib/auth.ts` — `signToken`, `verifyToken`, `hashPassword`, `comparePassword` — the functions jwt.test.ts will test
- `src/lib/auth/password.ts` — `hashPassword`, `comparePassword`, `compareBotPassword` — the functions hash.test.ts will test
- `src/lib/auth/index.ts` — re-exports from password.ts

### Rate limit implementation
- `src/lib/ratelimit/rate-limiter.ts` — `checkRateLimit`, `checkRateLimitPreset`, Lua script — the module redis.test.ts exercises
- `src/lib/ratelimit/redis.ts` — `getClient`, `closeClient` — to be extended with cluster support
- `src/lib/ratelimit/__mocks__/redis.ts` — auto-mock for Vitest module system

### Mock infrastructure
- `test/mocks/redis.ts` — `MockRedis` class — established pattern for rate limiter tests
- `src/lib/ratelimit/__tests__/token-bucket.test.ts` — PASSING tests, canonical example of vi.mock + MockRedis pattern

### Project constraints
- `.planning/STATE.md` §"Known Constraints (v1.1 specific)" — biome noDelete, Vitest 3.x fake timers, test stubs as it.todo

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MockRedis` (`test/mocks/redis.ts`): fully-functional mock with `eval`, `hmget`, `hmset`, `exists`, `ttl`, `advanceMockTime`, `reset` — use directly in redis.test.ts
- `src/lib/ratelimit/__mocks__/redis.ts`: auto-mock file already wired; redis.test.ts can use it via `vi.mock('@/lib/ratelimit/redis', ...)`

### Established Patterns
- Mock pattern (from token-bucket.test.ts):
  ```ts
  const mockRedis = new MockRedis()
  vi.mock('@/lib/ratelimit/redis', () => ({
    getClient: vi.fn(() => mockRedis),
    closeClient: vi.fn(),
  }))
  beforeEach(() => { mockRedis.reset(); vi.clearAllMocks() })
  ```
- Env var setup for JWT tests: `beforeAll(() => { process.env.JWT_SECRET = 'test-secret' })`
- Env var teardown: `afterAll(() => { /* biome-ignore lint/performance/noDelete: test teardown requires env var removal */ delete process.env.JWT_SECRET })`

### Integration Points
- `hash.test.ts` → `../password.ts` (relative) or `@/lib/auth/password` (alias)
- `jwt.test.ts` → `@/lib/auth` (root-level auth module)
- `redis.test.ts` → `@/lib/ratelimit/rate-limiter` + mocked `@/lib/ratelimit/redis`
- New local cache in `rate-limiter.ts` is internal — no external interface changes
- New cluster support in `redis.ts` is env-var-driven — no call-site changes

</code_context>

<specifics>
## Specific Ideas

- The `it.todo()` syntax in Vitest means tests with no implementation — they show as "todo" in output, not "skipped". The conversion is: `it.todo('description', async () => { ... })` is invalid; use `it('description', async () => { ... })` for implementations
- The test stub for "persist state across server restarts" should test Redis TTL behavior (key survives within TTL window), not an actual server restart simulation
- The "memory pressure" test should verify that keys have TTL set (preventing unbounded growth) — MockRedis has `ttl()` method for this

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-auth-rate-limit-tests*
*Context gathered: 2026-05-09*
