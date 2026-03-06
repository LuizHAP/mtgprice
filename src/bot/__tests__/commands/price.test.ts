import { createMockContext } from '@/test/helpers/bot'
import { seedTestCard, seedTestPrice, seedTestPricesForAllSources } from '@/test/helpers/db'
import { describe, test } from 'vitest'

describe('/price command handler', () => {
  // TODO: Implement these tests in plan 03-04 (Bot commands)

  test.skip('shows best price for queried card', async () => {
    // Given: Card has prices from multiple sources
    // When: User sends "/price Black Lotus"
    // Then: Best price displayed with source name
    // Implementation plan:
    // 1. Seed test card: "Black Lotus"
    // 2. Seed prices from all 4 sources: 100, 105, 95, 110
    // 3. Create mock context with message.text = "/price Black Lotus"
    // 4. Call price command handler
    // 5. Assert ctx.reply shows "Black Lotus - R$ 95 (cardmarket)"
    // 6. Verify 95 is the lowest price
  })

  test.skip('aggregates prices by oracle_id', async () => {
    // Given: Card has multiple printings (same oracle_id)
    // When: User queries card by name
    // Then: Shows aggregated best price across all printings
    // Implementation plan:
    // 1. Seed 2 cards with same oracle_id but different sets: "LEA", "LEB"
    // 2. Seed prices: LEA printing has 100, LEB printing has 95
    // 3. Create mock context with message.text = "/price Black Lotus"
    // 4. Call price command handler
    // 5. Assert shows best price (95) regardless of printing
    // 6. Verify aggregation logic queries by oracle_id
  })

  test.skip('returns error if card not found', async () => {
    // Given: Card does not exist in database
    // When: User sends "/price NonExistentCard"
    // Then: Error message sent to user
    // Implementation plan:
    // 1. Ensure no cards match "NonExistentCard"
    // 2. Create mock context with message.text = "/price NonExistentCard"
    // 3. Call price command handler
    // 4. Assert ctx.reply called with "card not found" error
  })

  test.skip('handles multiple printings with exact match', async () => {
    // Given: Card has multiple printings, user queries exact name
    // When: User sends "/price Black Lotus" and "Black Lotus" exists
    // Then: Shows aggregated price for all printings
    // Implementation plan:
    // 1. Seed 3 cards: "Black Lotus" (LEA), "Black Lotus" (LEB), "Lotus Petal"
    // 2. Seed prices for each
    // 3. Create mock context with message.text = "/price Black Lotus"
    // 4. Call price command handler
    // 5. Assert shows best price across both Black Lotus printings
    // 6. Verify does not include "Lotus Petal"
  })
})
