import { db } from '@/db'
import { cards } from '@/db/schema/cards'
import { prices } from '@/db/schema/prices'
import { wishlists } from '@/db/schema/wishlists'
import type { NewCard, NewPrice, NewWishlist } from '@/db/schema'

/**
 * Database test helpers for seeding and truncating test data
 */

/**
 * Truncates a table to clear all rows for test isolation
 *
 * @param tableName - The table to truncate (use with Drizzle schema)
 *
 * @example
 * ```ts
 * import { wishlists } from '@/db/schema/wishlists'
 * await truncateTable(db, wishlists)
 * ```
 */
export async function truncateTable(db: any, table: any): Promise<void> {
  await db.delete(table)
}

/**
 * Seeds a test card into the cards table
 *
 * @param cardData - Partial card data (defaults provided for required fields)
 * @returns The inserted card
 *
 * @example
 * ```ts
 * const card = await seedTestCard(db, {
 *   oracleId: '123abc',
 *   name: 'Black Lotus',
 *   set: 'LEA',
 *   rarity: 'rare'
 * })
 * ```
 */
export async function seedTestCard(
  db: any,
  cardData: Partial<NewCard> = {},
): Promise<any> {
  const defaultCard: NewCard = {
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

/**
 * Seeds a test price into the prices table
 *
 * @param priceData - Partial price data (defaults provided for required fields)
 * @returns The inserted price
 *
 * @example
 * ```ts
 * const price = await seedTestPrice(db, {
 *   cardId: '123abc',
 *   source: 'liga_magic',
 *   priceBrl: 100.50
 * })
 * ```
 */
export async function seedTestPrice(
  db: any,
  priceData: Partial<NewPrice> = {},
): Promise<any> {
  const defaultPrice: NewPrice = {
    cardId: `test-oracle-${Date.now()}`,
    source: 'liga_magic',
    priceBrl: 100.0,
    timestamp: new Date(),
  }

  const price = { ...defaultPrice, ...priceData }
  const inserted = await db.insert(prices).values(price).returning()
  return inserted[0]
}

/**
 * Seeds a test wishlist entry into the wishlists table
 *
 * @param wishlistData - Partial wishlist data (defaults provided for required fields)
 * @returns The inserted wishlist entry
 *
 * @example
 * ```ts
 * const wishlist = await seedTestWishlist(db, {
 *   userId: 1,
 *   cardId: '123abc'
 * })
 * ```
 */
export async function seedTestWishlist(
  db: any,
  wishlistData: Partial<NewWishlist> = {},
): Promise<any> {
  const defaultWishlist: NewWishlist = {
    userId: 1,
    cardId: `test-oracle-${Date.now()}`,
    addedAt: new Date(),
  }

  const wishlist = { ...defaultWishlist, ...wishlistData }
  const inserted = await db.insert(wishlists).values(wishlist).returning()
  return inserted[0]
}

/**
 * Seeds multiple test cards for bulk operations
 *
 * @param count - Number of cards to create
 * @param overrides - Optional partial data to apply to all cards
 * @returns Array of inserted cards
 *
 * @example
 * ```ts
 * const cards = await seedTestCards(db, 10, { set: 'LEA' })
 * ```
 */
export async function seedTestCards(
  db: any,
  count: number,
  overrides: Partial<NewCard> = {},
): Promise<any[]> {
  const cardsPromises = Array.from({ length: count }, (_, i) =>
    seedTestCard(db, {
      name: `Test Card ${i}`,
      oracleId: `test-oracle-${Date.now()}-${i}`,
      ...overrides,
    }),
  )

  return Promise.all(cardsPromises)
}

/**
 * Seeds multiple test prices for a single card across all sources
 *
 * @param cardId - The card ID to create prices for
 * @param basePrice - Base price in BRL (varied slightly per source)
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns Array of inserted prices (4 sources)
 *
 * @example
 * ```ts
 * const prices = await seedTestPricesForAllSources(db, '123abc', 100.0)
 * ```
 */
export async function seedTestPricesForAllSources(
  db: any,
  cardId: string,
  basePrice: number,
  timestamp: Date = new Date(),
): Promise<any[]> {
  const sources = ['liga_magic', 'tcgplayer', 'cardmarket', 'cardkingdom'] as const
  const priceVariations = [0, 0.05, -0.03, 0.02] // Small variations per source

  const pricesPromises = sources.map((source, i) =>
    seedTestPrice(db, {
      cardId,
      source,
      priceBrl: basePrice * (1 + priceVariations[i]),
      timestamp,
    }),
  )

  return Promise.all(pricesPromises)
}
