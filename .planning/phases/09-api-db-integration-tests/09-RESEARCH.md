# Phase 9: API & DB Integration Tests - Research

**Researched:** 2026-05-13
**Domain:** Vitest integration testing with Drizzle ORM + PostgreSQL (real DB, no mocks)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Create `src/test/helpers/db.ts` as a fresh rewrite — new file at the path the tests expect (`@/test/helpers/db` resolves to `src/test/helpers/db.ts`). Imports `db` internally; does NOT require it as a parameter.
- **D-02:** Helper signatures: `seedTestCard(cardData?)`, `seedTestWishlist(wishlistData?)`, `truncateTable(table)`. No `db` param. Tests call them without passing `db`.
- **D-03:** The existing `test/helpers/db.ts` (root level, with `db` param) stays as-is — it serves other test files and is not removed.
- **D-04:** Create `src/lib/cards/queries.ts` with a standalone `searchCards(query: string)` export. Card search belongs in the cards domain, not the wishlist domain.
- **D-05:** `searchCards` validates the query: if `query.length < 2`, throws an error (or returns `[]` — planner's discretion, must be consistent with test assertion and the route handler's 400 response expectation).
- **D-06:** The existing route handler `src/app/api/cards/search/route.ts` is updated to import `searchCards` from `src/lib/cards/queries.ts` and delegate the DB query to it.
- **D-07:** `src/api/__tests__/cards/search.test.ts` tests the `searchCards()` DB query function directly — not the Next.js route handler. No mock NextRequest.
- **D-08:** The "minimum-2-chars" test case validates that `searchCards('A')` (single char) produces an error or empty result — matching D-05 behavior.
- **D-09:** `src/lib/wishlist/__tests__/actions.test.ts` tests `addCardToWishlist`, `removeCardFromWishlist` from `src/lib/wishlist/queries.ts`, and `searchCards` from `src/lib/cards/queries.ts`. Called directly, not through HTTP handlers.
- **D-10:** The FK violation test (`addCardToWishlist` with non-existent cardId) relies on real PostgreSQL FK constraint — no mocking.
- **D-11:** Integration tests use the same dev database (`mtgprice`), configured via existing `DATABASE_URL` in `test/setup.ts`.
- **D-12:** Cleanup strategy: `beforeEach` truncation only. Each test truncates relevant tables before running.
- **D-13:** `truncateTable(table)` from `src/test/helpers/db.ts` is the cleanup mechanism. Tests call it in `beforeEach` for each table they seed.

### Claude's Discretion

