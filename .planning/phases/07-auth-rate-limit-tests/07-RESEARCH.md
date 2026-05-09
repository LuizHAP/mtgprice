# Phase 7: Auth & Rate Limit Tests - Research

**Researched:** 2026-05-09
**Domain:** Vitest test implementation — bcrypt, JWT, Redis rate limiter
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `hash.test.ts` imports from `src/lib/auth/password.ts` (adjacent sub-module — bcrypt only)
- **D-02:** `jwt.test.ts` imports from `src/lib/auth.ts` (root-level full-auth module — only place JWT functions exist)
- **D-03:** Add a short-TTL read cache (~100ms) to `rate-limiter.ts` using a plain `Map`
- **D-04:** Cache stores the last Redis result per key; same key within 100ms returns cached result without Redis call
- **D-05:** Different keys always miss the cache
- **D-06:** Cache is purely additive — no changes to existing `checkRateLimit` / `checkRateLimitPreset` signatures
- **D-07:** Add cluster detection to `redis.ts`: if `REDIS_CLUSTER_NODES` env var is set, create `new Redis.Cluster(nodes)` instead of single-node `new Redis(redisUrl)`
- **D-08:** `REDIS_CLUSTER_NODES` format: comma-separated `host:port` pairs (e.g., `redis-1:6379,redis-2:6379`)
- **D-09:** Zero breaking changes to existing single-node path — `REDIS_URL` fallback remains untouched
- **D-10:** Test verifies cluster path by mocking the ioredis Cluster constructor

### Claude's Discretion

