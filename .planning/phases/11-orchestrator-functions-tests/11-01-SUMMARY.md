---
phase: 11
plan: "01"
subsystem: scraper
tags: [testing, orchestrator, rate-limiting, error-handling]
dependency_graph:
  requires: []
  provides: [orchestrateFetch-export, handleSourceFailure-export, applyRateLimiting-export]
  affects: [src/scraper/orchestrator.ts, src/scraper/__tests__/orchestrator.test.ts]
tech_stack:
  added: []
  patterns:
    - alias-export pattern for named re-exports (orchestrateFetch = fetchCardPriceFromAllSources)
    - SOURCE_RATE_LIMIT_MAP internal lookup for 2-arg checkRateLimitPreset calls
    - vi.mock top-level for logger and rate-limiter (Pattern E from jobs.test.ts)
    - vi.doMock + dynamic import pattern for orchestrateFetch tests
key_files:
  created: []
  modified:
    - src/scraper/orchestrator.ts
    - src/scraper/__tests__/orchestrator.test.ts
decisions:
  - "orchestrateFetch implemented as direct alias export, not a wrapper function"
  - "applyRateLimiting uses SOURCE_RATE_LIMIT_MAP to resolve preset for 2-arg checkRateLimitPreset call (RESEARCH critical finding: D-05 said 1-arg but actual API requires 2-args)"
  - "RESEARCH Open Question 1 resolved: applyRateLimiting throws on allowed===false so callers surface the denial"
  - "handleSourceFailure does NOT maintain failure counter; Opossum circuit breakers own that logic (D-04)"
metrics:
  duration: "~6 minutes (343 seconds)"
  completed: "2026-05-13"
  tasks: 3
  commits: 3
---

# Phase 11 Plan 01: Orchestrator Functions (TEST-12) Summary

Add `orchestrateFetch` alias, `handleSourceFailure`, and `applyRateLimiting` named exports to `src/scraper/orchestrator.ts` and activate 10 corresponding `test.skip` stubs across 3 describe blocks.

## What Was Built

### New Exports Added to src/scraper/orchestrator.ts

**1. orchestrateFetch alias (line 275)**
`export const orchestrateFetch = fetchCardPriceFromAllSources` — Direct alias per D-03. No logic duplication. Tests exercise the full real implementation via the new name.

**2. handleSourceFailure function (lines 282-288)**
`export function handleSourceFailure(source: string, oracleId: string, error: unknown): SourceFetchResult` — Normalizes `error` to string via `error instanceof Error ? error.message : String(error)`, calls `logger.error(\`✗ ${source}: ${oracleId} - ${errorMsg}\`)`, returns `{ success: false, error: errorMsg }`. Per D-04: no failure counter, no state.

**3. SOURCE_RATE_LIMIT_MAP internal constant (lines 293-300)**
Maps lowercase source names to `RATE_LIMITS.*` presets: `ligamagic → RATE_LIMITS.LIGAMAGIC`, `tcgplayer → RATE_LIMITS.TCGPLAYER`, `cardmarket → RATE_LIMITS.CARDMARKET`, `cardkingdom → RATE_LIMITS.CARDKINGDOM`. Not exported — internal helper for `applyRateLimiting`.

**4. applyRateLimiting function (lines 307-315)**
`export async function applyRateLimiting(source: string): Promise<void>` — Looks up preset from `SOURCE_RATE_LIMIT_MAP`, returns silently for unknown sources, calls `checkRateLimitPreset(source, preset)` with TWO args (RESEARCH critical finding), throws `Error('Rate limit exceeded for ${source}')` when `result.allowed === false` (RESEARCH Open Question 1 resolution).

**New import added (line 15):**
`import { RATE_LIMITS, checkRateLimitPreset, type RateLimitConfig } from '@/lib/ratelimit/rate-limiter'`

### 10 Activated Test Stubs in src/scraper/__tests__/orchestrator.test.ts

