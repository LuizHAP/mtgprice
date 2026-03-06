import { db } from '@/db'
import { wishlists } from '@/db/schema/wishlists'
import { createMockContext } from '@/test/helpers/bot'
import { seedTestCard, seedTestWishlist, truncateTable } from '@/test/helpers/db'
import { describe, test } from 'vitest'

describe('/remove command handler', () => {
  // TODO: Implement these tests in plan 03-04 (Bot commands)

  test.skip('removes card by exact name', async () => {
    // Given: User has "Black Lotus" in wishlist
    // When: User sends "/remove Black Lotus"
    // Then: Card removed from wishlist, confirmation sent
    // Implementation plan:
    // 1. Seed test card and wishlist entry
    // 2. Create mock context with message.text = "/remove Black Lotus"
    // 3. Call remove command handler
    // 4. Assert ctx.reply called with confirmation
    // 5. Verify wishlist entry deleted from database
  })

  test.skip('removes card by index number', async () => {
    // Given: User has wishlist with 3 cards, /list showed numbered list
    // When: User sends "/remove 2" (remove 2nd card)
    // Then: Second card removed, confirmation sent
    // Implementation plan:
    // 1. Seed 3 test cards in wishlist
    // 2. Create mock context with message.text = "/remove 2"
    // 3. Call remove command handler with index parsing
    // 4. Assert second card removed
    // 5. Assert other cards remain in wishlist
  })

  test.skip('returns error if card not in wishlist', async () => {
    // Given: Card exists but not in user's wishlist
    // When: User sends "/remove NotInWishlist"
    // Then: Error message sent to user
    // Implementation plan:
    // 1. Seed test card (but NOT in wishlist)
    // 2. Create mock context with message.text = "/remove NotInWishlist"
    // 3. Call remove command handler
    // 4. Assert ctx.reply called with "not found" error
    // 5. Verify database unchanged
  })

  test.skip('returns error for invalid index number', async () => {
    // Given: User has 3 cards in wishlist
    // When: User sends "/remove 99" (out of range)
    // Then: Error message about invalid index
    // Implementation plan:
    // 1. Seed 3 test cards in wishlist
    // 2. Create mock context with message.text = "/remove 99"
    // 3. Call remove command handler
    // 4. Assert ctx.reply called with "invalid index" error
    // 5. Verify no cards removed
  })
})
