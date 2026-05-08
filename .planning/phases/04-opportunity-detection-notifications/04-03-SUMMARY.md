---
phase: 04-opportunity-detection-notifications
plan: "03"
subsystem: opportunity-detector
tags: [detector, queries, d07-state-machine, tdd, drizzle, opportunities, detection-candidates]
dependency_graph:
  requires:
    - src/db/schema/opportunities.ts (04-01 — opportunities table)
    - src/db/schema/detectionCandidates.ts (04-01 — D-07 state store)
    - src/lib/opportunities/config.ts (04-02 — DetectionConfig)
    - src/db/schema/prices.ts (priceBrl, timestamp, source columns)
    - src/db/schema/wishlists.ts (userId, cardId join target)
    - src/db/schema/cards.ts (oracleId, name for join and display)
    - src/lib/wishlist/queries.ts (getUserWishlist)
    - src/lib/logger.ts (Winston logger)
  provides:
    - src/lib/opportunities/detector.ts (evaluateCandidate pure function)
    - src/lib/opportunities/queries.ts (all 14 DB query + orchestrator functions)
    - src/lib/opportunities/index.ts (updated: re-exports detector + queries)
  affects:
    - Plan 04-04 (scheduler): calls detectOpportunitiesForWishlist + insertOpportunity + markOpportunitySent
    - Plan 04-05 (/history command): calls getRecentOpportunities(10)
tech_stack:
  added: []
  patterns:
    - Pure function pattern for D-01/D-02/D-03/D-04/D-06 detection (zero DB, unit-testable)
    - D-07 candidate state machine via detection_candidates table (insert-on-first-confirm, promote+delete-on-second-confirm, delete-on-streak-break, stale-cleanup-every-run)
    - Drizzle sql`` template for AVG/EXTRACT/interval expressions (fully parameterized)
    - ON CONFLICT DO NOTHING for idempotent candidate insert against UNIQUE(card_id, source)
    - .toFixed(2) for Drizzle numeric(10,2) column mapping
    - Compile-time source union type ['ligamagic','tcgplayer','cardmarket','cardkingdom'] (no dynamic strings)
    - TDD RED-GREEN cycle for both production modules (14 detector tests + 10 queries tests)
key_files:
  created:
    - src/lib/opportunities/detector.ts
    - src/lib/opportunities/queries.ts
    - src/lib/opportunities/__tests__/detector.test.ts
    - src/lib/opportunities/__tests__/queries.test.ts
  modified:
    - src/lib/opportunities/index.ts
decisions:
  - "Pure evaluateCandidate handles D-01/D-02/D-03/D-04/D-06 only; D-07 lives in orchestrator"
  - "deleteCandidate uses .returning() for consistent mock-friendly terminal method"
  - "getBaselineMean and getHistoryDaysForPair add explicit .limit(1) for both correctness and test compatibility"
  - "Non-null assertions replaced with nullish coalescing (?? 0) in promotion block to satisfy biome lint"
metrics:
  duration_seconds: 1193
  completed_date: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
  commits: 4
---

# Phase 04 Plan 03: Opportunity Detector and Query Layer Summary

**One-liner:** Pure evaluateCandidate function + 14 Drizzle DB query functions + D-07 candidate state machine orchestrator, all TDD-verified across 34 tests.

## What Was Built

### Task 1: Pure Detector Function (TDD)

`src/lib/opportunities/detector.ts` implements `evaluateCandidate(input, config)` — a zero-DB pure function implementing D-01/D-02/D-03/D-04/D-06:

- **D-06 cold-start guard:** `historyDays < minHistoryDays` → `cold_start`
- **D-01/D-02/D-03 null guards:** no latest, baseline, or sevenDayAgo → typed reasons
- **D-03:** `latest <= baseline` (AND semantics, ≤ inclusive)
- **D-04:** `latest <= sevenDayAgo * (1 - dropThreshold)` (≤ inclusive)
- `dropPercent` is positive (price fell), rounded to 2 decimals

D-07 is explicitly NOT implemented here. The state machine lives in the orchestrator.

14 tests in `detector.test.ts` cover all boundary cases including boundary-exact values from the spec.

### Task 2: DB Query Layer + Orchestrator (TDD)

`src/lib/opportunities/queries.ts` exports 14 async functions:

| Function | Purpose |
|---|---|
| `getBaselineMean` | 30-day AVG price_brl (D-03) |
| `getPriceSevenDaysAgo` | Closest price to (now - lookbackDays) ±6h (D-02) |
| `getLatestPrice` | Most recent price_brl |
| `getHistoryDaysForPair` | Days of history (D-06) |
| `isInCooldown` | Silence check via opportunities table (D-12/D-13) |
| `getCandidate` | D-07 state store lookup |
| `insertCandidate` | D-07 first-run record (ON CONFLICT DO NOTHING) |
| `deleteCandidate` | D-07 streak-break / post-promotion cleanup |
| `deleteStaleCandidates` | D-07 stale housekeeping (> 2 days old) |
| `insertOpportunity` | Persist promoted opportunity |
| `markOpportunitySent` | D-24 retry support |
| `getUnsentOpportunitiesLast24h` | D-24 unsent query |
| `getRecentOpportunities` | /history command (Plan 05) |
| `detectOpportunitiesForWishlist` | Full orchestrator with D-07 state machine |

