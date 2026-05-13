import { searchCards } from '@/lib/cards/queries'
import { type NextRequest, NextResponse } from 'next/server'

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

    // Validate query parameter (route-level guard — returns HTTP 400 before delegating)
    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters long' }, { status: 400 })
    }

    // Delegate DB query to the reusable lib function (D-06)
    const results = await searchCards(query)

    // Return matching cards (empty array if no matches)
    return NextResponse.json({ cards: results }, { status: 200 })
  } catch (error) {
    console.error('Error searching cards:', error)
    return NextResponse.json({ error: 'Failed to search cards' }, { status: 500 })
  }
}
