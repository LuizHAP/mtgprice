/**
 * Telegram linking endpoint
 *
 * POST /api/auth/link-telegram
 *
 * Links the authenticated user's account to their Telegram chat ID for notifications.
 * Only authenticated users can link their Telegram account (AUTH-01).
 */

import { db } from '@/db/index'
import { users } from '@/db/schema'
import { verifyToken } from '@/lib/auth'
import type { JwtPayload, LinkTelegramInput, User } from '@/types/auth'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * POST handler for Telegram account linking
 *
 * Verifies user is authenticated
 * Updates user.telegramChatId in database
 * Returns 200 OK with updated user object
 * Returns 401 Unauthorized if not authenticated
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let payload: JwtPayload
    try {
      payload = verifyToken(token)
    } catch (error) {
      const response = NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      response.cookies.delete('auth_token')
      return response
    }

    // Parse request body
    const body: LinkTelegramInput = await request.json()
    const { chatId } = body

    // Validate input
    if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 })
    }

    // Update user in database
    const result = await db
      .update(users)
      .set({ telegramChatId: chatId.trim() })
      .where(eq(users.id, payload.userId))
      .returning()

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = result[0]

    // Create user object without password
    const userResponse: User = {
      id: user.id,
      email: user.email,
      telegramChatId: user.telegramChatId,
      createdAt: user.createdAt,
    }

    return NextResponse.json({ user: userResponse }, { status: 200 })
  } catch (error) {
    console.error('Telegram linking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
