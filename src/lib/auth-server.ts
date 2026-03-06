/**
 * Server-side authentication utilities
 *
 * Provides helper functions for Next.js API routes to authenticate users
 * via JWT tokens stored in httpOnly cookies.
 */

import type { JwtPayload } from '@/types/auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from './auth'

/**
 * Get the authenticated user from the request
 *
 * Verifies the JWT token from the httpOnly cookie and returns the user payload.
 * Used by API routes to authenticate requests.
 *
 * @returns The authenticated user payload
 * @throws NextResponse with 401 status if not authenticated or token is invalid
 *
 * @example
 * ```ts
 * import { getServerUser } from '@/lib/auth-server'
 *
 * export async function GET(request: NextRequest) {
 *   const user = await getServerUser()
 *   // user.userId, user.email are available
 * }
 * ```
 */
export async function getServerUser(): Promise<JwtPayload> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (!token) {
    throw NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const payload = verifyToken(token)
    return payload
  } catch (error) {
    throw NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
