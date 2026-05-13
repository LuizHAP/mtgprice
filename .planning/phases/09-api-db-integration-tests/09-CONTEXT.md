# Phase 9: API & DB Integration Tests - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Activate the 11 skipped test cases in `src/api/__tests__/cards/search.test.ts` (5 tests) and `src/lib/wishlist/__tests__/actions.test.ts` (6 tests) so they run against a real PostgreSQL database. Integration-level coverage confirms that card search queries, FK constraints, and wishlist CRUD behave correctly at the DB layer — not mocked.

**Explicitly out of scope for Phase 9:**
- New features (no new API endpoints, no UI changes)
- Scheduler tests (Phase 10)
- Orchestrator tests (Phase 11)
- Separate test database infrastructure (Phase 9 uses the dev DB with cleanup)

</domain>

<decisions>
## Implementation Decisions

### DB Test Helpers

- **D-01:** Create `src/test/helpers/db.ts` as a **fresh rewrite** — new file at the path the tests expect (`@/test/helpers/db` resolves to `src/test/helpers/db.ts`). This file imports `db` internally and does NOT require it as a parameter.
- **D-02:** Helper signatures are: `seedTestCard(cardData?)`, `seedTestWishlist(wishlistData?)`, `truncateTable(table)`. No `db` param — the helpers manage their own DB import. Tests call them without passing `db`.
- **D-03:** The existing `test/helpers/db.ts` (root level, with `db` param) stays as-is — it serves other test files and is not removed.

### searchCards Function

- **D-04:** Create `src/lib/cards/queries.ts` with a standalone `searchCards(query: string)` export. Card search belongs in the cards domain, not the wishlist domain.
- **D-05:** `searchCards` validates the query: if `query.length < 2`, it throws an error (or returns `[]` — planner's discretion, but behavior must be consistent with the route handler's 400 response expectation). The 2-char minimum enforcement lives inside `searchCards`, not only in the route handler.
- **D-06:** The existing route handler `src/app/api/cards/search/route.ts` is updated to import `searchCards` from `src/lib/cards/queries.ts` and delegate the DB query to it. The handler retains its HTTP-level logic (400 on validation error, 500 on unexpected error).

### Test Strategy — Search Tests

- **D-07:** `src/api/__tests__/cards/search.test.ts` tests the `searchCards()` DB query function **directly** — not the Next.js route handler. Tests import `searchCards` from `src/lib/cards/queries.ts` and call it with real DB data. No mock NextRequest needed.
- **D-08:** The "minimum-2-chars" test case in `search.test.ts` validates that `searchCards('A')` (single char) produces an error or empty result — matching D-05 behavior.

### Test Strategy — Wishlist Actions Tests

- **D-09:** `src/lib/wishlist/__tests__/actions.test.ts` tests `addCardToWishlist`, `removeCardFromWishlist` from `src/lib/wishlist/queries.ts`, and `searchCards` from `src/lib/cards/queries.ts`. These are called directly (not through HTTP handlers).
- **D-10:** The FK violation test (`addCardToWishlist` with a non-existent cardId) relies on the real PostgreSQL FK constraint — no mocking.

### Test Database & Cleanup

- **D-11:** Integration tests use the **same dev database** (`mtgprice`), configured via the existing `DATABASE_URL` in `test/setup.ts`. No separate test DB required.
- **D-12:** Cleanup strategy: **`beforeEach` truncation only**. Each test truncates the relevant tables (cards, wishlists) before running. If a test fails mid-way, data stays until the next test cleans it — acceptable for a single-user personal project with no concurrent test runs.
- **D-13:** `truncateTable(table)` from `src/test/helpers/db.ts` is the cleanup mechanism. Tests call it in `beforeEach` for each table they seed.

### Claude's Discretion

