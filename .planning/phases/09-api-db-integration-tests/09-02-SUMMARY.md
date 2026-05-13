---
phase: 09
plan: "02"
subsystem: testing/card-search
tags: [testing, card-search, integration-tests, vitest, postgresql]
dependency_graph:
  requires:
    - src/lib/cards/queries.ts (searchCards function from Plan 09-01)
    - src/test/helpers/db.ts (seedTestCard, truncateTable from Plan 09-01)
    - test/setup.ts (DATABASE_URL credential fix from Plan 09-01)
  provides:
    - src/api/__tests__/cards/search.test.ts (5 active integration tests for searchCards)
  affects: []
tech_stack:
  added: []
  patterns:
    - Direct lib-function invocation in tests (D-07, no HTTP layer)
    - beforeEach truncation for test isolation (D-12, D-13)
    - Explicit oracleId suffixes to avoid millisecond collision in multi-seed tests (Pitfall 4)
key_files:
  created: []
  modified:
    - src/api/__tests__/cards/search.test.ts
decisions:
  - "D-07 honored: tests call searchCards() directly, no NextRequest/NextResponse, no HTTP layer"
  - "D-12 honored: beforeEach truncates only cards table (no wishlists or users involved in search)"
  - "D-13 honored: each test starts with empty cards table via truncateTable"
  - "Explicit oracleId values used in multi-seed tests to prevent millisecond-collision on UNIQUE constraint"
  - "Sequential await (not Promise.all) in limit-10 seed loop for deterministic inserts"
metrics:
  duration: "109s (~2 minutes)"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
  commits: 1
---

# Phase 09 Plan 02: Search Integration Tests — Wave-2 Activation Summary

**One-liner:** Activated 5 `test.skip` stubs in `search.test.ts` with real Vitest integration tests calling `searchCards` directly against PostgreSQL — suite moved from 161→166 passed, 182→177 skipped.

## What Was Built

One file modified — all 5 `test.skip` stubs in `src/api/__tests__/cards/search.test.ts` replaced with active test bodies:

**1. `'GET /api/cards/search returns matching cards by name'`**
Seeds 3 cards with explicit `oracleId` values (`test-bl-001`, `test-bl-002`, `test-lp-001`). Calls `searchCards('Black Lotus')`. Asserts both Black Lotus variants are found and Lotus Petal is excluded. Verifies ILIKE substring matching.

**2. `'GET /api/cards/search returns empty array if no matches'`**
No seeding (beforeEach truncated cards). Calls `searchCards('NonExistentXYZ123')`. Asserts `toEqual([])`.

**3. `'GET /api/cards/search is case-insensitive'`**
Seeds one card (`oracleId: 'test-bl-ci-001'`). Calls `searchCards('black lotus')` and `searchCards('BLACK LOTUS')`. Asserts both find the seeded 'Black Lotus'. Verifies PostgreSQL ILIKE case-insensitivity.

**4. `'GET /api/cards/search limits results to 10 cards'`**
Seeds 15 cards sequentially in a for-loop with counter suffixes (`test-limit-0` through `test-limit-14`). Calls `searchCards('Test Card')`. Asserts `results.length <= 10`. Verifies the `.limit(10)` clause in `searchCards`.

**5. `'GET /api/cards/search requires at least 2 characters'`**
No seeding. Asserts `searchCards('A')` rejects with exact message `'Query must be at least 2 characters long'`. Uses `rejects.toThrow()` per D-05 (throws not returns `[]`).

**Infrastructure note:** Docker Desktop was not running at execution start. PostgreSQL 15 (Homebrew) was started and the `mtgprice` user/database was provisioned, then Drizzle migrations ran successfully. All 5 tests pass against PostgreSQL 15 running locally.

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Activate 5 search integration tests | 82755ca | src/api/__tests__/cards/search.test.ts |

Task 2 was verification-only — no file modifications, no additional commit.

## Suite Change Confirmation

| Metric | Before (Plan 09-01 baseline) | After (Plan 09-02) |
|--------|------------------------------|---------------------|
| Tests passed | 161 | 166 (+5) |
| Tests skipped | 182 | 177 (-5) |
| Tests todo | 38 | 38 (unchanged) |
| Total | 381 | 381 (unchanged) |

`pnpm test:run` confirmed: `Tests  166 passed | 177 skipped | 38 todo (381)`

## Acceptance Criteria Verification

- `grep -c "test.skip" src/api/__tests__/cards/search.test.ts` → 0 (verified)
- 5 active `test(` declarations (verified)
- Imports `searchCards` from `@/lib/cards/queries` (verified)
- Imports `seedTestCard`, `truncateTable` from `@/test/helpers/db` (verified)
- `beforeEach(async () => { await truncateTable(cards) })` present (verified)
- All 5 test names match original stub labels (verified)
- Min-2-chars test asserts exact string `'Query must be at least 2 characters long'` (verified)
- Limit-10 test seeds 15 cards with `test-limit-0` through `test-limit-14` (verified)
- `pnpm biome check` exits 0 (verified)
- `npx vitest run src/api/__tests__/cards/search.test.ts` shows `Tests  5 passed (5)` (verified)
- `grep -c "vi.mock" src/api/__tests__/cards/search.test.ts` → 0 (verified)
- `grep -c "test.skip" src/lib/wishlist/__tests__/actions.test.ts` → 6 (Plan 09-03 targets untouched)

## Deviations from Plan

**[Rule 3 - Blocking] PostgreSQL not running via Docker Desktop**

- **Found during:** Task 1 pre-flight
- **Issue:** Docker Desktop daemon was not running; socket `/Users/luizpansarini/.docker/run/docker.sock` did not exist.
- **Fix:** Opened Docker Desktop (which still needed admin privileges to create socket), then used existing Homebrew PostgreSQL 15 instead. Created `mtgprice` user/database and ran Drizzle migrations.
- **Files modified:** None (infrastructure setup, not code)
- **Outcome:** All 5 tests pass against PostgreSQL 15 (Homebrew). Production tests use TimescaleDB via Docker, but the cards/queries behavior being tested does not depend on TimescaleDB extensions.

No production code was touched. No other deviations.

## Known Stubs

None — all 5 tests are fully implemented and wired to real PostgreSQL.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. This plan modifies only a test file. No threat flags to report.

## Requirements Fulfilled

- TEST-08: 5 active integration tests for card search, all green against real PostgreSQL

## Self-Check: PASSED
