import { seedTestCard } from '@/test/helpers/db'
import { describe, test } from 'vitest'

describe('Card Search API endpoint', () => {
  // TODO: Implement these tests in plan 03-02 (Card autocomplete search)

  test.skip('GET /api/cards/search returns matching cards by name', async () => {
    // Given: Database has cards with names matching "Black Lotus"
    // When: GET /api/cards/search?q=Black+Lotus
    // Then: Returns array of matching cards
    // Implementation plan:
    // 1. Seed test cards: "Black Lotus", "Black Lotus (Arena)", "Lotus Petal"
    // 2. Call GET /api/cards/search?q=Black+Lotus
    // 3. Assert response contains "Black Lotus" and "Black Lotus (Arena)"
    // 4. Assert response does not contain "Lotus Petal"
  })

  test.skip('GET /api/cards/search returns empty array if no matches', async () => {
    // Given: Database has no cards matching query
    // When: GET /api/cards/search?q=NonExistentCard
    // Then: Returns empty array
    // Implementation plan:
    // 1. Ensure database has no cards matching "NonExistentCard"
    // 2. Call GET /api/cards/search?q=NonExistentCard
    // 3. Assert response.data === []
  })

  test.skip('GET /api/cards/search is case-insensitive', async () => {
    // Given: Database has card "Black Lotus"
    // When: GET /api/cards/search?q=black+lotus
    // Then: Returns "Black Lotus" (case-insensitive match)
    // Implementation plan:
    // 1. Seed test card: "Black Lotus"
    // 2. Call GET /api/cards/search?q=black+lotus (lowercase)
    // 3. Assert response contains "Black Lotus"
    // 4. Also test with "BLACK LOTUS" (uppercase)
  })

  test.skip('GET /api/cards/search limits results to 10 cards', async () => {
    // Given: Database has 20+ cards matching query
    // When: GET /api/cards/search?q=Test
    // Then: Returns maximum 10 results
    // Implementation plan:
    // 1. Seed 15 test cards with name starting with "Test"
    // 2. Call GET /api/cards/search?q=Test
    // 3. Assert response.length <= 10
    // 4. Assert results are ordered by name (ASC)
  })

  test.skip('GET /api/cards/search requires at least 2 characters', async () => {
    // Given: User searches with 1 character
    // When: GET /api/cards/search?q=A
    // Then: Returns 400 Bad Request or empty array
    // Implementation plan:
    // 1. Call GET /api/cards/search?q=A (1 char)
    // 2. Assert 400 status with error message OR empty array
    // 3. Verify single-char searches are rejected for performance
  })
})
