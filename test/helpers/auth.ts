import { createToken } from '@/lib/auth'
import type { Headers } from 'node-fetch'

/**
 * Authentication helpers for API endpoint tests
 */

/**
 * Creates a JWT token for a test user
 *
 * @param userId - User ID (defaults to 1 for single-user mode)
 * @returns JWT token string
 *
 * @example
 * ```ts
 * const token = createTestToken(1)
 * ```
 */
export function createTestToken(userId: number = 1): string {
  return createToken({ userId, username: 'testuser' })
}

/**
 * Creates mock Headers object with Authorization header
 *
 * @param token - JWT token (creates test token if not provided)
 * @returns Mock Headers object
 *
 * @example
 * ```ts
 * const headers = createMockHeaders()
 * // Use with fetch: fetch('/api/wishlist', { headers: createMockHeaders() })
 * ```
 */
export function createMockHeaders(token?: string): Record<string, string> {
  const jwtToken = token || createTestToken()
  return {
    Authorization: `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Creates a mock Request object with auth headers for Next.js API route tests
 *
 * @param token - JWT token (creates test token if not provided)
 * @returns Mock Request object
 *
 * @example
 * ```ts
 * const request = createMockRequest()
 * ```
 */
export function createMockRequest(token?: string): Partial<Request> {
  const jwtToken = token || createTestToken()

  return {
    headers: new Headers({
      Authorization: `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
    }),
  }
}