- Whether `searchCards` throws an `Error` or returns `[]` for queries shorter than 2 chars (either is valid — must be consistent with the test assertion and the route handler's error handling).
- Exact column selection in `searchCards` return type (planner should match what the route handler currently returns: `oracleId`, `name`, `set`, `imageUrl`).
- Whether `truncateTable` cascades (uses `DELETE CASCADE` or truncates in dependency order) — determined by FK constraints between cards and wishlists.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal & Success Criteria
- `.planning/ROADMAP.md` §"Phase 9: API & DB Integration Tests" — success criteria, requirements TEST-08 and TEST-09

### Test Files to Activate
- `src/api/__tests__/cards/search.test.ts` — 5 skipped tests for card search (name match, empty result, case-insensitive, limit-10, min-2-chars)
- `src/lib/wishlist/__tests__/actions.test.ts` — 6 skipped tests for wishlist actions (addCard, FK violation, removeCard, searchCards variants)

### Existing Implementation to Extend
- `src/app/api/cards/search/route.ts` — current route handler with inline DB query (to be refactored to import from queries.ts)
- `src/lib/wishlist/queries.ts` — `addCardToWishlist`, `removeCardFromWishlist` already live here
- `src/db/schema/wishlists.ts` — FK constraint definition (relevant for FK violation test)
- `src/db/index.ts` — DB client (`db`) used by new helpers and queries

### Existing Test Infrastructure
- `test/setup.ts` — sets `DATABASE_URL`, `JWT_SECRET`, etc. (applies to all tests via vitest setupFiles)
- `vitest.config.ts` — `include: ['src/**/__tests__/**/*.test.ts']`, alias `@` → `src/`
- `test/helpers/db.ts` — existing helpers (db-param signature) — NOT the target path; kept as-is

### Prior Phase Context
- `.planning/phases/08-circuit-breaker-tests/08-01-PLAN.md` — most recent plan format/pattern reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/wishlist/queries.ts` `addCardToWishlist(userId, cardId)`** — already implemented, no changes needed; just activate the test.
- **`src/lib/wishlist/queries.ts` `removeCardFromWishlist(userId, cardId)`** — already implemented, no changes needed.
- **`test/helpers/db.ts`** — has `seedTestCard`, `seedTestWishlist`, `truncateTable` with `db` param signature; provides the logic model for the new `src/test/helpers/db.ts` rewrite.
- **`src/app/api/cards/search/route.ts`** — has the complete `ilike`-based search query; the `searchCards` function in `src/lib/cards/queries.ts` should match this logic exactly.

### Established Patterns
- **Query functions in `src/lib/*/queries.ts`** — all DB logic is extracted from route handlers into named functions in domain-specific `queries.ts` files. `searchCards` follows this pattern.
- **Vitest `test.skip` → `test`** — phases 7 and 8 activated stubs by replacing `test.skip` with `test`, adding `beforeEach`/`afterEach`, and implementing the test body. Phase 9 follows the same pattern.
- **`import { db } from '@/db'`** — DB client imported as a singleton; all query functions call it directly.

### Integration Points
- **`src/app/api/cards/search/route.ts`** — refactor this file to delegate to `searchCards` from `src/lib/cards/queries.ts`. Handler returns `{ cards: results }`.
- **`vitest.config.ts` alias** — `@` → `src/`, so `@/test/helpers/db` resolves to `src/test/helpers/db.ts` (the new helper file to create).

</code_context>

<specifics>
## Specific Ideas

- `searchCards` in `src/lib/cards/queries.ts` should have the same column selection as the current route handler: `oracleId`, `name`, `set`, `imageUrl`.
- The 2-char minimum is enforced inside `searchCards` — consistent behavior whether called from tests or from the route handler.
- `actions.test.ts` tests `searchCards` as a "wishlist action" because the wishlist UI uses it for card search. It belongs in `src/lib/cards/queries.ts` but is tested in the wishlist actions suite for that reason.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 9-API & DB Integration Tests*
*Context gathered: 2026-05-13*
