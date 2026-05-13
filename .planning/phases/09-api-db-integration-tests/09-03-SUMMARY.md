---
phase: 09
plan: "03"
subsystem: testing/wishlist-actions
tags: [testing, wishlist, fk-constraints, integration-tests, vitest, postgresql]
dependency_graph:
  requires:
    - src/lib/wishlist/queries.ts (addCardToWishlist, removeCardFromWishlist)
    - src/lib/cards/queries.ts (searchCards — from Plan 09-01)
    - src/test/helpers/db.ts (seedTestUser, seedTestCard, seedTestWishlist, truncateTable — from Plan 09-01)
    - test/setup.ts (DATABASE_URL credentials — fixed in Plan 09-01)
  provides:
    - src/lib/wishlist/__tests__/actions.test.ts (6 active integration tests)
  affects:
    - vitest.config.ts (fileParallelism: false — sequential execution for DB isolation)
tech_stack:
  added: []
  patterns:
    - FK-safe truncation order: wishlists (child) → cards → users (parents)
    - seedTestUser-first pattern (FK: wishlists.user_id → users.id)
    - Explicit oracleId values in multi-seed tests (no millisecond-collision risk)
    - rejects.toThrow() with no message for FK-violation test (PG version-independent)
    - fileParallelism: false for DB-sharing test file isolation
key_files:
  created: []
  modified:
    - src/lib/wishlist/__tests__/actions.test.ts
    - vitest.config.ts
decisions:
  - "D-09 honored: tests call addCardToWishlist/removeCardFromWishlist/searchCards directly, no HTTP layer"
  - "D-10 honored: FK violation test uses rejects.toThrow() with no message — code 23503 re-throws as raw PG error"
  - "D-12/D-13 honored: beforeEach truncates wishlists → cards → users in FK-safe order"
  - "fileParallelism: false added to vitest.config.ts — Rule 2 (test isolation required for correctness)"
metrics:
  duration: "183s (~3 minutes)"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
  commits: 3
---

# Phase 09 Plan 03: Wishlist Action Integration Tests Summary

**One-liner:** Activated 6 `test.skip` stubs in `actions.test.ts` with real Vitest integration tests exercising `addCardToWishlist`, `removeCardFromWishlist`, and `searchCards` against live PostgreSQL with full FK chain (users ← wishlists → cards) — plus `fileParallelism: false` to eliminate cross-file DB race conditions.

## What Was Built

One test file fully activated + one config fix for test isolation:

**1. `src/lib/wishlist/__tests__/actions.test.ts` — 6 active integration tests**

The `describe('Wishlist server actions')` block now contains:

- **`beforeEach`** truncates in FK-safe order: `wishlists` (child) → `cards` → `users` (parents). Prevents data bleeding between tests and avoids FK constraint violations during cleanup.

- **`'addCardToWishlist inserts into wishlist table'`** — Seeds a user (via `seedTestUser()`) and a card (`oracleId: 'test-add-card-001'`), calls `addCardToWishlist(user.id, card.oracleId)`, then directly queries the `wishlists` table to assert 1 row exists with matching userId and cardId.

- **`'addCardToWishlist throws if card_id invalid'`** — Seeds a user (satisfying the `user_id` FK), then asserts `addCardToWishlist(user.id, 'non-existent-oracle-id')` rejects. No specific message assertion — PostgreSQL FK error code 23503 re-throws as a raw error from the catch-and-rethrow path in `queries.ts`.

- **`'removeCardFromWishlist deletes from wishlist table'`** — Seeds user + card + wishlist entry, calls `removeCardFromWishlist`, then asserts the wishlist row count is 0.

- **`'searchCards queries cards table by name'`** — Seeds three cards with explicit oracleIds (`test-sc-bl-001`, `test-sc-bk-001`, `test-sc-wk-001`). Asserts 'Black Lotus' and 'Black Knight' appear in `searchCards('Black')` results and 'White Knight' does not.

- **`'searchCards returns empty array if no matches'`** — No seeding. Asserts `searchCards('NonExistentXYZ')` returns `[]`.

- **`'searchCards is case-insensitive'`** — Seeds `'Black Lotus'` with `oracleId: 'test-sc-ci-001'`. Asserts both `searchCards('black lotus')` and `searchCards('BLACK LOTUS')` find it via PostgreSQL ILIKE.

**2. `vitest.config.ts` — `fileParallelism: false`**

Second consecutive `pnpm test:run` failed with FK violation: `Key (card_id)=(test-remove-card-001) is not present in table "cards"`. Root cause: `search.test.ts`'s `beforeEach` truncated the `cards` table concurrently while `actions.test.ts` was in the middle of seeding a card then a wishlist row referencing it. Setting `fileParallelism: false` ensures test files sharing a real PostgreSQL database run sequentially. Covered by Rule 2 (missing critical functionality — test isolation is a correctness requirement).

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Activate 6 wishlist integration tests | 2fcc9b6 | src/lib/wishlist/__tests__/actions.test.ts |
| 2 | Fix parallel test file DB race condition | 5e3669b | vitest.config.ts |

## Suite Change Confirmation

| Metric | Before (Plan 09-02 baseline) | After (Plan 09-03) |
|--------|------------------------------|---------------------|
| Tests passed | 166 | 172 (+6) |
| Tests skipped | 177 | 171 (-6) |
| Tests todo | 38 | 38 (unchanged) |
| Total | 381 | 381 (unchanged) |

`pnpm test:run` confirmed twice consecutively: `Tests  172 passed | 171 skipped | 38 todo (381)` — identical counts, 0 failures.

## Phase 9 Success Criteria Verification

| Criterion | Result |
|-----------|--------|
| `grep -c "test.skip" src/api/__tests__/cards/search.test.ts` → 0 | PASS |
| `grep -c "test.skip" src/lib/wishlist/__tests__/actions.test.ts` → 0 | PASS |
| `src/test/helpers/db.ts` exists | PASS |
| Both target files import from `@/test/helpers/db` | PASS |
| Two consecutive `pnpm test:run` runs produce identical pass/skip counts | PASS |
| 0 failures in both runs | PASS |
| FK violation test passes via real PostgreSQL constraint (no mocking) | PASS |
| No production source under `src/lib/` modified | PASS |
| Combined Phase 9 delta: +11 tests passing vs pre-Phase-9 baseline (161→172) | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Parallel test file execution causing DB race conditions**
- **Found during:** Task 2 (second consecutive `pnpm test:run`)
- **Issue:** `search.test.ts` `beforeEach` truncated `cards` table concurrently with `actions.test.ts` seeding a card and then a wishlist row referencing it. Second run failed: `Key (card_id)=(test-remove-card-001) is not present in table "cards"`.
- **Fix:** Added `fileParallelism: false` to `vitest.config.ts` — test files sharing a real PostgreSQL database now run sequentially.
- **Files modified:** `vitest.config.ts`
- **Commit:** 5e3669b

## Known Stubs

None — all 6 tests are fully implemented and wired to real PostgreSQL.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. This plan modifies only test files and test configuration. No threat flags to report.

## Requirements Fulfilled

- TEST-09: 6 active integration tests for wishlist server actions and searchCards variants, all green against real PostgreSQL

## Self-Check: PASSED
