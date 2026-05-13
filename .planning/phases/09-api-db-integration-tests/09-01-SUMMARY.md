---
phase: 09
plan: "01"
subsystem: testing/db-helpers
tags: [testing, db-helpers, query-extraction, integration-tests, drizzle, biome]
dependency_graph:
  requires: []
  provides:
    - src/test/helpers/db.ts (no-param test data helpers)
    - src/lib/cards/queries.ts (reusable searchCards function)
    - test/setup.ts (corrected DATABASE_URL credentials)
  affects:
    - src/app/api/cards/search/route.ts (delegates to searchCards)
tech_stack:
  added: []
  patterns:
    - No-param module-level db singleton import in test helpers
    - Extracted query function pattern (route → lib/cards/queries.ts)
    - Drizzle ilike + limit(10) query for card name search
key_files:
  created:
    - src/test/helpers/db.ts
    - src/lib/cards/queries.ts
  modified:
    - test/setup.ts
    - src/app/api/cards/search/route.ts
decisions:
  - "D-01/D-02: No db parameter in src/test/helpers/db.ts — db imported at module level"
  - "D-03: Root-level test/helpers/db.ts left unchanged"
  - "D-04: searchCards extracted from route handler into src/lib/cards/queries.ts"
  - "D-05: searchCards throws Error rather than returning [] for short queries (aligns with HTTP 400 message)"
  - "D-06: Route handler retains own query.length < 2 guard for HTTP 400; lib-level throws for double protection"
metrics:
  duration: "170s (~3 minutes)"
  completed: "2026-05-13"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
  commits: 2
---

# Phase 09 Plan 01: API & DB Integration Tests — Wave-1 Foundation Summary

**One-liner:** Credential fix + no-param DB helpers (`src/test/helpers/db.ts`) + `searchCards` extracted into `src/lib/cards/queries.ts` + route refactored to delegate — Wave-1 foundation unlocking 11 skipped integration tests.

## What Was Built

Three deliverables lay the foundation for plans 09-02 and 09-03:

**1. Credential fix (`test/setup.ts` line 6)**
Changed `postgresql://postgres:postgres@localhost:5432/mtgprice` to `postgresql://mtgprice:mtgprice_password@localhost:5432/mtgprice`, matching the docker-compose provisioned credentials. Without this fix, all integration tests fail to connect.

**2. New test helper module (`src/test/helpers/db.ts`)**
Four exported async functions with no `db` parameter (D-01/D-02):
- `seedTestUser(userData?)` — unique email per call using `Date.now()+random` to avoid `users.email` unique constraint violations
- `seedTestCard(cardData?)` — defaults matching root-level analog
- `seedTestWishlist(wishlistData?)` — caller responsible for FK-safe userId (documented in JSDoc)
- `truncateTable(table)` — `db.delete(table)` with `biome-ignore` comment on `table: any`

The root-level `test/helpers/db.ts` (db-param signatures) was not modified (D-03).

**3. Extracted query module + route refactor (`src/lib/cards/queries.ts`, `src/app/api/cards/search/route.ts`)**
Extracted `searchCards(query: string): Promise<CardSearchResult[]>` from the route handler into a standalone lib module (D-04). The function throws `Error('Query must be at least 2 characters long')` for `query.length < 2` (D-05). The route handler delegates to `searchCards` while retaining its own `query.length < 2` guard for HTTP 400 responses (D-06 — intentional double protection).

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Fix DATABASE_URL + create src/test/helpers/db.ts | 1e481d1 | test/setup.ts, src/test/helpers/db.ts |
| 2 | Extract searchCards + refactor route | 2d33e56 | src/lib/cards/queries.ts, src/app/api/cards/search/route.ts |

## Observable Truths Verified

- `test/setup.ts` line 6 contains `postgresql://mtgprice:mtgprice_password@localhost:5432/mtgprice`
- `src/test/helpers/db.ts` exports exactly four async functions with no `db` parameter
- `src/lib/cards/queries.ts` exports `searchCards` and `CardSearchResult`; throws on short query
- `src/app/api/cards/search/route.ts` imports from `@/lib/cards/queries`; has 3 `NextResponse.json` returns (200/400/500)
- `pnpm biome check test/setup.ts src/test/helpers/db.ts src/lib/cards/queries.ts src/app/api/cards/search/route.ts` exits 0
- `pnpm test:run` shows `161 passed | 182 skipped | 38 todo (381)` — baseline preserved, no regressions
- `grep -c "test.skip" src/api/__tests__/cards/search.test.ts` returns 5 (still skipped, activated in 09-02)
- `grep -c "test.skip" src/lib/wishlist/__tests__/actions.test.ts` returns 6 (still skipped, activated in 09-03)

## Deviations from Plan

None — plan executed exactly as written.

## Pre-existing TypeScript Errors

`pnpm tsc --noEmit` shows pre-existing errors in out-of-scope files (Header.tsx, CardGrid.tsx, auth.test.ts, wishlist.test.ts, bot command tests). None of these are in files modified by this plan. Zero new TS errors introduced.

## Docker / PostgreSQL Status

Docker daemon was not running at execution time. The test suite (`pnpm test:run`) passes because the 11 integration tests are still `test.skip` in this plan — they do not exercise the DB. Plans 09-02 and 09-03 require a running PostgreSQL instance (`docker compose up -d postgres`).

## Notes for Plans 09-02 and 09-03

- Before running integration tests, ensure `docker compose up -d postgres` and wait for health check
- Import helpers from `@/test/helpers/db` (NOT `test/helpers/db` — different file, different signatures)
- Truncation order for actions tests: `wishlists` → `cards` → `users` (FK dependency order)
- `seedTestWishlist` requires a seeded user (FK: `wishlists.user_id → users.id` with ON DELETE no action)
- `searchCards` throws (not returns `[]`) for `query.length < 2` — use `rejects.toThrow(...)` in tests

## Requirements Fulfilled

- TEST-08 (foundation): `searchCards` extracted and reusable from tests; route delegates to it
- TEST-09 (foundation): `src/test/helpers/db.ts` exists with all four no-param helpers

## Self-Check: PASSED
