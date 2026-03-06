import { db } from '@/db'
import { wishlists } from '@/db/schema/wishlists'
import { seedTestCard, seedTestWishlist, truncateTable } from '@/test/helpers/db'
import { describe, test } from 'vitest'

describe('Wishlist server actions', () => {
  // TODO: Implement these tests in plans 03-01, 03-02

  test.skip('addCardToWishlist inserts into wishlist table', async () => {
    // Given: Valid userId and cardId
    // When: addCardToWishlist(userId, cardId) is called
    // Then: New entry created in wishlists table
    // Implementation plan:
    // 1. Seed test card
    // 2. Call addCardToWishlist(1, card.oracleId)
    // 3. Query wishlists table for new entry
    // 4. Assert entry exists with userId=1, cardId=card.oracleId
    // 5. Assert addedAt timestamp is recent
  })

  test.skip('addCardToWishlist throws if card_id invalid', async () => {
    // Given: cardId does not exist in cards table
    // When: addCardToWishlist(userId, invalidCardId) is called
    // Then: Throws error about foreign key constraint
    // Implementation plan:
    // 1. Call addCardToWishlist(1, 'non-existent-oracle-id')
    // 2. Assert throws error
    // 3. Assert error message mentions foreign key or invalid card
  })

  test.skip('removeCardFromWishlist deletes from wishlist table', async () => {
    // Given: Card exists in user's wishlist
    // When: removeCardFromWishlist(userId, cardId) is called
    // Then: Entry deleted from wishlists table
    // Implementation plan:
    // 1. Seed test card and wishlist entry
    // 2. Call removeCardFromWishlist(1, card.oracleId)
    // 3. Query wishlists table for entry
    // 4. Assert entry no longer exists
  })

  test.skip('searchCards queries cards table by name', async () => {
    // Given: Database has cards with various names
    // When: searchCards('Black') is called
    // Then: Returns cards matching "Black" in name
    // Implementation plan:
    // 1. Seed test cards: "Black Lotus", "Black Knight", "White Knight"
    // 2. Call searchCards('Black')
    // 3. Assert results include "Black Lotus" and "Black Knight"
    // 4. Assert results do not include "White Knight"
    // 5. Assert results limited to 10 cards
    // 6. Assert results ordered by name ASC
  })

  test.skip('searchCards returns empty array if no matches', async () => {
    // Given: Database has no cards matching query
    // When: searchCards('NonExistent') is called
    // Then: Returns empty array
    // Implementation plan:
    // 1. Ensure no cards match "NonExistentXYZ"
    // 2. Call searchCards('NonExistentXYZ')
    // 3. Assert returns []
  })

  test.skip('searchCards is case-insensitive', async () => {
    // Given: Database has card "Black Lotus"
    // When: searchCards('black lotus') is called (lowercase)
    // Then: Returns "Black Lotus" (case-insensitive match)
    // Implementation plan:
    // 1. Seed test card: "Black Lotus"
    // 2. Call searchCards('black lotus')
    // 3. Assert results include "Black Lotus"
    // 4. Also test with "BLACK LOTUS" (uppercase)
  })
})