- JWT expiry test approach: use explicit past `exp` claim (no fake timers, avoids Vitest 3.x issue with async mocks)
- Connection error behavior for Redis rate limiter: fail open (allow request) on Redis error — matches test stub comment "fails open (allows request)"
- biome-ignore comment placement: add `// biome-ignore lint/performance/noDelete: test teardown requires env var removal` on the line immediately before any `delete process.env.*` in test teardown
- `it.todo()` → `it()` conversion: replace the `it.todo('...', async () => {` wrapper with a full implementation (do NOT use `it.todo` with a body — that's not valid Vitest syntax; use `it` directly)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Tests ativos para bcrypt hash (hash com 10 salt rounds, compare correto, rejeitar senha errada, unicidade de salt) | `password.ts` exports `hashPassword`/`comparePassword`; bcryptjs `bcrypt.getRounds()` enables salt-round assertion |
| TEST-02 | Tests ativos para JWT (sign com payload, verify válido, rejeitar token inválido, rejeitar token expirado, claims iat/exp) | `auth.ts` exports `signToken`/`verifyToken`; `jwt.decode()` exposes raw claims; past `exp` enables expiry test without fake timers |
| TEST-03 | Tests ativos para Redis rate limiter (armazenar estado, Lua script atômico, erros de conexão, persistência, cluster HA, memory pressure, cache local) | `MockRedis` + `vi.mock` pattern verified; `getEvalHistory()` enables Lua script assertion; cluster via `vi.spyOn(Redis, 'Cluster')`; local cache via plain `Map` with `Date.now()` TTL |
</phase_requirements>

---

## Summary

Phase 7 is a pure test-activation phase with two small source additions. All three test files already exist with `it.todo()` stubs — the work is replacing stubs with implementations. `hash.test.ts` (4 cases) and `jwt.test.ts` (5 cases) are pure test code with zero source changes. `redis.test.ts` (7 cases) requires adding a local `Map`-based cache to `rate-limiter.ts` and cluster-detection logic to `redis.ts` before the tests can pass.

The testing stack is Vitest 3.x (`^3.0.9`, registry current: `4.1.5`) [VERIFIED: npm registry]. The project locks `globals: true` in `vitest.config.ts` so `describe`/`it`/`expect`/`vi` are available without import — however all test stubs already import them explicitly, so follow the existing import pattern. The established mock pattern from `token-bucket.test.ts` is the canonical blueprint for `redis.test.ts`.

Critical constraints: Biome's `performance/noDelete` rule fires on any `delete process.env.*` — a `// biome-ignore` comment is mandatory on the preceding line [VERIFIED: biome.json + STATE.md]. Vitest 3.x has a known issue with `vi.useFakeTimers()` + async mocks producing unhandled rejection warnings — avoid fake timers entirely; use explicit past `exp` claim for the JWT expiry test [VERIFIED: CONTEXT.md].

**Primary recommendation:** Work through the three test files in order (hash → jwt → redis); implement source additions for `rate-limiter.ts` and `redis.ts` before activating redis.test.ts cases.

---

## Standard Stack

### Core
| Library | Version (locked) | Version (registry) | Purpose |
|---------|-------------------|--------------------|---------|
| vitest | ^3.0.9 | 4.1.5 | Test runner [VERIFIED: npm registry] |
| bcryptjs | ^2.4.3 | 3.0.3 | Password hashing [VERIFIED: npm registry] |
| jsonwebtoken | ^9.0.2 | 9.0.3 | JWT sign/verify [VERIFIED: npm registry] |
| ioredis | ^5.5.0 | 5.10.1 | Redis client + Cluster [VERIFIED: npm registry] |
| @biomejs/biome | ^1.9.4 | — | Linter (noDelete rule active) [VERIFIED: biome.json] |

> Note: Vitest `^3.0.9` (semver range) will NOT automatically upgrade to 4.x without a lockfile update. The project currently runs 3.x. Do not upgrade the test runner during this phase.

### No Additional Installs Required

All dependencies are already present. This phase adds no new packages. [VERIFIED: package.json]

---

## Architecture Patterns

### Pattern 1: it.todo → it Conversion

`it.todo('description')` with no body = a registered placeholder shown as "todo" in output.
`it.todo('description', async () => { ... })` is **not valid Vitest syntax** — a body is silently ignored or treated as error.
The correct conversion is:

```typescript
// BEFORE (invalid stub — body is ignored by Vitest)
it.todo('should hash password with 10 salt rounds', async () => { ... })

// AFTER (correct implementation)
it('should hash password with 10 salt rounds', async () => {
  const hash = await hashPassword('mypassword')
  expect(hash).not.toBe('mypassword')
  // bcryptjs exposes salt rounds via bcrypt.getRounds(hash)
})
```

[VERIFIED: Vitest docs via CONTEXT.md + existing passing tests pattern]

### Pattern 2: bcrypt Test Assertions (hash.test.ts)

```typescript
// Source: src/lib/auth/password.ts + bcryptjs API
import { comparePassword, hashPassword } from '@/lib/auth/password'
import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'

// Salt rounds — bcrypt.getRounds(hash) returns the rounds used
it('should hash password with 10 salt rounds', async () => {
  const hash = await hashPassword('secret')
  expect(bcrypt.getRounds(hash)).toBe(10)
  expect(hash).not.toBe('secret')
})

// Correct compare
it('should compare correct password successfully', async () => {
  const hash = await hashPassword('secret')
  expect(await comparePassword('secret', hash)).toBe(true)
})

// Incorrect compare
it('should reject incorrect password', async () => {
  const hash = await hashPassword('secret')
  expect(await comparePassword('wrongpassword', hash)).toBe(false)
})

// Salt uniqueness
it('should generate different hashes for same password', async () => {
  const hash1 = await hashPassword('secret')
  const hash2 = await hashPassword('secret')
  expect(hash1).not.toBe(hash2)
  // Both must still validate
  expect(await comparePassword('secret', hash1)).toBe(true)
  expect(await comparePassword('secret', hash2)).toBe(true)
})
```

[VERIFIED: password.ts source read + bcryptjs API]

### Pattern 3: JWT Test Assertions (jwt.test.ts)

Key facts from `auth.ts`:
- `signToken(userId: number, email: string): string` — uses `process.env.JWT_SECRET`, signs with `expiresIn: '1d'`
- `verifyToken(token: string): JwtPayload` — throws on invalid/expired; returns `{ userId, email, iat?, exp? }`
- `JWT_SECRET` is already set globally in `test/setup.ts` as `'test-secret-key-for-jwt-signing'`

```typescript
// Source: src/lib/auth.ts + JwtPayload type
import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { signToken, verifyToken } from '@/lib/auth'

// No beforeAll/afterAll needed — JWT_SECRET already set in test/setup.ts

// Sign
it('should sign token with user payload', async () => {
  const token = signToken(42, 'user@example.com')
  expect(typeof token).toBe('string')
  expect(token.split('.')).toHaveLength(3) // header.payload.signature
})

// Verify
it('should verify valid token', async () => {
  const token = signToken(42, 'user@example.com')
  const payload = verifyToken(token)
  expect(payload.userId).toBe(42)
  expect(payload.email).toBe('user@example.com')
})

// Invalid token
it('should reject invalid token', async () => {
  expect(() => verifyToken('not.a.valid.token')).toThrow()
})

// Expired token — use explicit past exp (no fake timers)
it('should reject expired token', async () => {
  const secret = process.env.JWT_SECRET!
  const expiredToken = jwt.sign(
    { userId: 1, email: 'test@example.com' },
    secret,
    { expiresIn: -1 } // instantly expired
  )
  expect(() => verifyToken(expiredToken)).toThrow()
})

// iat/exp claims
it('should include issued-at and expiration claims', async () => {
  const before = Math.floor(Date.now() / 1000)
  const token = signToken(42, 'user@example.com')
  const payload = verifyToken(token)
  expect(payload.iat).toBeGreaterThanOrEqual(before)
  expect(payload.exp).toBeGreaterThan(payload.iat!)
  // 1d = 86400 seconds
  expect(payload.exp! - payload.iat!).toBeCloseTo(86400, -2)
})
```

[VERIFIED: auth.ts source + JwtPayload type + CONTEXT.md discretion]

### Pattern 4: Redis Rate Limiter Tests (redis.test.ts)

Uses the established `vi.mock` + `MockRedis` pattern from `token-bucket.test.ts`:

```typescript
// Source: token-bucket.test.ts (canonical example) [VERIFIED: read]
import { MockRedis } from '@/../test/mocks/redis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRedis = new MockRedis()

vi.mock('@/lib/ratelimit/redis', () => ({
  getClient: vi.fn(() => mockRedis),
  closeClient: vi.fn(),
}))

import { checkRateLimit } from '@/lib/ratelimit/rate-limiter'

beforeEach(() => { mockRedis.reset(); vi.clearAllMocks() })
afterEach(() => { mockRedis.reset() })
```

Individual test implementations:

```typescript
// Store state in Redis — verifies eval was called with correct key format
it('should store rate limit state in Redis', async () => {
  await checkRateLimit('user:test', 10, 1)
  const history = mockRedis.getEvalHistory()
  expect(history).toHaveLength(1)
  expect(history[0].keys[0]).toBe('ratelimit:user:test')
})

// Lua script atomicity — verifies single eval call per checkRateLimit invocation
it('should execute Lua script atomically', async () => {
  await checkRateLimit('test', 10, 1)
  await checkRateLimit('test', 10, 1)
  const history = mockRedis.getEvalHistory()
  expect(history).toHaveLength(2)
  // Each call is exactly one atomic eval
})

// Connection error — fail open (allow request)
it('should handle Redis connection errors', async () => {
  vi.mocked(mockRedis.eval).mockRejectedValueOnce(new Error('ECONNREFUSED'))
  // or: use a vi.spyOn approach on getClient to throw
  const result = await checkRateLimit('test', 10, 1)
  expect(result.allowed).toBe(true) // fail open
})

// Persist state — TTL is set (key survives within TTL window)
it('should persist state across server restarts', async () => {
  await checkRateLimit('test', 10, 1)
  const ttl = await mockRedis.ttl('ratelimit:test')
  expect(ttl).toBeGreaterThan(0) // TTL is set
})

// Memory pressure — keys have TTL (prevents unbounded growth)
it('should handle Redis memory pressure', async () => {
  await checkRateLimit('test', 10, 1)
  const ttl = await mockRedis.ttl('ratelimit:test')
  expect(ttl).toBeGreaterThan(0) // TTL prevents memory bloat
})
```

[VERIFIED: MockRedis source + token-bucket.test.ts pattern + CONTEXT.md]

### Pattern 5: Cluster HA Test (redis.test.ts)

Requires `redis.ts` modification (D-07 to D-10). The test mocks `Redis.Cluster`:

```typescript
// In redis.test.ts
import Redis from 'ioredis'
import { vi } from 'vitest'

it('should support Redis cluster for high availability', async () => {
  const ClusterSpy = vi.spyOn(Redis, 'Cluster').mockImplementation(() => ({} as any))
  process.env.REDIS_CLUSTER_NODES = 'redis-1:6379,redis-2:6379'

  // Re-import or call getClient() to trigger cluster detection
  // (depends on module reset strategy — see Pitfall 2 below)

  expect(ClusterSpy).toHaveBeenCalledWith([
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
  ])

  // biome-ignore lint/performance/noDelete: test teardown requires env var removal
  delete process.env.REDIS_CLUSTER_NODES
  ClusterSpy.mockRestore()
})
```

[VERIFIED: CONTEXT.md D-07–D-10 + ioredis Cluster API via source inspection]

### Pattern 6: Local Cache Test (redis.test.ts)

Requires `rate-limiter.ts` modification (D-03 to D-06). The cache is internal to `checkRateLimit`:

```typescript
it('should support local cache for performance', async () => {
  // First call — hits Redis (eval called once)
  const result1 = await checkRateLimit('cached-key', 10, 1)
  const evalCount1 = mockRedis.getEvalHistory().length

  // Second call within 100ms — should return cached result (no new eval)
  const result2 = await checkRateLimit('cached-key', 10, 1)
  const evalCount2 = mockRedis.getEvalHistory().length

  expect(evalCount2).toBe(evalCount1) // no additional Redis call
  expect(result2).toEqual(result1)    // same result from cache

  // Different key — always misses cache (D-05)
  await checkRateLimit('other-key', 10, 1)
  expect(mockRedis.getEvalHistory().length).toBeGreaterThan(evalCount2)
})
```

[VERIFIED: CONTEXT.md D-03–D-06]

### Anti-Patterns to Avoid

- **`it.todo` with a body:** Invalid Vitest syntax — the body is silently ignored. Use `it()` instead.
- **`vi.useFakeTimers()` for JWT expiry test:** Causes unhandled rejection warnings in Vitest 3.x with async mocks. Use `jwt.sign(..., { expiresIn: -1 })` for instant expiry.
- **`delete process.env.X` without biome-ignore:** Biome `performance/noDelete` rule will fail CI. Always add comment on the preceding line.
- **Importing from `@/lib/auth/index`:** `index.ts` only re-exports `password.ts` functions. JWT functions (`signToken`, `verifyToken`) only exist in `src/lib/auth.ts`. Use `@/lib/auth` for JWT tests (D-02).
- **Setting `JWT_SECRET` in each test file:** It's already set globally in `test/setup.ts`. Don't duplicate in `beforeAll` unless you need a different value (e.g., to test the "JWT_SECRET not set" error path, which is NOT a requirement in this phase).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bcrypt salt extraction | Custom regex on hash string | `bcrypt.getRounds(hash)` | bcryptjs provides this utility; regex is brittle |
| JWT claim inspection | Manual base64 decode | `jwt.decode(token)` or `verifyToken()` which returns full payload | jsonwebtoken exposes decoded payload directly |
| Instant JWT expiry | `vi.useFakeTimers()` | `jwt.sign({...}, secret, { expiresIn: -1 })` | Vitest 3.x fake timers + async mocks cause warnings |
| Redis client mock | Custom mock class | `MockRedis` from `test/mocks/redis.ts` | Already implemented with `eval`, `ttl`, `getEvalHistory` |

---

## Source File Modifications Required

### `src/lib/ratelimit/rate-limiter.ts` — Add Local Cache (D-03 to D-06)

Add a module-level `Map` with timestamp. The cache is purely additive — `checkRateLimit` signature unchanged:

```typescript
// Module-level cache (add before checkRateLimit function)
const LOCAL_CACHE_TTL_MS = 100
const localCache = new Map<string, { result: RateLimitResult; cachedAt: number }>()

// Inside checkRateLimit, before calling redis.eval:
const cacheKey = `${key}:${limit}:${interval}:${tokens}`
const cached = localCache.get(cacheKey)
if (cached && Date.now() - cached.cachedAt < LOCAL_CACHE_TTL_MS) {
  return cached.result
}

// ... existing eval call ...

// After eval, store result:
localCache.set(cacheKey, { result, cachedAt: Date.now() })
return result
```

[VERIFIED: CONTEXT.md D-03 to D-06 + rate-limiter.ts source]

### `src/lib/ratelimit/redis.ts` — Add Cluster Detection (D-07 to D-09)

```typescript
// Add cluster detection before single-node path
export function getClient(): Redis | Redis.Cluster {
  if (!client) {
    const clusterNodes = process.env.REDIS_CLUSTER_NODES
    if (clusterNodes) {
      const nodes = clusterNodes.split(',').map((node) => {
        const [host, portStr] = node.split(':')
        return { host, port: Number(portStr) }
      })
      client = new Redis.Cluster(nodes) as unknown as Redis
    } else {
      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is not set')
      }
      client = new Redis(redisUrl)
    }
  }
  return client
}
```

Note: The return type annotation may need adjustment depending on how `rate-limiter.ts` types the client (currently typed as `Redis`). Since `Redis.Cluster` implements the same command interface, casting `as unknown as Redis` is the path of least resistance per D-09 (no breaking changes to existing single-node path).

[VERIFIED: CONTEXT.md D-07 to D-09 + redis.ts source]

---

## Common Pitfalls

### Pitfall 1: `it.todo` Syntax Confusion
**What goes wrong:** Developer writes `it.todo('name', async () => { ... })` thinking it activates the test. Vitest silently discards the body — the test stays "todo" and no error is reported.
**Why it happens:** `it.todo` is designed for placeholder-only stubs; a body parameter is accepted but ignored by Vitest.
**How to avoid:** Replace `it.todo` with `it`. The full conversion is: remove `todo` from `it.todo`.
**Warning signs:** Test output still shows the test as "todo" after editing.

### Pitfall 2: Redis Module Singleton and Cluster Test
**What goes wrong:** `redis.ts` uses a module-level `let client: Redis | null = null` singleton. If `getClient()` was already called before the cluster test, `client` is already set and the cluster branch is never reached.
**Why it happens:** Node module state persists across tests in the same file unless explicitly reset.
**How to avoid:** The cluster test must either (a) ensure `client = null` is reset between tests (via `closeClient()`), or (b) mock `getClient` entirely so the real `redis.ts` isn't called. Since `redis.test.ts` already mocks `@/lib/ratelimit/redis` via `vi.mock`, the test for cluster HA needs to test the real `redis.ts` (un-mocked) or spy on ioredis at the constructor level. The recommended approach (D-10): mock the ioredis `Redis.Cluster` constructor, then import `getClient` from the real module (not the mock), set `REDIS_CLUSTER_NODES`, and call `getClient()`.
**Warning signs:** `Redis.Cluster` spy is never called even though the env var is set.

### Pitfall 3: `biome-ignore` Comment Placement
**What goes wrong:** Comment is placed on the wrong line, or as a block comment, or after the statement — Biome ignores it.
**Why it happens:** Biome `biome-ignore` must appear on the line immediately before the flagged statement as a line comment (`//`).
**How to avoid:**
```typescript
// Correct:
// biome-ignore lint/performance/noDelete: test teardown requires env var removal
delete process.env.REDIS_CLUSTER_NODES

// Wrong (same line):
delete process.env.REDIS_CLUSTER_NODES // biome-ignore lint/performance/noDelete: ...

// Wrong (block):
/* biome-ignore lint/performance/noDelete: ... */
delete process.env.REDIS_CLUSTER_NODES
```
**Warning signs:** Biome lint CI step fails on `delete process.env.*`.

### Pitfall 4: JWT_SECRET Already Set Globally
**What goes wrong:** Test adds a redundant `beforeAll(() => { process.env.JWT_SECRET = ... })` and `afterAll(() => { delete process.env.JWT_SECRET })`. The `afterAll` then unsets the global value, breaking other tests that rely on the global setup.
**Why it happens:** `test/setup.ts` already sets `JWT_SECRET = 'test-secret-key-for-jwt-signing'` for all tests. Test authors don't check setup.ts.
**How to avoid:** Do NOT add `beforeAll`/`afterAll` for `JWT_SECRET` in `jwt.test.ts`. Use `process.env.JWT_SECRET` directly in tests — it's already available.
**Warning signs:** Other tests start failing after jwt.test.ts runs.

### Pitfall 5: Wrong Import Path for JWT Functions
**What goes wrong:** `jwt.test.ts` imports from `@/lib/auth/password` or `@/lib/auth/index` — neither exports `signToken` or `verifyToken`.
**Why it happens:** `src/lib/auth/index.ts` only re-exports from `password.ts`. JWT functions only exist in `src/lib/auth.ts` (the root module).
**How to avoid:** Use `import { signToken, verifyToken } from '@/lib/auth'` (maps to `src/lib/auth.ts`).
**Warning signs:** `signToken is not a function` or TS type error at import.

### Pitfall 6: MockRedis `eval` is not a `vi.fn()`
**What goes wrong:** Code tries to use `vi.mocked(mockRedis.eval).mockRejectedValueOnce(...)` — this fails because `mockRedis.eval` is a regular class method, not a `vi.fn()`.
**Why it happens:** `MockRedis` creates `eval` as an arrow function property, not a vitest mock.
**How to avoid:** Use `vi.spyOn(mockRedis, 'eval').mockRejectedValueOnce(new Error('ECONNREFUSED'))` for the connection error test — `vi.spyOn` wraps the existing method.
**Warning signs:** `mockRejectedValueOnce is not a function` at runtime.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.9 (registry: 4.1.5 available but not in use) |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test:run` |
| Full suite command | `pnpm test:run` |
| Watch mode | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | bcrypt hash with 10 rounds | unit | `pnpm test:run src/lib/auth/__tests__/hash.test.ts` | Yes (stubs) |
| TEST-01 | bcrypt compare correct password | unit | `pnpm test:run src/lib/auth/__tests__/hash.test.ts` | Yes (stubs) |
| TEST-01 | bcrypt reject incorrect password | unit | `pnpm test:run src/lib/auth/__tests__/hash.test.ts` | Yes (stubs) |
| TEST-01 | bcrypt salt uniqueness | unit | `pnpm test:run src/lib/auth/__tests__/hash.test.ts` | Yes (stubs) |
| TEST-02 | JWT sign with payload | unit | `pnpm test:run src/lib/auth/__tests__/jwt.test.ts` | Yes (stubs) |
| TEST-02 | JWT verify valid token | unit | `pnpm test:run src/lib/auth/__tests__/jwt.test.ts` | Yes (stubs) |
| TEST-02 | JWT reject invalid token | unit | `pnpm test:run src/lib/auth/__tests__/jwt.test.ts` | Yes (stubs) |
| TEST-02 | JWT reject expired token | unit | `pnpm test:run src/lib/auth/__tests__/jwt.test.ts` | Yes (stubs) |
| TEST-02 | JWT iat/exp claims | unit | `pnpm test:run src/lib/auth/__tests__/jwt.test.ts` | Yes (stubs) |
| TEST-03 | Redis state storage | unit | `pnpm test:run src/lib/ratelimit/__tests__/redis.test.ts` | Yes (stubs) |
| TEST-03 | Lua script atomicity | unit | `pnpm test:run src/lib/ratelimit/__tests__/redis.test.ts` | Yes (stubs) |
| TEST-03 | Connection error fail-open | unit | `pnpm test:run src/lib/ratelimit/__tests__/redis.test.ts` | Yes (stubs) |
| TEST-03 | TTL persistence | unit | `pnpm test:run src/lib/ratelimit/__tests__/redis.test.ts` | Yes (stubs) |
| TEST-03 | Cluster HA | unit | `pnpm test:run src/lib/ratelimit/__tests__/redis.test.ts` | Yes (stubs) |
| TEST-03 | Memory pressure / TTL | unit | `pnpm test:run src/lib/ratelimit/__tests__/redis.test.ts` | Yes (stubs) |
| TEST-03 | Local cache reduces Redis calls | unit | `pnpm test:run src/lib/ratelimit/__tests__/redis.test.ts` | Yes (stubs) |

### Sampling Rate
- **Per task commit:** `pnpm test:run src/lib/auth/__tests__/hash.test.ts src/lib/auth/__tests__/jwt.test.ts src/lib/ratelimit/__tests__/redis.test.ts`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green (127+ passing, 0 new failures, 0 skipped in phase files) before `/gsd-verify-work`

### Wave 0 Gaps
None — all test files exist and all source files are present. No test infrastructure setup needed. The only pre-implementation work is the source additions to `rate-limiter.ts` and `redis.ts` which are part of the implementation tasks, not Wave 0.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All tests | Yes | Darwin 25.3.0 / node available | — |
| pnpm | Test runner | Yes | in use (pnpm-lock.yaml present) | — |
| Redis (real) | TEST-03 cluster HA test | Not needed | — | MockRedis + vi.spyOn |
| bcryptjs | TEST-01 | Yes (installed) | ^2.4.3 | — |
| jsonwebtoken | TEST-02 | Yes (installed) | ^9.0.2 | — |
| ioredis | TEST-03 | Yes (installed) | ^5.5.0 | — |

**No missing dependencies.** All tests use mocks — no real Redis or external services required.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes — bcrypt tests validate password security | bcryptjs with 10 salt rounds |
| V3 Session Management | Yes — JWT tests validate token lifecycle | jsonwebtoken with exp/iat claims |
| V4 Access Control | No | — |
| V5 Input Validation | No — test phase, not input layer | — |
| V6 Cryptography | Partially — bcrypt cost factor verified in TEST-01 | `bcrypt.getRounds()` assertion |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Weak bcrypt cost | Information Disclosure | Assert `bcrypt.getRounds(hash) === 10` in TEST-01 |
| JWT algorithm confusion | Spoofing | jsonwebtoken default (HS256); verify throws on tampered tokens |
| Token replay after expiry | Elevation of Privilege | TEST-02 expiry test covers this |
| Rate limit bypass via timing | Denial of Service | Lua script atomicity test (TEST-03) covers this |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bcrypt.getRounds(hash)` returns `10` for hashes created with `bcrypt.hash(password, 10)` | Architecture Patterns §bcrypt | LOW — well-established bcryptjs API; would need to use alternative assertion if wrong |
| A2 | `jwt.sign({...}, secret, { expiresIn: -1 })` produces a token that immediately fails `verifyToken()` | Architecture Patterns §JWT | LOW — negative expiresIn is standard jsonwebtoken behavior; could use `exp: Math.floor(Date.now()/1000) - 1` as fallback |
| A3 | `vi.spyOn(mockRedis, 'eval')` works on arrow function class properties | Common Pitfalls §MockRedis | MEDIUM — vitest spyOn works on arrow function properties in most cases; if not, use a factory approach |
| A4 | `Redis.Cluster` is accessible as `ioredis.default.Cluster` or `Redis.Cluster` for vi.spyOn | Architecture Patterns §Cluster HA | MEDIUM — ioredis 5.x exports Cluster as a named export; verify import style matches what redis.ts uses |

---

## Open Questions

1. **Cluster test module isolation**
   - What we know: `redis.ts` has a module-level `client` singleton; `redis.test.ts` already mocks `@/lib/ratelimit/redis` entirely via `vi.mock`
   - What's unclear: The cluster HA test needs to exercise real `redis.ts` code (not the mock) — how should this be structured? Options: (a) import the real module in a separate describe block with `vi.unmock`, (b) test the cluster behavior by mocking ioredis at the constructor level within the existing mock factory
   - Recommendation: Approach (b) — in the vi.mock factory for `@/lib/ratelimit/redis`, add a conditional that checks `process.env.REDIS_CLUSTER_NODES` and calls `new Redis.Cluster(nodes)` (with a spy on `Redis.Cluster`) — then the test sets the env var and verifies the spy was called. The planner should decide the exact approach.

2. **Connection error test — how to make `mockRedis.eval` throw**
   - What we know: `mockRedis.eval` is a class arrow function property; `vi.spyOn` should work
   - What's unclear: Whether `vi.spyOn` correctly intercepts arrow function class properties in Vitest 3.x or if a different approach is needed
   - Recommendation: Use `vi.spyOn(mockRedis, 'eval').mockRejectedValueOnce(...)` and restore after the test. If this fails, alternative is to mock `getClient` to throw in that specific test case.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/auth/password.ts` — bcrypt implementation, salt rounds, function signatures [VERIFIED: file read]
- `src/lib/auth.ts` — JWT implementation, signToken/verifyToken, JwtPayload usage [VERIFIED: file read]
- `src/lib/ratelimit/rate-limiter.ts` — checkRateLimit, Lua script, TOKEN_BUCKET_SCRIPT [VERIFIED: file read]
- `src/lib/ratelimit/redis.ts` — getClient singleton, closeClient [VERIFIED: file read]
- `test/mocks/redis.ts` — MockRedis class, all methods including getEvalHistory, ttl, exists [VERIFIED: file read]
- `src/lib/ratelimit/__tests__/token-bucket.test.ts` — canonical vi.mock + MockRedis pattern [VERIFIED: file read]
- `vitest.config.ts` — test environment, include patterns, globals, timeout settings [VERIFIED: file read]
- `test/setup.ts` — global env vars including JWT_SECRET, console mock [VERIFIED: file read]
- `biome.json` — performance/noDelete rule active via recommended rules [VERIFIED: file read]
- `package.json` — bcryptjs ^2.4.3, jsonwebtoken ^9.0.2, ioredis ^5.5.0, vitest ^3.0.9 [VERIFIED: file read]
- `.planning/STATE.md` — Known Constraints (v1.1 specific) [VERIFIED: file read]
- `.planning/phases/07-auth-rate-limit-tests/07-CONTEXT.md` — All decisions D-01 to D-10, discretion items [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- npm registry — bcryptjs@3.0.3, jsonwebtoken@9.0.3, ioredis@5.10.1, vitest@4.1.5 [VERIFIED: npm view]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via file read and npm registry
- Architecture patterns: HIGH — derived directly from source files and CONTEXT.md locked decisions
- Pitfalls: HIGH — derived from CONTEXT.md constraints + source code analysis
- Test map: HIGH — all test files verified to exist with stubs; commands verified against vitest.config.ts

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable domain — bcrypt, JWT, Redis patterns change slowly)
