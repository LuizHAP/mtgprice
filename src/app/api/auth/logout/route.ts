/**
 * Logout API endpoint
 *
 * POST /api/auth/logout
 *
 * Clears the auth_token httpOnly cookie to destroy the user's session.
 * This completes the AUTH-02 session management requirement.
 */

import { type NextRequest, NextResponse } from 'next/server'

/**
 * POST handler for logout
 *
 * Clears the auth_token httpOnly cookie
 * Returns 200 OK with success message
 */
export async function POST(request: NextRequest) {
  try {
    // Clear auth_token httpOnly cookie
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' }, { status: 200 })

    response.cookies.delete('auth_token')

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
