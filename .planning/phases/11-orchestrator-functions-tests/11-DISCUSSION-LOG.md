# Phase 11: Orchestrator Functions & Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 11-orchestrator-functions-tests
**Areas discussed:** Scope, orchestrateFetch design, applyRateLimiting complexity, handleSourceFailure complexity, aggregateResults design, batchOrchestrateFetch design, Test split into plans

---

## Scope — 21 or 24 stubs?

| Option | Description | Selected |
|--------|-------------|----------|
| Activate all 24 | Integration scenarios test wired-together system; worth doing since all pieces are in scope | ✓ |
| Leave Integration scenarios skipped | Keep as test.skip; closer to E2E tests; separate phase or milestone cleanup | |

**User's choice:** Activate all 24 stubs including the 3 Integration scenarios.
**Notes:** None.

---

## orchestrateFetch design

| Option | Description | Selected |
|--------|-------------|----------|
| Rename/alias — orchestrateFetch IS fetchCardPriceFromAllSources | Same logic, cleaner naming; no drift risk between two parallel implementations | ✓ |
| Extract inner helper | Pull core logic out of fetchCardPriceFromAllSources; delegate to it | |
| New parallel export | New standalone export duplicating the Liga-first + parallel-intl pattern | |

**User's choice:** Alias export — `export const orchestrateFetch = fetchCardPriceFromAllSources`.
**Notes:** Avoids duplication and risk of divergence.

---

## applyRateLimiting complexity

| Option | Description | Selected |
|--------|-------------|----------|
| Plug into existing Redis rate limiter | Call checkRateLimitPreset(source) from src/lib/ratelimit/rate-limiter.ts | ✓ |
| Simple delay-based spacing | Calculate delay from maxReqPerMin and use setTimeout; no Redis dependency | |

**User's choice:** Plug into existing Redis rate limiter.
**Notes:** Keeps rate limiting consistent across the whole app; reuses proven token bucket.

---

## handleSourceFailure complexity

| Option | Description | Selected |
|--------|-------------|----------|
| Simple: log + return SourceFetchResult | logger.error with source/card context; return { success: false, error }; Opossum handles circuit breaking | ✓ |
| Complex: log + increment in-memory counter | Also maintain Map<source, failureCount>; the third stub tests counter increments | |

**User's choice:** Simple — log error and return `{ success: false, error }`.
**Notes:** Circuit breakers already handle threshold-based tripping via Opossum. "Track failure count" test stub is satisfied by verifying logger.error was called with the right context.

---

## aggregateResults design

| Option | Description | Selected |
|--------|-------------|----------|
| Pure function: AllSourcesResult → PriceRecord[] | No DB write; easy to test with no mocks; caller handles persistence | ✓ |
| Writes to DB: AllSourcesResult → Promise<number> | Inserts successful prices; tests need insertPrice mock; combines aggregation + persistence | |

**User's choice:** Pure function — `(oracleId, AllSourcesResult) → PriceRecord[]`.
**Notes:** No async, no mocks needed; simplest tests in the phase.

---

## batchOrchestrateFetch design

| Option | Description | Selected |
|--------|-------------|----------|
| Alias export — batchOrchestrateFetch IS fetchAllPrices | Same pattern as orchestrateFetch/fetchCardPriceFromAllSources alias | ✓ |
| New implementation using new helpers | Calls orchestrateFetch and aggregateResults internally as building blocks | |

**User's choice:** Alias export — `export const batchOrchestrateFetch = fetchAllPrices`.
**Notes:** Consistent approach across the phase.

---

## Test split into plans

| Option | Description | Selected |
|--------|-------------|----------|
| 2 plans: TEST-12 then TEST-13 | Plan 11-01: orchestrateFetch alias + handleSourceFailure + applyRateLimiting (10 stubs). Plan 11-02: aggregateResults + batchOrchestrateFetch alias + integration scenarios (14 stubs) | ✓ |
| 1 plan: all 5 functions + 24 stubs at once | Simpler; fewer commits; harder to isolate if something breaks | |

**User's choice:** 2 plans, mirroring how prior phases split by requirement group.
**Notes:** None.

---

## Claude's Discretion

- Exact `PriceRecord` type name (could be `PriceEntry` or inline type)
- Whether `applyRateLimiting` awaits `checkRateLimitPreset` or just calls it
- Exact error message format in `handleSourceFailure`
- Whether integration scenario stubs test via `orchestrateFetch` alias or underlying `fetchCardPriceFromAllSources`

## Deferred Ideas

None — discussion stayed within phase scope.
