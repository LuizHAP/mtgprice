---
phase: 09-api-db-integration-tests
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/api/__tests__/cards/search.test.ts
  - src/app/api/cards/search/route.ts
  - src/lib/cards/queries.ts
  - src/lib/wishlist/__tests__/actions.test.ts
  - src/test/helpers/db.ts
  - test/setup.ts
  - vitest.config.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-05-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase adds integration tests for the card search API and wishlist server actions, extracts the `searchCards` query into a reusable library function, and introduces a new no-parameter-db test helper module at `src/test/helpers/db.ts`. The production code in `route.ts` and `queries.ts` is simple and structurally sound. The primary defects are concentrated in the test infrastructure: a hardcoded real database URL in `test/setup.ts` that matches the production database name, a validation gap in `searchCards` that allows whitespace-only queries to reach the database, a fragile default in the `seedTestWishlist` helper, and missing negative test coverage for documented error branches.

---

## Critical Issues

### CR-01: `test/setup.ts` hardcodes database credentials matching the production database name

**File:** `test/setup.ts:6`
**Issue:** `DATABASE_URL` is hardcoded as `postgresql://mtgprice:mtgprice_password@localhost:5432/mtgprice`. The database name (`mtgprice`) is identical to the one used in `.env.local` for development. A developer who runs `npm test` without a separate test database — or in a CI environment where `DATABASE_URL` is already set to a real database — will execute `TRUNCATE`/`DELETE` statements against live data. The credentials are also committed to version control in plain text.

Beyond data destruction risk, committing any credentials (even "development-only" ones) to source is a security policy violation because the pattern normalizes credential-in-code across the codebase.

**Fix:** Remove the hardcoded connection string. Load from a `.env.test` file via Vitest's `envFile` option (or `dotenv`), and name the test database distinctly (e.g., `mtgprice_test`):

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    // ...
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://mtgprice:mtgprice_password@localhost:5432/mtgprice_test',
    },
  },
})
```

Then in `test/setup.ts` remove lines 4–7 entirely. Create a `.env.test` that is `.gitignore`'d, just like `.env`.

---

### CR-02: `searchCards` accepts whitespace-only queries, bypassing the 2-character guard

**File:** `src/lib/cards/queries.ts:33`
**Issue:** The length check `if (query.length < 2)` operates on the raw string. A caller that passes `"  "` (two spaces) has `query.length === 2` and bypasses the guard. The resulting SQL becomes `WHERE name ILIKE '%  %'` which performs a full table scan and returns every card whose name contains two consecutive spaces — in practice this is a near-unbounded wildcard scan against the entire `cards` table. The same flaw exists in the route handler at `route.ts:19`.

**Fix:** Trim the query before the length check and use the trimmed value for the DB call:

```ts
export async function searchCards(query: string): Promise<CardSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    throw new Error('Query must be at least 2 characters long')
  }

  return db
    .select({ ... })
    .from(cards)
    .where(ilike(cards.name, `%${trimmed}%`))
    .limit(10)
}
```

Apply the same trim in the route handler before calling `searchCards`, or rely solely on the library-level trim. The route handler guard should also trim before its length check:

```ts
const query = searchParams.get('q')?.trim()
if (!query || query.length < 2) { ... }
```

---

## Warnings

### WR-01: `seedTestCard` default `oracleId` is collision-prone under rapid sequential calls

**File:** `src/test/helpers/db.ts:47`
**Issue:** The default `oracleId` is `test-oracle-${Date.now()}`. `Date.now()` has millisecond precision. Any two `seedTestCard()` calls that execute within the same millisecond without an explicit `oracleId` override will attempt to insert a duplicate value against the `oracle_id UNIQUE` constraint and the test will fail with a non-obvious FK/unique violation error rather than a meaningful assertion failure. The `seedTestUser` helper (line 27) correctly adds a `Math.random()` suffix; `seedTestCard` does not.

**Fix:** Add a random suffix to match the `seedTestUser` pattern:

```ts
oracleId: `test-oracle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
```

The `seedTestWishlist` default `cardId` (line 81) has the same flaw and should receive the same fix.

---

### WR-02: `seedTestWishlist` default `userId: 1` causes silent FK failure