**orchestrateFetch describe block (4 tests):**
- "should fetch Liga Magic first (BR data priority)" — verifies `results.ligamagic.success === true` and `price === 10` with Liga Magic mock returning 10
- "should fetch international sources in parallel" — verifies all 3 international results have `success: true` when all mocks resolve
- "should continue if one international source fails" — TCGPlayer mock rejects; asserts `tcgplayer.success === false` with non-empty error; liga/cardmarket/cardkingdom all pass
- "should handle complete Liga Magic failure gracefully" — Liga Magic mock rejects; asserts `ligamagic.success === false` and all 3 international succeed

**handleSourceFailure describe block (3 tests):**
- "should log error with source context" — asserts return value `{ success: false, error: 'boom' }` and `logger.error` called once with string containing source, oracleId, and error message
- "should continue with remaining sources" — asserts no throw; result has `success: false` and correct error
- "should track failure count per source" — calls twice with same source; asserts `logger.error` called twice, both with source name

**applyRateLimiting describe block (3 tests):**
- "should respect rate limits per source" — verifies `checkRateLimitPreset` called with `('ligamagic', {limit:30,interval:60})` and `('tcgplayer', {limit:40,interval:60})`; unknown source skips
- "should wait between requests to same source" — calls twice; asserts called 2 times with same source+preset
- "should handle rate limit errors (429)" — mocks `allowed: false`; asserts `rejects.toThrow('Rate limit exceeded for ligamagic')`

**New top-level mocks added:**
- `vi.mock('@/lib/logger', ...)` — mocks all 4 logger methods as `vi.fn()` for handleSourceFailure assertions
- `vi.mock('@/lib/ratelimit/rate-limiter', ...)` — mocks `checkRateLimitPreset` with default `{allowed:true,remaining:10}` and exports all 7 `RATE_LIMITS` keys

## Invariants Confirmed

- Lines 1-99 of orchestrator.test.ts (the 5 originally-passing tests) are functionally unchanged — the import line had `beforeEach` added but the 3 describe/test bodies starting at line 4 are byte-identical to the pre-plan version
- `fetchCardPriceFromAllSources` and `fetchAllPrices` function bodies are unchanged — only new exports appended after `export default fetchAllPrices`

## CONTEXT.md D-05 → RESEARCH Correction

CONTEXT.md D-05 described `applyRateLimiting` calling `checkRateLimitPreset(source)` with one argument. RESEARCH discovered the actual signature requires TWO required args: `(key: string, preset: RateLimitConfig)`. The implementation uses `SOURCE_RATE_LIMIT_MAP` to look up the preset and passes both args. The test mock for `@/lib/ratelimit/rate-limiter` provides `RATE_LIMITS` constants matching the real values so assertion equality checks work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in test file**
- **Found during:** Task 3 TypeScript verification
- **Issue:** `vi.mocked(logger.error).mock.calls[0]?.[0]` has type `object`, not directly castable to `string` — requires double-cast via `unknown`. Also, `RateLimitResult` interface has no `resetAt` field but tests were initializing mock returns with `resetAt: ...`.
- **Fix:** Changed `as string` to `as unknown as string` for logger mock call args. Removed `resetAt` from all `{ allowed, remaining, resetAt }` mock return objects.
- **Files modified:** src/scraper/__tests__/orchestrator.test.ts
- **Commit:** 835fe1e (included in Task 3 commit)

## Known Stubs

None — all test bodies in the 3 target describe blocks have real assertions. The 10 remaining `test.skip` stubs (aggregateResults ×4, batchOrchestrateFetch ×3, Integration scenarios ×3) are out of scope for this plan (Plan 11-02 scope).

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All additions are internal scraper-layer functions and their unit tests.

## Self-Check: PASSED

- `src/scraper/orchestrator.ts` — file exists, 316 lines
- `src/scraper/__tests__/orchestrator.test.ts` — file exists, 423 lines
- Commit c42ae99 exists (Task 1)
- Commit 2c25522 exists (Task 2)
- Commit 835fe1e exists (Task 3)
- `grep "^export const orchestrateFetch = fetchCardPriceFromAllSources$"` — 1 match at line 275
- `grep "^export function handleSourceFailure("` — 1 match at line 282
- `grep "^export async function applyRateLimiting(source: string)"` — 1 match at line 307
- `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` — 15 passed, 10 skipped
- `pnpm test:run` (full suite) — 189 passed, no failures
