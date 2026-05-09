# Phase 7: Auth & Rate Limit Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 07-auth-rate-limit-tests
**Areas discussed:** Hash test import target, Redis unimplemented features

---

## Hash test import target

| Option | Description | Selected |
|--------|-------------|----------|
| src/lib/auth/password.ts | Tests the adjacent sub-module directly. Clean separation: hash tests → password.ts, jwt tests → auth.ts. Both modules have the same bcrypt implementation. | ✓ |
| src/lib/auth.ts | Tests the main full-auth module. Both hash and JWT tests import from the same file, but that module is at the parent path level, which feels less natural for the sub-directory test. | |

**User's choice:** `src/lib/auth/password.ts`
**Notes:** JWT tests must still import from `src/lib/auth.ts` since `signToken`/`verifyToken` only exist there.

---

## Redis unimplemented features

| Option | Description | Selected |
|--------|-------------|----------|
| Add minimal implementations | Add a basic local cache (simple Map with short TTL) to rate-limiter.ts + a cluster connection option to redis.ts. Tests then verify real behavior. Minimal code additions, no architectural changes. | ✓ |
| Adapt tests to current code | Rewrite the stubs to test what actually exists. 'Cluster HA' becomes a test of Redis reconnect/fallback behavior. 'Local cache' becomes a test of graceful Redis failure handling. No new source code needed. | |

**User's choice:** Add minimal implementations
**Notes:** Followed up with two sub-questions.

### Local cache specifics

| Option | Description | Selected |
|--------|-------------|----------|
| Short-TTL read cache | Cache the last Redis result for a key for ~100ms. Reduces Redis calls on burst traffic. Test verifies: same key within 100ms hits cache (no Redis call), different keys miss cache. | ✓ |
| Fallback-on-error cache | Cache last known result and return it when Redis is unavailable. Different intent from 'performance' optimization. | |
| You decide | Claude picks the simplest approach. | |

**User's choice:** Short-TTL read cache (~100ms), plain Map, same-key deduplication

### Cluster HA specifics

| Option | Description | Selected |
|--------|-------------|----------|
| Detect REDIS_CLUSTER_NODES env var | If REDIS_CLUSTER_NODES is set, create Redis.Cluster(nodes). If only REDIS_URL is set, use single-node. Test verifies the cluster path with a mocked connection. Zero breaking changes. | ✓ |
| You decide | Claude picks the simplest implementation. | |

**User's choice:** `REDIS_CLUSTER_NODES` env var, comma-separated `host:port` pairs

---

## Claude's Discretion

- JWT expiry test approach (not discussed — defaulting to explicit past `exp` claim, no fake timers)
- Connection error behavior for Redis rate limiter (not discussed — defaulting to fail open per stub comment)
- biome-ignore comment pattern for `delete process.env.*`
- `it.todo()` → `it()` conversion mechanics

## Deferred Ideas

None.
