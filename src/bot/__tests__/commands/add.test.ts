import { db } from '@/db'
import { wishlists } from '@/db/schema/wishlists'
import { createMockContext } from '@/test/helpers/bot'
import { seedTestCard, seedTestWishlist, truncateTable } from '@/test/helpers/db'
import { describe, test } from 'vitest'

describe('/add command handler', () => {
  // TODO: Implement these tests in plan 03-04 (Bot commands)

  test.skip('adds exact match card to wishlist', async () => {
    // Given: User sends "/add Black Lotus" and exact match exists
    // When: Command handler processes the message
    // Then: Card added to wishlist, confirmation message sent
    // Implementation plan:
    // 1. Seed test card with name "Black Lotus"
    // 2. Create mock context with message.text = "/add Black Lotus"
    // 3. Call add command handler
    // 4. Assert ctx.reply called with confirmation
    // 5. Verify wishlist entry exists in database
  })

  test.skip('shows selection list for multiple matches', async () => {
    // Given: User sends "/add Black Lotus" and multiple matches exist
    // When: Command handler finds multiple cards
    // Then: Numbered list sent to user, awaiting selection
    // Implementation plan:
    // 1. Seed 3 test cards: "Black Lotus", "Black Lotus (Arena)", "Black Lotus (Beta)"
    // 2. Create mock context with message.text = "/add Black Lotus"
    // 3. Call add command handler
    // 4. Assert ctx.reply called with numbered list
    // 5. Assert message includes card names with set names for disambiguation
  })

  test.skip('handles selection from numbered list', async () => {
    // Given: Bot showed numbered list, user replies with number
    // When: Second message (number) is processed
    // Then: Selected card added to wishlist
    // Implementation plan:
    // 1. Seed 3 test cards
    // 2. First message: "/add Black" → shows list
    // 3. Second message: "2" → selects second card
    // 4. Assert wishlist has second card
    // 5. Assert confirmation message sent
  })

  test.skip('returns error if no cards found', async () => {
    // Given: User sends "/add NonExistentCard"
    // When: Command handler finds no matches
    // Then: Error message sent to user
    // Implementation plan:
    // 1. Ensure no cards match "NonExistentCard"
    // 2. Create mock context with message.text = "/add NonExistentCard"
    // 3. Call add command handler
    // 4. Assert ctx.reply called with error message
    // 5. Verify no wishlist entry created
  })

  test.skip('returns error if card already in wishlist', async () => {
    // Given: Card already exists in user's wishlist
    // When: User tries to add same card again
    // Then: Error message sent, no duplicate entry
    // Implementation plan:
    // 1. Seed test card and wishlist entry
    // 2. Create mock context with message.text = "/add Test Card"
    // 3. Call add command handler
    // 4. Assert ctx.reply called with duplicate error
    // 5. Verify no duplicate wishlist entry
  })
})