- Whether `searchCards` throws an `Error` or returns `[]` for queries shorter than 2 chars (either is valid — must be consistent with the test assertion and the route handler's error handling).
- Exact column selection in `searchCards` return type (planner should match what the route handler currently returns: `oracleId`, `name`, `set`, `imageUrl`).
- Whether `truncateTable` cascades (uses `DELETE CASCADE` or truncates in dependency order) — determined by FK constraints between cards and wishlists.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-08 | Tests active for card search endpoint (match by name, empty result, case-insensitive, limit 10, minimum 2 chars) | `searchCards()` extracted to `src/lib/cards/queries.ts`; tested directly against real DB via `seedTestCard` helper |
| TEST-09 | Tests active for wishlist server actions (addCard, FK violation, removeCard, searchCards variants) | `addCardToWishlist`/`removeCardFromWishlist` already exist in `src/lib/wishlist/queries.ts`; FK constraint confirmed in migration SQL; `searchCards` shared from cards domain |
</phase_requirements>

---

## Summary

Phase 9 activates 11 `test.skip` stubs across two test files by replacing them with real Vitest integration tests that call production DB query functions against a live PostgreSQL database. No new features are built; the goal is to replace mocks with real DB assertions.

The work breaks into three distinct deliverables: (1) create `src/test/helpers/db.ts` — a no-`db`-param version of the existing `test/helpers/db.ts`; (2) create `src/lib/cards/queries.ts` with `searchCards(query)` extracted from the existing route handler; (3) activate the 5 skipped tests in `search.test.ts` and 6 skipped tests in `actions.test.ts` by writing real `beforeEach` + `afterEach` + assertions.

A critical environmental finding: the `test/setup.ts` hardcodes `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mtgprice` but the actual Docker Compose service uses `mtgprice:mtgprice_password@localhost:5432/mtgprice`. The planner must address this mismatch — either update `test/setup.ts` to match docker-compose credentials, or confirm the user's local PostgreSQL accepts the `postgres:postgres` credentials. The PostgreSQL container was not running at research time.

**Primary recommendation:** Create the new helper file, extract `searchCards`, update `test/setup.ts` credentials to match `docker-compose.yml`, then activate the 11 stubs in dependency order: helpers first, then search tests, then wishlist action tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Card search query | API / Backend (`src/lib/cards/queries.ts`) | — | DB query logic belongs in the lib layer, not the route handler or test file |
| Route handler HTTP wiring | API / Backend (`src/app/api/cards/search/route.ts`) | — | Validates HTTP params, delegates to `searchCards`, maps errors to status codes |
| Wishlist CRUD | API / Backend (`src/lib/wishlist/queries.ts`) | — | Already implemented; test file calls these functions directly |
| FK constraint enforcement | Database / Storage | — | PostgreSQL enforces `wishlists.card_id → cards.oracle_id` at the DB layer |
| Test data seeding/cleanup | Test Infrastructure (`src/test/helpers/db.ts`) | — | Helpers are test-only utilities; must not be imported by production code |

---

## Standard Stack

### Core (all already installed — verified in package.json)

| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| vitest | ^3.0.9 (latest: 4.1.6) [VERIFIED: npm registry] | Test runner | Already configured; `pnpm test:run` is the project test command |
| drizzle-orm | ^0.38.4 (latest: 0.45.2) [VERIFIED: npm registry] | ORM for DB queries in helpers and production code | Project-wide DB layer; used by all query functions |
| postgres | ^3.4.5 (latest: 3.4.9) [VERIFIED: npm registry] | PostgreSQL driver (used by `drizzle-orm/postgres-js`) | Already wired in `src/db/index.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm `ilike` | (same as drizzle-orm) | Case-insensitive LIKE in Drizzle queries | `searchCards` uses `ilike(cards.name, '%query%')` — same as the existing route handler |
| drizzle-orm `.delete()` | (same as drizzle-orm) | Truncation in helpers | `truncateTable` calls `db.delete(table)` without a WHERE clause — matches the pattern in `test/helpers/db.ts` |

### No New Dependencies

This phase requires **zero new package installs**. All needed tools are present. [VERIFIED: package.json inspection]

---

## Architecture Patterns

### System Architecture Diagram

```
test file (search.test.ts / actions.test.ts)
       │
       │ import directly (no HTTP layer)
       ▼
src/lib/cards/queries.ts  ←── searchCards(query)
src/lib/wishlist/queries.ts ←── addCardToWishlist / removeCardFromWishlist
       │
       │ Drizzle ORM calls
       ▼
src/db/index.ts  (db singleton, DATABASE_URL from env)
       │
       ▼
PostgreSQL (mtgprice DB via docker-compose)

─── Test Setup Flow ───────────────────────────────────
beforeEach → truncateTable(cards) → truncateTable(wishlists)
           → seedTestCard() → seedTestWishlist()
           → [test body: call production function, assert result]
afterEach  → (no-op — cleanup is pre-test, not post-test, per D-12)
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── cards/
│   │   └── queries.ts          # NEW: searchCards(query) — extracted from route handler
│   └── wishlist/
│       ├── queries.ts          # EXISTS: addCardToWishlist, removeCardFromWishlist
│       └── __tests__/
│           ├── queries.test.ts # EXISTS (mocked, 5 passing)
│           └── actions.test.ts # EXISTS (6 skipped → activate)
├── test/
│   └── helpers/
│       ├── db.ts               # NEW: no-db-param helpers (D-01/D-02)
│       └── auth.ts             # NEW or stub: createTestToken (needed by wishlist.test.ts; not Phase 9 scope)
└── api/
    └── __tests__/
        └── cards/
            └── search.test.ts  # EXISTS (5 skipped → activate)

src/app/api/cards/search/route.ts  # EXISTS: refactor to import from lib/cards/queries.ts
test/helpers/db.ts                  # EXISTS: DO NOT MODIFY (D-03)
```

### Pattern 1: No-param Helper File (D-01, D-02)

**What:** The new `src/test/helpers/db.ts` imports `db` at the module level and exports functions that close over it — callers never pass `db` as an argument.

**When to use:** When the test file is in `src/` and uses the `@` alias, the `@/test/helpers/db` path resolves to `src/test/helpers/db.ts`. The existing `test/helpers/db.ts` at root uses a `db` parameter signature — that pattern is NOT used in the new file.

**Example:**
```typescript
// Source: Derived from existing test/helpers/db.ts + D-01/D-02 decisions
import { db } from '@/db'
import { cards } from '@/db/schema'
import { wishlists } from '@/db/schema/wishlists'

export async function seedTestCard(
  cardData: Partial<typeof cards.$inferInsert> = {},
): Promise<typeof cards.$inferSelect> {
  const defaultCard: typeof cards.$inferInsert = {
    oracleId: `test-oracle-${Date.now()}`,
    name: 'Test Card',
    set: 'TST',
    rarity: 'common',
    color: 'R',
    imageUrl: 'https://example.com/card.jpg',
    lastFetched: new Date(),
  }
  const inserted = await db.insert(cards).values({ ...defaultCard, ...cardData }).returning()
  return inserted[0]
}

export async function seedTestWishlist(
  wishlistData: Partial<typeof wishlists.$inferInsert> = {},
): Promise<typeof wishlists.$inferSelect> {
  const defaultWishlist: typeof wishlists.$inferInsert = {
    userId: 1,
    cardId: `test-oracle-${Date.now()}`,
    addedAt: new Date(),
  }
  const inserted = await db.insert(wishlists).values({ ...defaultWishlist, ...wishlistData }).returning()
  return inserted[0]
}

// biome-ignore lint/suspicious/noExplicitAny: Test helper accepts any table
export async function truncateTable(table: any): Promise<void> {
  await db.delete(table)
}
```

### Pattern 2: searchCards Function (D-04, D-05, D-06)

**What:** A standalone exported function in `src/lib/cards/queries.ts` that mirrors the `ilike` query in `route.ts` exactly, plus enforces the 2-char minimum.

**When to use:** Wherever card name search is needed from lib-layer code.

**Example:**
```typescript
// Source: Extracted from src/app/api/cards/search/route.ts
import { db } from '@/db'
import { cards } from '@/db/schema'
import { ilike } from 'drizzle-orm'

export type CardSearchResult = {
  oracleId: string
  name: string
  set: string | null
  imageUrl: string | null
}

export async function searchCards(query: string): Promise<CardSearchResult[]> {
  if (query.length < 2) {
    // Planner's choice: throw Error (consistent with route's 400 response)
    throw new Error('Query must be at least 2 characters long')
    // OR: return []
  }
  return db
    .select({
      oracleId: cards.oracleId,
      name: cards.name,
      set: cards.set,
      imageUrl: cards.imageUrl,
    })
    .from(cards)
    .where(ilike(cards.name, `%${query}%`))
    .limit(10)
}
```

### Pattern 3: Activating Skipped Tests (D-07, D-08, D-09, D-12)

**What:** Replace `test.skip(...)` with `test(...)`, add `beforeEach` truncation + seeding, and write real assertions. Pattern established in Phases 7 and 8.

**Example (search.test.ts):**
```typescript
// Source: Established pattern from Phase 7/8 plan execution
import { searchCards } from '@/lib/cards/queries'
import { cards } from '@/db/schema'
import { seedTestCard, truncateTable } from '@/test/helpers/db'
import { beforeEach, describe, expect, test } from 'vitest'

describe('Card Search API endpoint', () => {
  beforeEach(async () => {
    await truncateTable(cards)
  })

  test('GET /api/cards/search returns matching cards by name', async () => {
    await seedTestCard({ name: 'Black Lotus', oracleId: 'bl-001' })
    await seedTestCard({ name: 'Black Lotus (Arena)', oracleId: 'bl-002' })
    await seedTestCard({ name: 'Lotus Petal', oracleId: 'lp-001' })

    const results = await searchCards('Black Lotus')

    expect(results.some((c) => c.name === 'Black Lotus')).toBe(true)
    expect(results.some((c) => c.name === 'Black Lotus (Arena)')).toBe(true)
    expect(results.some((c) => c.name === 'Lotus Petal')).toBe(false)
  })
})
```

**Example (actions.test.ts — FK violation):**
```typescript
test('addCardToWishlist throws if card_id invalid', async () => {
  // No seed — card does not exist in cards table
  await expect(addCardToWishlist(1, 'non-existent-oracle-id')).rejects.toThrow()
})
```

### Anti-Patterns to Avoid

- **Using `vi.mock('@/db', ...)` in integration test files:** The whole point of Phase 9 is real DB assertions. Do not mock the DB module in `search.test.ts` or `actions.test.ts`. [VERIFIED: CONTEXT.md D-10]
- **Passing `db` as a parameter to the new helpers:** The new `src/test/helpers/db.ts` must NOT use the `db`-param signature. The existing `test/helpers/db.ts` at root uses that signature; the new file does not. [VERIFIED: CONTEXT.md D-01/D-02]
- **Truncating in `afterEach` only:** If a test fails mid-execution and leaves data, the next test must still start clean. `beforeEach` truncation ensures this. [VERIFIED: CONTEXT.md D-12]
- **Testing `searchCards` through the HTTP route handler:** Tests import `searchCards` directly and call it — no `NextRequest` mocking needed. [VERIFIED: CONTEXT.md D-07]
- **Deleting/replacing `test/helpers/db.ts`:** The root-level file serves bot and wishlist API test stubs. Leave it intact. [VERIFIED: CONTEXT.md D-03]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Case-insensitive SQL LIKE | Custom string manipulation or regex | Drizzle `ilike()` | Drizzle generates `ILIKE '%query%'` which PostgreSQL handles natively — same as existing route handler |
| Table row deletion for test isolation | Raw SQL `TRUNCATE TABLE` | `db.delete(table)` (no WHERE) | Drizzle's `.delete()` without `.where()` deletes all rows; simpler than raw SQL, handles schema types |
| FK constraint testing | Catching and inspecting raw PG error objects | Let PostgreSQL throw naturally in `addCardToWishlist` — test with `expect(...).rejects.toThrow()` | `addCardToWishlist` already catches code `23505`; FK violation for unknown `cardId` is code `23503` and should propagate as a thrown error |

**Key insight:** The existing route handler already has the complete correct query. `searchCards` in `src/lib/cards/queries.ts` is a simple extraction — copy the `select().from().where().limit()` chain as-is.

---

## Common Pitfalls

### Pitfall 1: DATABASE_URL Credential Mismatch
**What goes wrong:** Tests fail to connect to PostgreSQL with auth error `password authentication failed for user "postgres"`.
**Why it happens:** `test/setup.ts` hardcodes `postgresql://postgres:postgres@localhost:5432/mtgprice` but docker-compose uses `mtgprice:mtgprice_password`. [VERIFIED: reading both files]
**How to avoid:** The planner should choose one of:
  - Option A: Update `test/setup.ts` to use `postgresql://mtgprice:mtgprice_password@localhost:5432/mtgprice` (matches docker-compose)
  - Option B: Confirm that the local PostgreSQL installation accepts `postgres:postgres` (user may have set this up separately)
  - The test file comments say "configured via the existing `DATABASE_URL` in `test/setup.ts`" — so the setup file IS authoritative; just fix the credentials to match the actual Docker service.
**Warning signs:** `connection refused` or `password authentication failed` in test output.

### Pitfall 2: FK Chain — wishlists needs cards AND users
**What goes wrong:** `seedTestWishlist` fails because `wishlists.user_id` is a FK to `users.id`, and there is no user with id=1 in the test DB.
**Why it happens:** The default `userId: 1` in the helper assumes a user exists. If the `users` table is truncated or empty, the insert violates the FK. [VERIFIED: migration SQL — `wishlists.user_id references users.id ON DELETE no action`]
**How to avoid:** Either:
  - Option A: Seed a test user before seeding wishlists (insert into `users` first).
  - Option B: The test helper `seedTestWishlist` internally seeds a user if none exists.
  - Option C: Tests that use `seedTestWishlist` must call `seedTestUser` (or similar) in `beforeEach` first, in dependency order: truncate wishlists → truncate cards → truncate users → seed user → seed card → seed wishlist.
**Warning signs:** `insert into "wishlists" ... violates foreign key constraint "wishlists_user_id_users_id_fk"`.

### Pitfall 3: Truncation Order — FK Constraints Between Tables
**What goes wrong:** `db.delete(wishlists)` succeeds but `db.delete(cards)` fails because wishlists rows still reference cards rows (if truncation order is reversed).
**Why it happens:** `wishlists.card_id` references `cards.oracle_id` with `ON DELETE no action`. Deleting cards while wishlist rows reference them violates the FK. [VERIFIED: migration SQL]
**How to avoid:** Truncate in dependency order — always truncate child tables before parent tables:
  1. `truncateTable(wishlists)` — child (references cards and users)
  2. `truncateTable(cards)` — parent of wishlists.card_id
  3. `truncateTable(users)` — parent of wishlists.user_id
  (Or, if only cards are seeded with no wishlist: truncate cards alone is fine.)
**Warning signs:** `update or delete on table "cards" violates foreign key constraint "wishlists_card_id_cards_oracle_id_fk"`.

### Pitfall 4: oracleId Uniqueness in Parallel Tests
**What goes wrong:** Multiple seeds in the same test use `Date.now()` as the unique oracleId suffix, and two calls within the same millisecond produce a duplicate-key error.
**Why it happens:** `oracleId: \`test-oracle-${Date.now()}\`` is only unique to the millisecond. Rapid consecutive calls can collide. [VERIFIED: reading existing test/helpers/db.ts]
**How to avoid:** When seeding multiple cards in a single test, always pass explicit `oracleId` values:
  ```typescript
  await seedTestCard({ name: 'Black Lotus', oracleId: 'test-bl-001' })
  await seedTestCard({ name: 'Lotus Petal', oracleId: 'test-lp-001' })
  ```
  For the limit-10 test, use a counter suffix pattern like `test-card-${i}`.

### Pitfall 5: FK Violation Error Code for Invalid cardId (Code 23503 vs 23505)
**What goes wrong:** `addCardToWishlist` catches error code `23505` (unique constraint) but the FK violation from a non-existent `cardId` raises code `23503` (foreign key constraint). The catch block in `addCardToWishlist` does NOT catch `23503` — it re-throws. The test assertion `rejects.toThrow()` should work because the error propagates, but the error message will be the raw PostgreSQL FK error, not `'Card already in wishlist'`.
**Why it happens:** `addCardToWishlist`'s catch only handles code `23505`. Code `23503` falls through to the final `throw error`. [VERIFIED: reading src/lib/wishlist/queries.ts lines 152–159]
**How to avoid:** The FK violation test should assert the call rejects (any error) — not assert a specific message. Example: `await expect(addCardToWishlist(1, 'non-existent')).rejects.toThrow()`.

### Pitfall 6: Biome Import Order in Test Files
**What goes wrong:** `pnpm biome check` fails after writing test file with wrong import order.
**Why it happens:** Biome `organizeImports` enforces internal `@/` imports before external imports. [VERIFIED: biome.json]
**How to avoid:** Put `@/` aliased imports first, then vitest imports:
  ```typescript
  import { searchCards } from '@/lib/cards/queries'
  import { cards } from '@/db/schema'
  import { seedTestCard, truncateTable } from '@/test/helpers/db'
  import { beforeEach, describe, expect, test } from 'vitest'
  ```
  Run `pnpm biome check --apply <file>` after writing.

---

## Code Examples

Verified patterns from codebase inspection:

### Drizzle ilike query (matches existing route handler exactly)
```typescript
// Source: src/app/api/cards/search/route.ts (verified)
import { ilike } from 'drizzle-orm'
const results = await db
  .select({
    oracleId: cards.oracleId,
    name: cards.name,
    set: cards.set,
    imageUrl: cards.imageUrl,
  })
  .from(cards)
  .where(ilike(cards.name, `%${query}%`))
  .limit(10)
```

### Drizzle delete all rows (truncation pattern)
```typescript
// Source: test/helpers/db.ts lines 23-28 (verified)
export async function truncateTable(table: any): Promise<void> {
  await db.delete(table)
}
```

### Drizzle insert returning
```typescript
// Source: test/helpers/db.ts lines 63-64 (verified)
const inserted = await db.insert(cards).values(card).returning()
return inserted[0]
```

### FK violation propagation (code 23503 falls through)
```typescript
// Source: src/lib/wishlist/queries.ts lines 145-160 (verified)
export async function addCardToWishlist(userId: number, cardId: string): Promise<void> {
  try {
    await db.insert(wishlists).values({ userId, cardId })
  } catch (error) {
    if (
      error instanceof Error &&
      (('code' in error && error.code === '23505') || error.message.includes('unique constraint'))
    ) {
      throw new Error('Card already in wishlist')
    }
    throw error  // FK violation (23503) re-throws here as-is
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Mock DB in unit tests | Real DB in integration tests | Confirms actual SQL behavior (ilike case sensitivity, FK enforcement, limit) |
| HTTP-layer tests (NextRequest) | Direct function tests | Faster, simpler assertions, no need to mock Next.js internals |

**Note:** The existing `src/lib/wishlist/__tests__/queries.test.ts` uses DB mocks (`vi.mock('@/db', ...)`). This is correct for unit tests of `addCardToWishlist`/`removeCardFromWishlist` logic (already passing, 5 tests). Phase 9's `actions.test.ts` is separate — it tests the same functions but with a REAL DB, providing integration-level confidence on top of the existing unit tests.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `wishlists` table FK violation test (`addCardToWishlist` with non-existent cardId) will produce a PostgreSQL error that propagates through the existing `throw error` path in `addCardToWishlist` | Pitfall 5 | If the function silently ignores the error, the FK test would pass vacuously — but inspection of the catch block confirms re-throw. LOW risk. |
| A2 | A test user must be seeded before `seedTestWishlist` can succeed, because `wishlists.user_id` FK references `users.id` | Pitfall 2 | If the planner omits user seeding, all wishlist tests will fail at insert time |
| A3 | `truncateTable` using `db.delete(table)` without WHERE correctly deletes all rows in PostgreSQL (not just TRUNCATE-equivalent) | Common Pitfalls | Drizzle generates `DELETE FROM "table"` which deletes all rows. Confirmed by inspecting existing test/helpers/db.ts — same pattern. LOW risk. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

1. **DATABASE_URL credentials in test/setup.ts**
   - What we know: `test/setup.ts` has `postgres:postgres`; docker-compose uses `mtgprice:mtgprice_password`.
   - What's unclear: Whether the user's local PostgreSQL accepts `postgres:postgres` via a separate setup (outside docker-compose).
   - Recommendation: The plan should include a Wave 0 task that verifies connectivity (start docker container, confirm URL matches). If the credentials are wrong, `test/setup.ts` line 6 must be updated to `postgresql://mtgprice:mtgprice_password@localhost:5432/mtgprice`.

2. **User seeding for wishlist tests**
   - What we know: `wishlists.user_id` references `users.id` with `ON DELETE no action`. `seedTestWishlist` defaults `userId: 1`.
   - What's unclear: Whether the new `src/test/helpers/db.ts` should export a `seedTestUser()` function, or whether tests should manually insert a user.
   - Recommendation: Add `seedTestUser(userData?)` to `src/test/helpers/db.ts` so that wishlist tests can call it in `beforeEach` before calling `seedTestWishlist`.

3. **`searchCards` 2-char behavior: throw vs return `[]`**
   - What we know: The route handler returns a 400 response for `query.length < 2`. The test must validate consistent behavior.
   - What's unclear: Planner's choice — either throw (test uses `rejects.toThrow()`) or return `[]` (test uses `expect(result).toEqual([])`).
   - Recommendation: **Throw an error** — this is consistent with the route handler's semantics (validation failure), and the test can mirror what the route returns for a 400: `expect(searchCards('A')).rejects.toThrow('Query must be at least 2 characters long')`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (Docker) | All integration tests | Docker available; container NOT running at research time | TimescaleDB pg16 (docker-compose) | Start with `docker compose up -d postgres` |
| Node.js | Test runner | Implicit (project runs) [ASSUMED] | 20+ | — |
| pnpm | `pnpm test:run` | Implicit (package.json uses pnpm scripts) [ASSUMED] | — | — |

**Missing dependencies with no fallback:**
- PostgreSQL container must be running for integration tests to pass. The plan must include a `docker compose up -d postgres` prerequisite step, or the user must confirm the DB is already accessible.

**Missing dependencies with fallback:**
- None — all npm packages are installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.9 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/api/__tests__/cards/search.test.ts` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-08 | Name match returns correct cards | integration | `npx vitest run src/api/__tests__/cards/search.test.ts` | Yes (5 skips to activate) |
| TEST-08 | Empty result when no matches | integration | same | Yes |
| TEST-08 | Case-insensitive search | integration | same | Yes |
| TEST-08 | Limit 10 results | integration | same | Yes |
| TEST-08 | Minimum 2 chars enforced | integration | same | Yes |
| TEST-09 | addCard inserts row | integration | `npx vitest run src/lib/wishlist/__tests__/actions.test.ts` | Yes (6 skips to activate) |
| TEST-09 | FK violation on invalid cardId | integration | same | Yes |
| TEST-09 | removeCard deletes row | integration | same | Yes |
| TEST-09 | searchCards matches by name | integration | same | Yes |
| TEST-09 | searchCards returns empty array | integration | same | Yes |
| TEST-09 | searchCards case-insensitive | integration | same | Yes |

### Sampling Rate

- **Per task commit:** `npx vitest run <relevant-test-file>`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite (`pnpm test:run`) green with 0 skips in the two target files before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/test/helpers/db.ts` — covers TEST-08 and TEST-09 seeding/cleanup (NEW FILE)
- [ ] `src/lib/cards/queries.ts` — covers TEST-08 `searchCards` function (NEW FILE)
- [ ] `src/app/api/cards/search/route.ts` — update to import from `src/lib/cards/queries.ts` (MODIFY)
- [ ] `test/setup.ts` — verify/fix `DATABASE_URL` credentials to match docker-compose (VERIFY/MODIFY)

---

## Security Domain

This phase only adds test infrastructure and extracts a DB query function. No new authentication, session management, or user-facing inputs are introduced. The `searchCards` function receives a query string from the route handler which already validates minimum length. No new attack surface.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (minimal) | 2-char minimum enforced inside `searchCards` |
| V6 Cryptography | no | — |

**Test data:** Tests use obviously fake data (`test-oracle-*`, `Black Lotus`, userId=1). No real PII or secrets in test helpers.

---

## Sources

### Primary (HIGH confidence)

- `src/api/__tests__/cards/search.test.ts` — 5 test stubs with comments, imports from `@/test/helpers/db` [VERIFIED: file read]
- `src/lib/wishlist/__tests__/actions.test.ts` — 6 test stubs, imports from `@/test/helpers/db` and `@/db` [VERIFIED: file read]
- `test/helpers/db.ts` — root-level helpers with `db`-param signatures; logic model for new file [VERIFIED: file read]
- `src/app/api/cards/search/route.ts` — complete ilike query, 2-char validation, column selection [VERIFIED: file read]
- `src/lib/wishlist/queries.ts` — `addCardToWishlist`, `removeCardFromWishlist` implementations [VERIFIED: file read]
- `src/db/schema/wishlists.ts` — FK constraints: `user_id → users.id`, `card_id → cards.oracle_id` [VERIFIED: file read]
- `drizzle/0000_watery_phantom_reporter.sql` — confirms `ON DELETE no action` for both FK constraints [VERIFIED: file read]
- `test/setup.ts` — confirms `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mtgprice` [VERIFIED: file read]
- `.env` — confirms actual DB credentials are `mtgprice:mtgprice_password` [VERIFIED: file read]
- `vitest.config.ts` — confirms `include: ['src/**/__tests__/**/*.test.ts']`, `@` alias → `src/` [VERIFIED: file read]
- `biome.json` — confirms single quotes, no semicolons, `organizeImports: enabled` [VERIFIED: file read]
- npm registry — vitest@4.1.6, drizzle-orm@0.45.2, postgres@3.4.9 are current [VERIFIED: npm view]

### Secondary (MEDIUM confidence)

- Phase 8 PLAN.md (`08-01-PLAN.md`) — confirms established patterns: `test.skip → test`, `beforeEach`/`afterEach`, Biome import ordering rules [VERIFIED: file read]

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified in package.json and npm registry
- Architecture: HIGH — all source files read and cross-referenced; FK structure confirmed in migration SQL
- Pitfalls: HIGH — derived from direct inspection of source files (credential mismatch confirmed, FK chain confirmed, error-code behavior confirmed)

**Research date:** 2026-05-13
**Valid until:** 2026-06-12 (stable stack; 30-day window)
