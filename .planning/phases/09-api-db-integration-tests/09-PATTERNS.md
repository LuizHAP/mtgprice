# Phase 9: API & DB Integration Tests - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 6 (3 new, 2 modified, 1 verified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/test/helpers/db.ts` | utility (test helper) | CRUD | `test/helpers/db.ts` | exact (no-param rewrite of same file) |
| `src/lib/cards/queries.ts` | service (query) | request-response | `src/lib/wishlist/queries.ts` | exact (same domain-query pattern) |
| `src/app/api/cards/search/route.ts` | middleware/route | request-response | `src/app/api/cards/search/route.ts` | self (refactor only) |
| `src/api/__tests__/cards/search.test.ts` | test | CRUD / request-response | `src/lib/wishlist/__tests__/queries.test.ts` + Phase 8 activated tests | role-match |
| `src/lib/wishlist/__tests__/actions.test.ts` | test | CRUD / event-driven | `src/lib/wishlist/__tests__/queries.test.ts` | role-match |
| `test/setup.ts` | config | — | `test/setup.ts` | self (credential fix only) |

---

## Pattern Assignments

### `src/test/helpers/db.ts` (utility, CRUD)

**Analog:** `test/helpers/db.ts` (lines 1–195)

**Analog is the direct model** — the new file is a no-`db`-param rewrite. Drop the `db: PostgresJsDatabase<any>` first parameter from every function; import `db` at module level instead.

**Imports pattern** (analog lines 1–3):
```typescript
import { db } from '@/db'
import { cards, wishlists } from '@/db/schema'
import { users } from '@/db/schema/users'
```
Note: the analog imports `cards, prices, wishlists` from `@/db/schema`; the new file adds `users` (needed for FK-safe `seedTestUser`) and omits `prices` (not needed for Phase 9).

**Core truncation pattern** (analog lines 21–28):
```typescript
// biome-ignore lint/suspicious/noExplicitAny: Test helper accepts any table
export async function truncateTable(table: any): Promise<void> {
  await db.delete(table)
}
```
Drop the `db` parameter entirely — `db` is imported at module level.

**Core seedTestCard pattern** (analog lines 47–65):
```typescript
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
  const card = { ...defaultCard, ...cardData }
  const inserted = await db.insert(cards).values(card).returning()
  return inserted[0]
}
```

**Core seedTestWishlist pattern** (analog lines 115–129):
```typescript
export async function seedTestWishlist(
  wishlistData: Partial<typeof wishlists.$inferInsert> = {},
): Promise<typeof wishlists.$inferSelect> {
  const defaultWishlist: typeof wishlists.$inferInsert = {
    userId: 1,
    cardId: `test-oracle-${Date.now()}`,
    addedAt: new Date(),
  }
  const wishlist = { ...defaultWishlist, ...wishlistData }
  const inserted = await db.insert(wishlists).values(wishlist).returning()
  return inserted[0]
}
```

**Additional function required — seedTestUser** (derived from `src/db/schema/users.ts`):
```typescript
import { users } from '@/db/schema/users'

export async function seedTestUser(
  userData: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  const defaultUser: typeof users.$inferInsert = {
    email: `test-user-${Date.now()}@example.com`,
    passwordHash: 'hashed-password',
  }
  const user = { ...defaultUser, ...userData }
  const inserted = await db.insert(users).values(user).returning()
  return inserted[0]
}
```
Required because `wishlists.user_id` references `users.id` with `ON DELETE no action` — `seedTestWishlist` will fail unless a user with the given `userId` exists. Tests that call `seedTestWishlist` must call `seedTestUser` first in `beforeEach`.

**Truncation order pattern** (critical — FK constraints):
```typescript
// Dependency order: child before parent
await truncateTable(wishlists)  // child: references cards.oracle_id AND users.id
await truncateTable(cards)       // parent of wishlists.card_id
await truncateTable(users)       // parent of wishlists.user_id
```
Source: `src/db/schema/wishlists.ts` — FK constraints confirmed (`userId → users.id`, `cardId → cards.oracleId`, both `ON DELETE no action`).

