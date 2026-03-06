import { db } from '@/db'
import { wishlists } from '@/db/schema/wishlists'
import {
  seedTestCard,
  seedTestPrice,
  seedTestPricesForAllSources,
  seedTestWishlist,
  truncateTable,
} from '@/test/helpers/db'
import { describe, test } from 'vitest'

describe('Wishlist database queries', () => {
  // TODO: Implement these tests in plans 03-01, 03-02, 03-03

  test.skip('getUserWishlist returns cards with metadata', async () => {
    // Given: User has cards in wishlist
    // When: getUserWishlist(userId) is called
    // Then: Returns array with card metadata (name, set, imageUrl)
    // Implementation plan:
    // 1. Seed test cards in wishlist for user 1
    // 2. Call getUserWishlist(1)
    // 3. Assert array length matches seeded count
    // 4. Assert each item has card.name, card.set, card.imageUrl
  })

  test.skip('getUserWishlist returns empty array if user has no cards', async () => {
    // Given: User has no cards in wishlist
    // When: getUserWishlist(userId) is called
    // Then: Returns empty array
    // Implementation plan:
    // 1. Truncate wishlists table
    // 2. Call getUserWishlist(999) (user with no wishlist)
    // 3. Assert result === []
  })

  test.skip('getLatestPricesForCard returns prices from all 4 sources', async () => {
    // Given: Card has prices from Liga Magic, TCGPlayer, CardMarket, CardKingdom
    // When: getLatestPricesForCard(oracleId) is called
    // Then: Returns object with prices from each source
    // Implementation plan:
    // 1. Seed test card
    // 2. Seed prices for all 4 sources (different timestamps)
    // 3. Call getLatestPricesForCard(card.oracleId)
    // 4. Assert result has ligaMagic, tcgplayer, cardmarket, cardkingdom keys
    // 5. Assert each value matches latest price (DESC timestamp)
  })

  test.skip('getLatestPricesForCard returns null for sources without data', async () => {
    // Given: Card only has prices from some sources
    // When: getLatestPricesForCard(oracleId) is called
    // Then: Returns null for missing sources
    // Implementation plan:
    // 1. Seed test card
    // 2. Seed prices for only 2 sources (liga_magic, tcgplayer)
    // 3. Call getLatestPricesForCard(card.oracleId)
    // 4. Assert result.ligaMagic and result.tcgplayer have values
    // 5. Assert result.cardmarket === null, result.cardkingdom === null
  })

  test.skip('findBestPrice returns lowest price across sources', async () => {
    // Given: Card has prices from all sources: 100, 105, 95, 110
    // When: findBestPrice(prices) is called
    // Then: Returns 95 (lowest price)
    // Implementation plan:
    // 1. Seed test card
    // 2. Seed prices: 100, 105, 95, 110
    // 3. Call findBestPrice(pricesObject)
    // 4. Assert returns 95
    // 5. Verify source name is also returned (cardmarket)
  })

  test.skip('calculatePriceTrend returns % change vs 7 days ago', async () => {
    // Given: Card has current price 95 and price from 7 days ago was 105
    // When: calculatePriceTrend(currentPrice, historicalPrice) is called
    // Then: Returns -9.52% (price dropped)
    // Implementation plan:
    // 1. Seed test card
    // 2. Seed price today: 95
    // 3. Seed price 7 days ago: 105
    // 4. Call calculatePriceTrend(95, 105)
    // 5. Assert returns approximately -9.52
    // 6. Test with increase (95 → 105 returns +10.53)
  })
})
