import { db } from '@/db'
import { cards, prices, wishlists } from '@/db/schema'
import type { BestPrice, PriceTrend } from '@/types/wishlist'
import { and, desc, eq } from 'drizzle-orm'

/**
 * Get latest prices from all 4 sources for a specific card
 *
 * @param cardId - Oracle ID of the card
 * @returns Object with latest prices from each source (null if no price available)
 */
export async function getLatestPricesForCard(cardId: string): Promise<{
  ligaMagic: number | null
  tcgplayer: number | null
  cardmarket: number | null
  cardkingdom: number | null
}> {
  const sources = ['liga_magic', 'tcgplayer', 'cardmarket', 'cardkingdom'] as const

  const pricePromises = sources.map(async (source) => {
    const result = await db
      .select()
      .from(prices)
      .where(and(eq(prices.cardId, cardId), eq(prices.source, source)))
      .orderBy(desc(prices.timestamp))
      .limit(1)

    return {
      source,
      price: result[0]?.priceBrl ? Number(result[0].priceBrl) : null,
    }
  })

  const results = await Promise.all(pricePromises)

  return {
    ligaMagic: results[0]?.price ?? null,
    tcgplayer: results[1]?.price ?? null,
    cardmarket: results[2]?.price ?? null,
    cardkingdom: results[3]?.price ?? null,
  }
}

/**
 * Find the lowest price across all sources
 *
 * @param prices - Object with prices from all 4 sources
 * @returns Best price with source name, or null if no prices available
 */
export function getBestPrice(prices: {
  ligaMagic: number | null
  tcgplayer: number | null
  cardmarket: number | null
  cardkingdom: number | null
}): BestPrice | null {
  const sourceMap = {
    ligaMagic: 'Liga Magic',
    tcgplayer: 'TCGPlayer',
    cardmarket: 'CardMarket',
    cardkingdom: 'CardKingdom',
  }

  const validPrices = Object.entries(prices)
    .filter(([_, price]) => price !== null)
    .map(([source, price]) => ({
      source: sourceMap[source as keyof typeof sourceMap],
      priceBrl: price as number,
    }))

  if (validPrices.length === 0) {
    return null
  }

  return validPrices.reduce((best, current) => (current.priceBrl < best.priceBrl ? current : best))
}

/**
 * Calculate price trend vs 7 days ago
 *
 * @param currentPrice - Current price in BRL
 * @param priceHistory - Array of historical price records
 * @returns Price trend with direction and percentage change
 */
export function calculatePriceTrend(
  currentPrice: number,
  priceHistory: Array<{ timestamp: Date; priceBrl: string | null }>,
): PriceTrend {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const tolerance = 6 * 60 * 60 * 1000 // 6 hours tolerance

  // Find price from 7 days ago (±6 hours)
  const oldPriceEntry = priceHistory.find((entry) => {
    const entryTime = new Date(entry.timestamp).getTime()
    const targetTime = sevenDaysAgo.getTime()
    const diff = Math.abs(entryTime - targetTime)
    return diff <= tolerance && entry.priceBrl !== null
  })

  if (!oldPriceEntry || !oldPriceEntry.priceBrl) {
    return { trend: 'stable', percentChange: null }
  }

  const oldPrice = Number(oldPriceEntry.priceBrl)
  const percentChange = ((currentPrice - oldPrice) / oldPrice) * 100

  let trend: 'up' | 'down' | 'stable'
  if (Math.abs(percentChange) < 1) {
    trend = 'stable'
  } else if (percentChange > 0) {
    trend = 'up'
  } else {
    trend = 'down'
  }

  return { trend, percentChange: Math.round(percentChange * 100) / 100 }
}

/**
 * Get user's wishlist with card metadata
 */
export async function getUserWishlist(userId: number) {
  return db
    .select({
      oracleId: cards.oracleId,
      name: cards.name,
      set: cards.set,
      rarity: cards.rarity,
      color: cards.color,
      imageUrl: cards.imageUrl,
      addedAt: wishlists.addedAt,
    })
    .from(wishlists)
    .innerJoin(cards, eq(wishlists.cardId, cards.oracleId))
    .where(eq(wishlists.userId, userId))
    .orderBy(desc(wishlists.addedAt))
}

/**
 * Add card to wishlist
 *
 * @param userId - User ID to add card for
 * @param cardId - Oracle ID of the card to add
 * @throws Error if card already in wishlist (PostgreSQL error code 23505)
 */
export async function addCardToWishlist(userId: number, cardId: string): Promise<void> {
  try {
    await db.insert(wishlists).values({
      userId,
      cardId,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (('code' in error && error.code === '23505') || error.message.includes('unique constraint'))
    ) {
      throw new Error('Card already in wishlist')
    }
    throw error
  }
}

/**
 * Remove card from wishlist
 *
 * @param userId - User ID to remove card for
 * @param cardId - Oracle ID of the card to remove
 * @throws Error if card not in wishlist (0 rows affected)
 */
export async function removeCardFromWishlist(userId: number, cardId: string): Promise<void> {
  const result = await db
    .delete(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.cardId, cardId)))
    .returning()

  if (result.length === 0) {
    throw new Error('Card not in wishlist')
  }
}

/**
 * Get price history for trend calculation
 */
export async function getPriceHistory(cardId: string, limit = 100) {
  return db
    .select()
    .from(prices)
    .where(eq(prices.cardId, cardId))
    .orderBy(desc(prices.timestamp))
    .limit(limit)
}