**File:** `src/test/helpers/db.ts:80`
**Issue:** The `userId` default is the hard-coded integer `1`. Because the `users` table uses a `serial` primary key assigned by PostgreSQL, there is no guarantee that any user with `id = 1` exists at the time `seedTestWishlist()` is called without an explicit `userId` override. In a freshly truncated test environment the first inserted user may receive `id = 2` or higher (if the sequence was not reset). Calling `seedTestWishlist()` without overriding `userId` will throw a PostgreSQL FK violation — `insert or update on table "wishlists" violates foreign key constraint` — which is confusing because it looks like a schema problem rather than a test helper defect. The JSDoc comment acknowledges this risk but the default is still dangerous.

**Fix:** Remove the integer default entirely and require callers to always supply a valid `userId`, making the contract explicit:

```ts
export async function seedTestWishlist(
  wishlistData: { userId: number; cardId?: string } & Partial<typeof wishlists.$inferInsert>,
): Promise<typeof wishlists.$inferSelect> {
  // userId is now required — no default that can silently FK-fail
  ...
}
```

Alternatively, seed a user inside the helper and return both the user and wishlist, but that changes the API contract.

---

### WR-03: `addCardToWishlist` duplicate-entry error branch is not tested

**File:** `src/lib/wishlist/__tests__/actions.test.ts`
**Issue:** `addCardToWishlist` in `src/lib/wishlist/queries.ts` (lines 151–158) contains specific error-handling logic that catches PostgreSQL error code `23505` (unique constraint violation) and translates it into `Error('Card already in wishlist')`. This branch is not exercised by any test in `actions.test.ts`. A regression in that catch block (e.g., the error code check silently breaking) would go undetected.

**Fix:** Add a test:

```ts
test('addCardToWishlist throws "Card already in wishlist" on duplicate', async () => {
  const user = await seedTestUser()
  const card = await seedTestCard({ oracleId: 'test-dup-card-001' })
  await addCardToWishlist(user.id, card.oracleId) // first insert succeeds
  await expect(addCardToWishlist(user.id, card.oracleId))
    .rejects.toThrow('Card already in wishlist')
})
```

---

### WR-04: `removeCardFromWishlist` "not in wishlist" error branch is not tested

**File:** `src/lib/wishlist/__tests__/actions.test.ts`
**Issue:** `removeCardFromWishlist` (queries.ts lines 174–177) throws `Error('Card not in wishlist')` when zero rows are deleted. This is a documented, named error branch. No test exercises it. Like WR-03, a silent regression here would not be caught.

**Fix:** Add a test:

```ts
test('removeCardFromWishlist throws "Card not in wishlist" when entry absent', async () => {
  const user = await seedTestUser()
  const card = await seedTestCard({ oracleId: 'test-rm-missing-001' })
  // Do NOT seed a wishlist entry
  await expect(removeCardFromWishlist(user.id, card.oracleId))
    .rejects.toThrow('Card not in wishlist')
})
```

---

## Info

### IN-01: `vitest.config.ts` includes `test/setup.ts` path in coverage exclude but the path differs between setup files

**File:** `vitest.config.ts:34`
**Issue:** The coverage `exclude` array lists `'test/setup.ts'` (the root-level setup file). The new `src/test/helpers/db.ts` helper module is not excluded. If coverage runs, `src/test/helpers/db.ts` will be included in coverage calculation even though it is pure test infrastructure, which inflates or deflates branch coverage numbers.

**Fix:** Add the helper to the exclude list:

```ts
exclude: [
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/__tests__/**',
  'test/setup.ts',
  'src/test/**',   // <-- add this
],
```

---

### IN-02: `src/lib/cards/queries.ts` missing upper-bound validation on query length

**File:** `src/lib/cards/queries.ts:33`
**Issue:** `searchCards` enforces a minimum length of 2 but no maximum. An arbitrarily long query string is interpolated directly into the `ILIKE` pattern string (`%${query}%`). While Drizzle ORM parameterizes the value (preventing SQL injection), sending a very long pattern string still incurs unnecessary database work. The route handler also has no upper-bound check.

**Fix:** Add a maximum length guard consistent with the `cards.name` column width (255):

```ts
if (trimmed.length > 255) {
  throw new Error('Query must be at most 255 characters long')
}
```

Add the matching `> 255` check in the route handler to return HTTP 400.

---

_Reviewed: 2026-05-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
