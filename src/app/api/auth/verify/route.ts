/**
 * Token verification endpoint
 *
 * GET /api/auth/verify
 *
 * Verifies the JWT token from the httpOnly cookie and returns the user data.
 * Used by frontend to check if user is logged in and refresh user data.
 */

import { db } from '@/db/index'
import { users } from '@/db/schema'
import { verifyToken } from '@/lib/auth'
import type { JwtPayload, User } from '@/types/auth'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * GET handler for token verification
 *
 * Reads auth_token from httpOnly cookie
 * Verifies token and returns user object
 * Returns 401 Unauthorized if token is invalid or missing
 */
export async function GET(request: NextRequest) {
  try {
    // Read auth_token from httpOnly cookie
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify token
    let payload: JwtPayload
    try {
      payload = verifyToken(token)
    } catch (error) {
      // Token is invalid or expired
      const response = NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      response.cookies.delete('auth_token')
      return response
    }

    // Query database for user by userId from token payload
    const userResult = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1)

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const user = userResult[0]

    // Create user object without password
    const userResponse: User = {
      id: user.id,
      email: user.email,
      telegramChatId: user.telegramChatId,
      createdAt: user.createdAt,
    }

    return NextResponse.json({ user: userResponse }, { status: 200 })
  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
