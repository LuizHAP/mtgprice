# Phase 9: API & DB Integration Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 9-api-db-integration-tests
**Areas discussed:** Helper path, searchCards source, Search test level, Test DB setup

---

## Helper Path

| Option | Description | Selected |
|--------|-------------|----------|
| Create src/test/helpers/db.ts (new, standalone) | New file importing db internally, no db param. Tests call seedTestCard({ name: 'Black Lotus' }) | ✓ |
| Move test/helpers/db.ts → src/test/helpers/db.ts | Relocate existing file, keep db param signature | |
| Keep at test/ and update imports | Change imports to relative paths, break @ alias convention | |

**User's choice:** Create src/test/helpers/db.ts as a fresh rewrite (no db param)

Follow-up — Fresh rewrite vs re-export:

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh rewrite | New standalone file, no coupling to existing test/helpers/db.ts | ✓ |
| Re-export / thin wrapper | src/test wraps root test/helpers by binding db param | |

**Notes:** Existing `test/helpers/db.ts` stays as-is. The new `src/test/helpers/db.ts` is an independent rewrite with simpler API.

---

## searchCards Source

| Option | Description | Selected |
|--------|-------------|----------|
| Add to src/lib/wishlist/queries.ts | Consistent with addCardToWishlist/removeCardFromWishlist pattern | |
| New src/lib/cards/queries.ts | Card search belongs in the cards domain, not wishlist | ✓ |
| Leave in route handler, test differently | Test route handler directly, avoid new function | |

**User's choice:** New `src/lib/cards/queries.ts`

Follow-up — Route handler update:

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — route handler imports from queries.ts | Handler becomes thin wrapper, no duplicate logic | ✓ |
| No — leave route handler as-is | Duplicate DB query logic | |

**Notes:** Route handler at `src/app/api/cards/search/route.ts` will be refactored to import `searchCards` from the new queries file.

---

## Search Test Level

| Option | Description | Selected |
|--------|-------------|----------|
| Test DB query function directly | Import searchCards from queries.ts, call against real DB. No HTTP layer | ✓ |
| Test route handler with mock NextRequest | Full handler testing including HTTP validation | |
| Test both (query + handler) | Two describe blocks, more coverage but more complexity | |

**User's choice:** Test the DB query function directly

Follow-up — Min-2-chars validation location:

| Option | Description | Selected |
|--------|-------------|----------|
| Inside searchCards() — throw if query < 2 chars | Consistent behavior at query level | ✓ |
| Route handler only | Min-2 stays as HTTP 400, test skips this case | |
| Both (route + function) | Dual defense, over-engineered | |

**Notes:** `searchCards` enforces the 2-char minimum. The 5th test case (`min-2-chars`) in `search.test.ts` validates this behavior at the function level.

---

## Test DB Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Same dev DB (mtgprice) with cleanup | Already configured, simple, acceptable for personal project | ✓ |
| Separate test DB (mtgprice_test) via TEST_DATABASE_URL | Clean isolation but more setup overhead | |

**User's choice:** Same dev DB with cleanup

Follow-up — Cleanup strategy:

| Option | Description | Selected |
|--------|-------------|----------|
| beforeEach + afterEach (belt-and-suspenders) | Truncate before and after each test | |
| beforeEach only | Clean slate at start of each test | ✓ |
| afterEach only | Relies on previous test having left DB clean | |

**Notes:** `beforeEach` truncation of relevant tables (cards, wishlists). Uses `truncateTable` helper from `src/test/helpers/db.ts`.

---

## Claude's Discretion

- Whether `searchCards` throws an Error or returns `[]` for queries < 2 chars (either acceptable, must match test assertion)
- Exact column selection in `searchCards` return value
- Whether `truncateTable` cascades or truncates in dependency order

## Deferred Ideas

None — discussion stayed within phase scope.
