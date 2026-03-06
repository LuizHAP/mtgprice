import { db } from '@/db'
import { wishlists } from '@/db/schema/wishlists'
import { createTestToken } from '@/test/helpers/auth'
import { seedTestCard, seedTestPrice, seedTestWishlist, truncateTable } from '@/test/helpers/db'
import { describe, test } from 'vitest'

describe('Wishlist API endpoints', () => {
  // TODO: Implement these tests in plan 03-01 (Wishlist CRUD operations)

  test.skip("GET /api/wishlist returns user's wishlist with cards and prices", async () => {
    // Given: User has cards in wishlist with latest prices
    // When: GET /api/wishlist is called with valid auth
    // Then: Returns 200 with array of wishlist items including card metadata and prices
    // Implementation plan:
    // 1. Create test user token
    // 2. Seed test cards and wishlist entries
    // 3. Seed latest prices for each card
    // 4. Call GET /api/wishlist with Authorization header
    // 5. Assert response contains wishlist with card.name, card.imageUrl, prices from all sources
  })

  test.skip('GET /api/wishlist returns empty array if no cards', async () => {
    // Given: User has no cards in wishlist
    // When: GET /api/wishlist is called
    // Then: Returns 200 with empty array
    // Implementation plan:
    // 1. Truncate wishlists table for clean state
    // 2. Create test user token
    // 3. Call GET /api/wishlist
    // 4. Assert response.data === []
  })

  test.skip('POST /api/wishlist adds card to wishlist', async () => {
    // Given: Card exists in database but not in user's wishlist
    // When: POST /api/wishlist with card_id in body
    // Then: Returns 201, card added to wishlist
    // Implementation plan:
    // 1. Create test user token
    // 2. Seed test card (not in wishlist yet)
    // 3. Call POST /api/wishlist with { cardId: card.oracleId }
    // 4. Assert 201 status
    // 5. Verify wishlist table has new entry
  })

  test.skip('POST /api/wishlist returns 409 if card already in wishlist', async () => {
    // Given: Card already exists in user's wishlist
    // When: POST /api/wishlist with same card_id
    // Then: Returns 409 Conflict with error message
    // Implementation plan:
    // 1. Create test user token
    // 2. Seed test card and wishlist entry
    // 3. Call POST /api/wishlist with same cardId
    // 4. Assert 409 status
    // 5. Assert error message about duplicate
  })

  test.skip('POST /api/wishlist returns 401 if not authenticated', async () => {
    // Given: No auth token provided
    // When: POST /api/wishlist
    // Then: Returns 401 Unauthorized
    // Implementation plan:
    // 1. Call POST /api/wishlist without Authorization header
    // 2. Assert 401 status
    // 3. Assert error message about authentication
  })

  test.skip('DELETE /api/wishlist/[card_id] removes card from wishlist', async () => {
    // Given: Card exists in user's wishlist
    // When: DELETE /api/wishlist/[card_id]
    // Then: Returns 204, card removed from wishlist
    // Implementation plan:
    // 1. Create test user token
    // 2. Seed test card and wishlist entry
    // 3. Call DELETE /api/wishlist/[cardId]
    // 4. Assert 204 status
    // 5. Verify wishlist table no longer has entry
  })

  test.skip('DELETE /api/wishlist/[card_id] returns 404 if card not in wishlist', async () => {
    // Given: Card exists but not in user's wishlist
    // When: DELETE /api/wishlist/[card_id]
    // Then: Returns 404 Not Found
    // Implementation plan:
    // 1. Create test user token
    // 2. Seed test card (but not in wishlist)
    // 3. Call DELETE /api/wishlist/[cardId]
    // 4. Assert 404 status
    // 5. Assert error message about card not found
  })
})
