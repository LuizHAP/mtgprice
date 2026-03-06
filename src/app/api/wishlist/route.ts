/**
 * Wishlist API endpoints
 *
 * GET /api/wishlist - Get user's wishlist with prices
 * POST /api/wishlist - Add card to wishlist
 *
 * Both endpoints require authentication via JWT token in httpOnly cookie.
 */

import { getServerUser } from '@/lib/auth-server'
import {
  addCardToWishlist,
  calculatePriceTrend,
  getBestPrice,
  getLatestPricesForCard,
  getPriceHistory,
  getUserWishlist,
} from '@/lib/wishlist/queries'
import { validateAddCard } from '@/lib/wishlist/validators'
import { NextResponse } from 'next/server'

/**
 * GET handler - Retrieve user's wishlist with latest prices
 *
 * Returns all cards in the user's wishlist with:
 * - Card metadata (name, set, image, etc.)
 * - Latest prices from all 4 sources
 * - Best price calculation
 * - Price trend vs 7 days ago
 *
 * @returns JSON response with wishlist items or empty array
 * @returns 401 if not authenticated
 * @returns 500 on server errors
 *
 * @example
 * ```ts
 * GET /api/wishlist
 * // Returns: { items: [{ oracleId, name, prices, bestPrice, priceTrend }, ...] }
 * ```
 */
export async function GET() {
  try {
    // Authenticate user
    const user = await getServerUser()

    // Fetch wishlist with card metadata
    const wishlist = await getUserWishlist(user.userId)

    // Enrich each item with latest prices
    const enrichedWishlist = await Promise.all(
      wishlist.map(async (item) => {
        // Get latest prices from all 4 sources
        const prices = await getLatestPricesForCard(item.oracleId)

        // Calculate best price
        const bestPrice = getBestPrice(prices)

        // Calculate price trend (using ligaMagic as reference if available)
        let priceTrend: { trend: 'up' | 'down' | 'stable'; percentChange: number | null } = {
          trend: 'stable',
          percentChange: null,
        }
        if (prices.ligaMagic) {
          const priceHistory = await getPriceHistory(item.oracleId, 100)
          priceTrend = calculatePriceTrend(prices.ligaMagic, priceHistory)
        }

        return {
          ...item,
          prices,
          bestPrice,
          priceTrend,
        }
      }),
    )

    return NextResponse.json({ items: enrichedWishlist }, { status: 200 })
  } catch (error) {
    // Check if it's an authentication error
    if (
      error instanceof Error &&
      (error.message === 'Not authenticated' || error.message === 'Invalid token')
    ) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('Error fetching wishlist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST handler - Add card to wishlist
 *
 * Adds a card to the authenticated user's wishlist.
 * Validates cardId using Zod schema.
 * Returns 409 if card already exists in wishlist.
 *
 * @returns JSON response with success confirmation
 * @returns 400 if validation fails
 * @returns 401 if not authenticated
 * @returns 409 if card already in wishlist
 * @returns 500 on server errors
 *
 * @example
 * ```ts
 * POST /api/wishlist
 * Body: { cardId: "abc123" }
 * // Returns: { success: true, cardId: "abc123" }
 * ```
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await getServerUser()

    // Parse request body
    const body = await request.json()

    // Validate input
    const { cardId } = validateAddCard(body)

    // Add to wishlist
    await addCardToWishlist(user.userId, cardId)

    return NextResponse.json({ success: true, cardId }, { status: 201 })
  } catch (error) {
    // Check if it's an authentication error
    if (
      error instanceof Error &&
      (error.message === 'Not authenticated' || error.message === 'Invalid token')
    ) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // Check for validation error (Zod)
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid cardId' }, { status: 400 })
    }

    // Check for duplicate card error
    if (error instanceof Error && error.message.includes('already in wishlist')) {
      return NextResponse.json({ error: 'Card already in wishlist' }, { status: 409 })
    }

    console.error('Error adding card to wishlist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
