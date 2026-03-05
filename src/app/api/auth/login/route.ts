/**
 * Login API endpoint
 *
 * POST /api/auth/login
 *
 * Authenticates a user with email and password, then sets an httpOnly cookie
 * with a JWT token for session management.
 */

import { db } from '@/db/index'
import { users } from '@/db/schema'
import { comparePassword, signToken } from '@/lib/auth'
import type { LoginInput, User } from '@/types/auth'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * POST handler for login
 *
 * Expects JSON body with { email, password }
 * Returns 200 OK with user object on success
 * Returns 401 Unauthorized on invalid credentials
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LoginInput = await request.json()
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Query database for user by email
    const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1)

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const user = userResult[0]

    // Compare password hash
    const isPasswordValid = await comparePassword(password, user.passwordHash)

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Generate JWT token
    const token = signToken(user.id, user.email)

    // Create user object without password
    const userResponse: User = {
      id: user.id,
      email: user.email,
      telegramChatId: user.telegramChatId,
      createdAt: user.createdAt,
    }

    // Set httpOnly cookie with token
    const response = NextResponse.json({ user: userResponse, token }, { status: 200 })

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 hours (1 day)
      path: '/',
      sameSite: 'lax',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
