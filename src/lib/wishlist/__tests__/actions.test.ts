import { db } from '@/db'
import { cards } from '@/db/schema'
import { users } from '@/db/schema/users'
import { wishlists } from '@/db/schema/wishlists'
import { searchCards } from '@/lib/cards/queries'
import { addCardToWishlist, removeCardFromWishlist } from '@/lib/wishlist/queries'
import { seedTestCard, seedTestUser, seedTestWishlist, truncateTable } from '@/test/helpers/db'
import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, test } from 'vitest'

describe('Wishlist server actions', () => {
  beforeEach(async () => {
    await truncateTable(wishlists) // child: references cards AND users
    await truncateTable(cards) // parent of wishlists.card_id
    await truncateTable(users) // parent of wishlists.user_id
  })

  test('addCardToWishlist inserts into wishlist table', async () => {
    const user = await seedTestUser()
    const card = await seedTestCard({ oracleId: 'test-add-card-001' })

    await addCardToWishlist(user.id, card.oracleId)

    const rows = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, user.id), eq(wishlists.cardId, card.oracleId)))

    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBe(user.id)
    expect(rows[0].cardId).toBe(card.oracleId)
  })

  test('addCardToWishlist throws if card_id invalid', async () => {
    const user = await seedTestUser()
    await expect(addCardToWishlist(user.id, 'non-existent-oracle-id')).rejects.toThrow()
  })

  test('removeCardFromWishlist deletes from wishlist table', async () => {
    const user = await seedTestUser()
    const card = await seedTestCard({ oracleId: 'test-remove-card-001' })
    await seedTestWishlist({ userId: user.id, cardId: card.oracleId })

    await removeCardFromWishlist(user.id, card.oracleId)

    const rows = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, user.id), eq(wishlists.cardId, card.oracleId)))

    expect(rows).toHaveLength(0)
  })

  test('searchCards queries cards table by name', async () => {
    await seedTestCard({ name: 'Black Lotus', oracleId: 'test-sc-bl-001' })
    await seedTestCard({ name: 'Black Knight', oracleId: 'test-sc-bk-001' })
    await seedTestCard({ name: 'White Knight', oracleId: 'test-sc-wk-001' })

    const results = await searchCards('Black')

    expect(results.some((c) => c.name === 'Black Lotus')).toBe(true)
    expect(results.some((c) => c.name === 'Black Knight')).toBe(true)
    expect(results.some((c) => c.name === 'White Knight')).toBe(false)
  })

  test('searchCards returns empty array if no matches', async () => {
    const results = await searchCards('NonExistentXYZ')
    expect(results).toEqual([])
  })

  test('searchCards is case-insensitive', async () => {
    await seedTestCard({ name: 'Black Lotus', oracleId: 'test-sc-ci-001' })

    const lower = await searchCards('black lotus')
    const upper = await searchCards('BLACK LOTUS')

    expect(lower.some((c) => c.name === 'Black Lotus')).toBe(true)
    expect(upper.some((c) => c.name === 'Black Lotus')).toBe(true)
  })
})