**Biome suppression comment pattern** (analog lines 22–24):
```typescript
// biome-ignore lint/suspicious/noExplicitAny: Test helper accepts any table
```
Apply to `table: any` parameter in `truncateTable` and to `db` parameter functions in the analog. In the new file, only `truncateTable`'s `table: any` needs the suppression.

---

### `src/lib/cards/queries.ts` (service/query, request-response)

**Analog:** `src/app/api/cards/search/route.ts` (lines 1–49) for the query body; `src/lib/wishlist/queries.ts` (lines 1–5, 145–160) for the module structure and exported function shape.

**Imports pattern** — compose from both analogs:
```typescript
import { db } from '@/db'
import { cards } from '@/db/schema'
import { ilike } from 'drizzle-orm'
```
Source: route handler lines 1–3 (same imports, without Next.js server imports).

**Exported type pattern** (derived from route handler lines 30–37 select shape):
```typescript
export type CardSearchResult = {
  oracleId: string
  name: string
  set: string | null
  imageUrl: string | null
}
```
Column names match `src/db/schema/cards.ts` field types exactly: `set` is `varchar | null`, `imageUrl` is `text | null`.

**Core searchCards function pattern** (extracted from route handler lines 20–41):
```typescript
export async function searchCards(query: string): Promise<CardSearchResult[]> {
  if (query.length < 2) {
    throw new Error('Query must be at least 2 characters long')
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
The `throw new Error(...)` approach is consistent with the route handler's 400 response message (`'Query must be at least 2 characters long'` — route handler line 23). The test assertion will be `rejects.toThrow('Query must be at least 2 characters long')`.

**Module structure pattern** — copy JSDoc comment block from `src/lib/wishlist/queries.ts` line 1–7 style (file-level doc comment explaining what the module exports).

---

### `src/app/api/cards/search/route.ts` (route, request-response) — MODIFY

**Current file:** `src/app/api/cards/search/route.ts` (lines 1–49)

**Change:** Replace the inline DB query (lines 29–38) with a call to `searchCards` from `src/lib/cards/queries.ts`. Retain all HTTP-level logic intact.

**Updated imports** (replace lines 1–4):
```typescript
import { searchCards } from '@/lib/cards/queries'
import { NextRequest, NextResponse } from 'next/server'
```
Drop `import { db } from '@/db'`, `import { cards } from '@/db/schema'`, `import { ilike } from 'drizzle-orm'` — these move into `queries.ts`.

**Updated GET handler core** (replace lines 20–41):
```typescript
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters long' },
        { status: 400 }
      )
    }

    const results = await searchCards(query)
    return NextResponse.json({ cards: results }, { status: 200 })
  } catch (error) {
    console.error('Error searching cards:', error)
    return NextResponse.json(
      { error: 'Failed to search cards' },
      { status: 500 }
    )
  }
}
```
Note: The handler retains its own `query.length < 2` guard (to return a proper 400 before calling `searchCards`). The `searchCards` function also guards internally (D-05) — this is intentional double protection.

---

### `src/api/__tests__/cards/search.test.ts` (test, CRUD/request-response) — MODIFY

**Current file:** `src/api/__tests__/cards/search.test.ts` (lines 1–59) — all 5 tests are `test.skip`.

**Activation pattern** — replace `test.skip(...)` with `test(...)` for all 5 cases. Pattern established in Phase 8 (`test.skip → test` in `src/scraper/__tests__/circuit-breaker.test.ts`).

**Updated imports** (replace lines 1–2):
```typescript
import { searchCards } from '@/lib/cards/queries'
import { cards } from '@/db/schema'
import { seedTestCard, truncateTable } from '@/test/helpers/db'
import { beforeEach, describe, expect, test } from 'vitest'
```
Biome import order rule: `@/` aliased imports first, then external (`vitest`). Source: RESEARCH.md Pitfall 6; confirmed by `biome.json organizeImports: enabled`.

**beforeEach truncation pattern** (apply to the describe block):
```typescript
beforeEach(async () => {
  await truncateTable(cards)
})
```
No user/wishlist tables involved in search tests — truncating `cards` only is sufficient.

**Name-match test pattern** (activate test at line 7):
```typescript
test('GET /api/cards/search returns matching cards by name', async () => {
  await seedTestCard({ name: 'Black Lotus', oracleId: 'test-bl-001' })
  await seedTestCard({ name: 'Black Lotus (Arena)', oracleId: 'test-bl-002' })
  await seedTestCard({ name: 'Lotus Petal', oracleId: 'test-lp-001' })

  const results = await searchCards('Black Lotus')

  expect(results.some((c) => c.name === 'Black Lotus')).toBe(true)
  expect(results.some((c) => c.name === 'Black Lotus (Arena)')).toBe(true)
  expect(results.some((c) => c.name === 'Lotus Petal')).toBe(false)
})
```
Use explicit `oracleId` values (not `Date.now()`) when seeding multiple cards in one test — avoids Pitfall 4 (millisecond collision).

**Empty result test pattern** (activate test at line 18):
```typescript
test('GET /api/cards/search returns empty array if no matches', async () => {
  const results = await searchCards('NonExistentXYZ123')
  expect(results).toEqual([])
})
```

**Case-insensitive test pattern** (activate test at line 28):
```typescript
test('GET /api/cards/search is case-insensitive', async () => {
  await seedTestCard({ name: 'Black Lotus', oracleId: 'test-bl-ci-001' })

  const lowerResults = await searchCards('black lotus')
  const upperResults = await searchCards('BLACK LOTUS')

  expect(lowerResults.some((c) => c.name === 'Black Lotus')).toBe(true)
  expect(upperResults.some((c) => c.name === 'Black Lotus')).toBe(true)
})
```

**Limit-10 test pattern** (activate test at line 39):
```typescript
test('GET /api/cards/search limits results to 10 cards', async () => {
  for (let i = 0; i < 15; i++) {
    await seedTestCard({ name: `Test Card ${i}`, oracleId: `test-limit-${i}` })
  }
  const results = await searchCards('Test Card')
  expect(results.length).toBeLessThanOrEqual(10)
})
```
Counter suffix `test-limit-${i}` avoids millisecond collision (Pitfall 4).

**Min-2-chars test pattern** (activate test at line 50):
```typescript
test('GET /api/cards/search requires at least 2 characters', async () => {
  await expect(searchCards('A')).rejects.toThrow('Query must be at least 2 characters long')
})
```
Uses `rejects.toThrow()` — consistent with `searchCards` throwing (not returning `[]`).

---

### `src/lib/wishlist/__tests__/actions.test.ts` (test, CRUD) — MODIFY

**Current file:** `src/lib/wishlist/__tests__/actions.test.ts` (lines 1–75) — all 6 tests are `test.skip`.

**Updated imports** (replace lines 1–4):
```typescript
import { searchCards } from '@/lib/cards/queries'
import { addCardToWishlist, removeCardFromWishlist } from '@/lib/wishlist/queries'
import { cards } from '@/db/schema'
import { wishlists } from '@/db/schema/wishlists'
import { users } from '@/db/schema/users'
import { db } from '@/db'
import { eq, and } from 'drizzle-orm'
import { seedTestCard, seedTestUser, seedTestWishlist, truncateTable } from '@/test/helpers/db'
import { beforeEach, describe, expect, test } from 'vitest'
```
Biome import order: `@/` imports first, then `drizzle-orm`, then `vitest`.

**beforeEach pattern** (critical — FK chain: wishlists → cards AND users):
```typescript
beforeEach(async () => {
  await truncateTable(wishlists)  // child first (references cards and users)
  await truncateTable(cards)       // parent of wishlists.card_id
  await truncateTable(users)       // parent of wishlists.user_id
})
```
Source: `src/db/schema/wishlists.ts` FK definitions; RESEARCH.md Pitfall 3.

**addCardToWishlist insert test pattern** (activate test at line 9):
```typescript
test('addCardToWishlist inserts into wishlist table', async () => {
  const user = await seedTestUser()
  const card = await seedTestCard({ oracleId: 'test-add-card-001' })

  await addCardToWishlist(user.id, card.oracleId)

  const rows = await db
    .select()
    .from(wishlists)
    .where(and(eq(wishlists.userId, user.id), eq(wishlists.cardId, card.oracleId)))

  expect(rows.length).toBe(1)
  expect(rows[0].userId).toBe(user.id)
  expect(rows[0].cardId).toBe(card.oracleId)
})
```
Seeds a user first (Pitfall 2 — FK `wishlists.user_id → users.id`).

**FK violation test pattern** (activate test at line 21):
```typescript
test('addCardToWishlist throws if card_id invalid', async () => {
  const user = await seedTestUser()
  await expect(addCardToWishlist(user.id, 'non-existent-oracle-id')).rejects.toThrow()
})
```
Asserts any throw — NOT a specific message. FK violation (code 23503) re-throws as raw PostgreSQL error from `addCardToWishlist` lines 151–159 (the catch only handles code 23505). Source: `src/lib/wishlist/queries.ts` lines 145–160.

**removeCardFromWishlist test pattern** (activate test at line 31):
```typescript
test('removeCardFromWishlist deletes from wishlist table', async () => {
  const user = await seedTestUser()
  const card = await seedTestCard({ oracleId: 'test-remove-card-001' })
  await seedTestWishlist({ userId: user.id, cardId: card.oracleId })

  await removeCardFromWishlist(user.id, card.oracleId)

  const rows = await db
    .select()
    .from(wishlists)
    .where(and(eq(wishlists.userId, user.id), eq(wishlists.cardId, card.oracleId)))

  expect(rows.length).toBe(0)
})
```

**searchCards name-match test pattern** (activate test at line 42):
```typescript
test('searchCards queries cards table by name', async () => {
  await seedTestCard({ name: 'Black Lotus', oracleId: 'test-sc-bl-001' })
  await seedTestCard({ name: 'Black Knight', oracleId: 'test-sc-bk-001' })
  await seedTestCard({ name: 'White Knight', oracleId: 'test-sc-wk-001' })

  const results = await searchCards('Black')

  expect(results.some((c) => c.name === 'Black Lotus')).toBe(true)
  expect(results.some((c) => c.name === 'Black Knight')).toBe(true)
  expect(results.some((c) => c.name === 'White Knight')).toBe(false)
})
```

**searchCards empty result test pattern** (activate test at line 55):
```typescript
test('searchCards returns empty array if no matches', async () => {
  const results = await searchCards('NonExistentXYZ')
  expect(results).toEqual([])
})
```

**searchCards case-insensitive test pattern** (activate test at line 65):
```typescript
test('searchCards is case-insensitive', async () => {
  await seedTestCard({ name: 'Black Lotus', oracleId: 'test-sc-ci-001' })

  const lower = await searchCards('black lotus')
  const upper = await searchCards('BLACK LOTUS')

  expect(lower.some((c) => c.name === 'Black Lotus')).toBe(true)
  expect(upper.some((c) => c.name === 'Black Lotus')).toBe(true)
})
```

---

### `test/setup.ts` (config) — VERIFY/MODIFY

**Current file:** `test/setup.ts` line 6:
```typescript
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/mtgprice'
```

**Required check:** Compare against `docker-compose.yml` credentials. RESEARCH.md confirms the Docker service uses `mtgprice:mtgprice_password`. If the user's local PostgreSQL does not accept `postgres:postgres`, update line 6 to:
```typescript
process.env.DATABASE_URL = 'postgresql://mtgprice:mtgprice_password@localhost:5432/mtgprice'
```
This is a Wave 0 prerequisite — all integration tests fail without a working `DATABASE_URL`. No other lines in `test/setup.ts` require modification.

---

## Shared Patterns

### DB client import (singleton)
**Source:** `src/db/index.ts` lines 1–13; used in all query and helper files
**Apply to:** `src/test/helpers/db.ts`, `src/lib/cards/queries.ts`
```typescript
import { db } from '@/db'
```
The `db` export is a Drizzle singleton — import once per module, call directly without passing as parameter (D-01/D-02 requirement).

### Drizzle insert + returning
**Source:** `test/helpers/db.ts` lines 62–64
**Apply to:** `src/test/helpers/db.ts` (all `seed*` functions)
```typescript
const inserted = await db.insert(table).values(data).returning()
return inserted[0]
```

### Drizzle ilike query
**Source:** `src/app/api/cards/search/route.ts` lines 29–38
**Apply to:** `src/lib/cards/queries.ts` `searchCards` function
```typescript
return db
  .select({ oracleId: cards.oracleId, name: cards.name, set: cards.set, imageUrl: cards.imageUrl })
  .from(cards)
  .where(ilike(cards.name, `%${query}%`))
  .limit(10)
