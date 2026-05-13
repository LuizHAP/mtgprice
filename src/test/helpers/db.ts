import { db } from '@/db'
import { cards, users, wishlists } from '@/db/schema'

/**
 * Database test helpers for seeding and truncating test data.
 * This module-level db singleton (no db parameter) is the canonical
 * no-param variant used by Phase 9 integration tests (D-01, D-02).
 *
 * IMPORTANT: The root-level test/helpers/db.ts (db-param signatures)
 * must NOT be modified — it serves other test files (D-03).
 */

/**
 * Seeds a test user into the users table.
 *
 * Uses a unique email per call (Date.now + random suffix) to avoid
 * colliding with the users.email unique constraint when seeding
 * multiple users without an email override.
 *
 * @param userData - Optional partial user data to override defaults
 * @returns The inserted user row
 */
export async function seedTestUser(
  userData: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  const defaults: typeof users.$inferInsert = {
    email: `test-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    passwordHash: 'hashed-password',
  }
  const inserted = await db
    .insert(users)
    .values({ ...defaults, ...userData })
    .returning()
  return inserted[0]
}

/**
 * Seeds a test card into the cards table.
 *
 * @param cardData - Optional partial card data to override defaults
 * @returns The inserted card row
 */
export async function seedTestCard(
  cardData: Partial<typeof cards.$inferInsert> = {},
): Promise<typeof cards.$inferSelect> {
  const defaults: typeof cards.$inferInsert = {
    oracleId: `test-oracle-${Date.now()}`,
    name: 'Test Card',
    set: 'TST',
    rarity: 'common',
    color: 'R',
    imageUrl: 'https://example.com/card.jpg',
    lastFetched: new Date(),
  }
  const inserted = await db
    .insert(cards)
    .values({ ...defaults, ...cardData })
    .returning()
  return inserted[0]
}

/**
 * Seeds a test wishlist entry into the wishlists table.
 *
 * NOTE: wishlists.user_id references users.id (ON DELETE no action).
 * The caller must ensure a user with the given userId exists before
 * calling this function, or pass a valid userId override. Default
 * userId=1 will FK-fail unless a user with id=1 has been seeded first.
 *
 * wishlists also has a unique('uniqueUserCard') constraint on (userId, cardId).
 * Ensure each (userId, cardId) combination is unique across calls.
 *
 * @param wishlistData - Optional partial wishlist data to override defaults
 * @returns The inserted wishlist row
 */
export async function seedTestWishlist(
  wishlistData: Partial<typeof wishlists.$inferInsert> = {},
): Promise<typeof wishlists.$inferSelect> {
  const defaults: typeof wishlists.$inferInsert = {
    userId: 1,
    cardId: `test-oracle-${Date.now()}`,
    addedAt: new Date(),
  }
  const inserted = await db
    .insert(wishlists)
    .values({ ...defaults, ...wishlistData })
    .returning()
  return inserted[0]
}

/**
 * Truncates a table by deleting all rows.
 *
 * Uses Drizzle's db.delete(table) (no WHERE clause) — equivalent to TRUNCATE
 * but compatible with Drizzle's query builder.
 *
 * Truncation order matters when using multiple helpers together.
 * Delete child tables before parent tables (wishlists → cards/users)
 * to avoid FK constraint violations.
 *
 * @param table - Drizzle table schema object
 */
export async function truncateTable(
  // biome-ignore lint/suspicious/noExplicitAny: Test helper accepts any table
  table: any,
): Promise<void> {
  await db.delete(table)
}
