/**
 * Wishlist item API endpoint
 *
 * DELETE /api/wishlist/[card_id] - Remove card from wishlist
 *
 * Requires authentication via JWT token in httpOnly cookie.
 */

import { getServerUser } from '@/lib/auth-server'
import { removeCardFromWishlist } from '@/lib/wishlist/queries'
import { NextResponse } from 'next/server'

/**
 * DELETE handler - Remove card from user's wishlist
 *
 * Removes a card from the authenticated user's wishlist by card_id.
 * Returns 204 No Content on success.
 * Returns 404 if card not in wishlist.
 *
 * @returns 204 No Content on success
 * @returns 401 if not authenticated
 * @returns 404 if card not in wishlist
 * @returns 500 on server errors
 *
 * @example
 * ```ts
 * DELETE /api/wishlist/abc123
 * // Returns: 204 No Content
 * ```
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ card_id: string }> }) {
  try {
    // Authenticate user
    const user = await getServerUser()

    // Extract card_id from URL params
    const { card_id: cardId } = await params

    // Remove from wishlist
    await removeCardFromWishlist(user.userId, cardId)

    return NextResponse.json(null, { status: 204 })
  } catch (error) {
    // Check if it's an authentication error
    if (
      error instanceof Error &&
      (error.message === 'Not authenticated' || error.message === 'Invalid token')
    ) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // Check for not found error
    if (error instanceof Error && error.message.includes('not in wishlist')) {
      return NextResponse.json({ error: 'Card not in wishlist' }, { status: 404 })
    }

    console.error('Error removing card from wishlist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