```

### Drizzle delete-all (truncation)
**Source:** `test/helpers/db.ts` lines 26–28
**Apply to:** `src/test/helpers/db.ts` `truncateTable`
```typescript
await db.delete(table)
```
Drizzle `.delete(table)` without `.where()` generates `DELETE FROM "table"` — removes all rows. No raw SQL TRUNCATE needed.

### Biome import ordering
**Source:** RESEARCH.md Pitfall 6; `biome.json organizeImports: enabled`
**Apply to:** All new/modified test files
```
// Order: @/ aliased imports first, then external packages
import { searchCards } from '@/lib/cards/queries'
import { cards } from '@/db/schema'
import { seedTestCard, truncateTable } from '@/test/helpers/db'
import { beforeEach, describe, expect, test } from 'vitest'
```

### beforeEach truncation (integration test isolation)
**Source:** RESEARCH.md Pattern 3 (D-12); Pitfall 3 (FK order)
**Apply to:** Both test files
```typescript
// Always truncate child tables before parent tables (FK order)
beforeEach(async () => {
  await truncateTable(wishlists)  // child
  await truncateTable(cards)       // parent of wishlists.card_id
  await truncateTable(users)       // parent of wishlists.user_id
})
// For search-only tests (no wishlists):
beforeEach(async () => {
  await truncateTable(cards)
})
```

### Explicit oracleId in multi-seed tests
**Source:** RESEARCH.md Pitfall 4
**Apply to:** All test bodies that seed more than one card
```typescript
// Always pass explicit oracleId when seeding multiple cards in one test
await seedTestCard({ name: 'Black Lotus', oracleId: 'test-bl-001' })
await seedTestCard({ name: 'Lotus Petal', oracleId: 'test-lp-001' })
// For bulk seeding: use a counter suffix
for (let i = 0; i < 15; i++) {
  await seedTestCard({ name: `Test Card ${i}`, oracleId: `test-limit-${i}` })
}
```

---

## No Analog Found

All files in Phase 9 have close analogs in the codebase. No entries.

---

## Metadata

**Analog search scope:** `test/helpers/`, `src/app/api/`, `src/lib/wishlist/`, `src/lib/opportunities/`, `src/db/schema/`, `src/api/__tests__/`, `test/setup.ts`, `vitest.config.ts`
**Files scanned:** 14
**Pattern extraction date:** 2026-05-13
