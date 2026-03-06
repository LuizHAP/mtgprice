import { db } from '@/db'
import { prices } from '@/db/schema'
import {
  calculatePriceTrend,
  getBestPrice,
  getLatestPricesForCard,
  getPriceHistory,
} from '@/lib/wishlist/queries'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/prices/[oracle_id]
 *
 * Get price comparison across all 4 sources for a specific card.
 * Returns latest prices from each source, best price, and trend vs 7 days ago.
 *
 * Public endpoint - no authentication required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ oracle_id: string }> }
) {
  try {
    const { oracle_id } = await params

    // Fetch latest prices from all 4 sources
    const latestPrices = await getLatestPricesForCard(oracle_id)

    // Check if we have any price data
    const hasAnyPrice =
      latestPrices.ligaMagic !== null ||
      latestPrices.tcgplayer !== null ||
      latestPrices.cardmarket !== null ||
      latestPrices.cardkingdom !== null

    if (!hasAnyPrice) {
      return NextResponse.json(
        { error: 'No price data found for card' },
        { status: 404 }
      )
    }

    // Find best price
    const bestPrice = getBestPrice(latestPrices)

    // Fetch price history for trend calculation
    const priceHistory = await getPriceHistory(oracle_id, 100)

    // Calculate trend (vs 7 days ago)
    let trend = null
    if (bestPrice) {
      trend = calculatePriceTrend(bestPrice.priceBrl, priceHistory)
    }

    // Return price comparison
    return NextResponse.json(
      {
        oracleId: oracle_id,
        prices: {
          ligaMagic: latestPrices.ligaMagic,
          tcgplayer: latestPrices.tcgplayer,
          cardmarket: latestPrices.cardmarket,
          cardkingdom: latestPrices.cardkingdom,
        },
        bestPrice,
        trend,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching price comparison:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price comparison' },
      { status: 500 }
    )
  }
}