**D-07 State Machine** (in `detectOpportunitiesForWishlist`):
1. `deleteStaleCandidates()` once per run (zombie row prevention)
2. For each (card, source): skip if in cooldown
3. `evaluateCandidate()` → fires=false → `deleteCandidate` (streak broken)
4. `evaluateCandidate()` → fires=true, no candidate → `insertCandidate` (run 1, no alert)
5. `evaluateCandidate()` → fires=true, existing candidate → PROMOTE + `deleteCandidate` (run 2, alert)

10 tests in `queries.test.ts` cover all 4 D-07 branches, multi-source independence, empty wishlist, getRecentOpportunities, and insertOpportunity numeric mapping.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock builder chain incompatibility with Drizzle query patterns**
- **Found during:** Task 2 GREEN phase (first run)
- **Issue:** The test's `createSelectBuilder` had `.orderBy()` as terminal (mockResolvedValue) but `getLatestPrice` calls `.limit()` after `.orderBy()`. Also `createDeleteBuilder` had `.where()` as terminal but `deleteStaleCandidates` chains `.returning()` after `.where()`.
- **Fix:** Made `.limit()` the terminal for select builders (mockResolvedValue). Made `.where()` chainable (mockReturnValue) and `.returning()` the terminal for delete builders. Updated `deleteCandidate` in queries.ts to use `.returning()` for consistency.
- **Files modified:** `src/lib/opportunities/__tests__/queries.test.ts`, `src/lib/opportunities/queries.ts`
- **Commit:** 3af6b60

**2. [Rule 1 - Bug] Biome lint violations in initial queries.ts**
- **Found during:** Task 2 GREEN phase
- **Issue:** Non-null assertions (`latest!`, `baseline!`, `sevenDayAgo!`, `result.dropPercent!`) forbidden by biome's `noNonNullAssertion`. Also formatting issues.
- **Fix:** Replaced with nullish coalescing (`?? 0`). Ran `biome check --write` to auto-fix formatting.
- **Files modified:** `src/lib/opportunities/queries.ts`
- **Commit:** 3af6b60

**3. [Rule 2 - Missing Critical] Added .limit(1) to getBaselineMean and getHistoryDaysForPair**
- **Found during:** Task 2 GREEN phase
- **Issue:** These queries omitted `.limit(1)` — both return at most 1 row (AVG is a scalar aggregate, EXTRACT/MIN is also scalar). Adding `.limit(1)` is both idiomatic and required for the mock builder's terminal chain.
- **Files modified:** `src/lib/opportunities/queries.ts`
- **Commit:** 3af6b60

## Security Notes

All STRIDE mitigations from the threat model are implemented:
- **T-04-03-01 (SQL injection):** All cardId/source values use Drizzle `eq()` parameterization. Config numbers interpolated via Drizzle `sql`` template binding, not string concatenation. Accepted by grep criteria (`no 'SELECT.*\${`).
- **T-04-03-04 (Information Disclosure):** Logger only emits wishlist size, eligible pairs, promotion count at info. Card IDs and source names at debug only.
- **T-04-03-05 (Spoofing):** Sources are compile-time `as const` tuple. The pre-existing `'liga_magic'` typo from Phase 3 is explicitly not propagated (comment in file + grep acceptance criterion).
- **T-04-03-08 (Outlier manipulation):** D-07 two-consecutive-runs guard implemented via detection_candidates state machine.
- **T-04-03-11 (Stale accumulation):** `deleteStaleCandidates()` called every orchestrator run before the pair loop.

## Self-Check


## Self-Check: PASSED

**Files:**
- FOUND: src/lib/opportunities/detector.ts
- FOUND: src/lib/opportunities/queries.ts
- FOUND: src/lib/opportunities/__tests__/detector.test.ts
- FOUND: src/lib/opportunities/__tests__/queries.test.ts
- FOUND: .planning/phases/04-opportunity-detection-notifications/04-03-SUMMARY.md

**Commits:**
- FOUND: 4dec71f test(04-03): add failing detector tests
- FOUND: 5cd53d9 feat(04-03): implement detector pure function
- FOUND: 4336fd8 test(04-03): add failing queries tests including D-07 state machine
- FOUND: 3af6b60 feat(04-03): implement opportunities queries and D-07 state machine orchestrator

**Tests:** 34 passed (14 detector + 10 queries + 10 config)
