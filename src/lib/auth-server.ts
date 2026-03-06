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
 * @throws Error with message "Not authenticated" or "Invalid token" if auth fails
 *
 * @example
 * ```ts
 * import { getServerUser } from '@/lib/auth-server'
 *
 * export async function GET(request: NextRequest) {
 *   try {
 *     const user = await getServerUser()
 *     // user.userId, user.email are available
 *   } catch (error) {
 *     return NextResponse.json({ error: error.message }, { status: 401 })
 *   }
 * }
 * ```
 */
export async function getServerUser(): Promise<JwtPayload> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (!token) {
    throw new Error('Not authenticated')
  }

  try {
    const payload = verifyToken(token)
    return payload
  } catch (error) {
    throw new Error('Invalid token')
  }
}
