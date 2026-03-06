import { db } from '@/db'
import { cards } from '@/db/schema'
import { ilike } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/cards/search?q=query
 *
 * Search for cards by name with autocomplete functionality.
 * Case-insensitive search with minimum 2 characters.
 * Returns up to 10 matching cards.
 *
 * Public endpoint - no authentication required.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    // Validate query parameter
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters long' },
        { status: 400 }
      )
    }

    // Search cards by name (case-insensitive)
    const results = await db
      .select({
        oracleId: cards.oracleId,
        name: cards.name,
        set: cards.set,
        imageUrl: cards.imageUrl,
      })
      .from(cards)
      .where(ilike(cards.name, `%${query}%`))
      .limit(10)

    // Return matching cards (empty array if no matches)
    return NextResponse.json({ cards: results }, { status: 200 })
  } catch (error) {
    console.error('Error searching cards:', error)
    return NextResponse.json(
      { error: 'Failed to search cards' },
      { status: 500 }
    )
  }
}
