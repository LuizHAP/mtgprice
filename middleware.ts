/**
 * Next.js Middleware
 *
 * Combines two concerns:
 * 1. Rate limiting for external API calls (from Plan 01-03)
 * 2. Authentication protection for dashboard routes (from Plan 01-04)
 *
 * Rate limits:
 * - Scryfall: 10 requests per second
 * - Telegram: 100 requests per 60 seconds
 * - TCGplayer: 50 requests per 60 seconds
 *
 * Auth protection:
 * - /dashboard/* routes require valid JWT token
 * - Redirects to /login if not authenticated
 */

import { type NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './src/lib/auth'
import { RATE_LIMITS, checkRateLimit } from './src/lib/ratelimit/rate-limiter'
import { getClient } from './src/lib/ratelimit/redis'

/**
 * Rate limit configuration for API routes
 *
 * Maps route patterns to rate limit presets
 */
const RATE_LIMIT_CONFIG: Record<string, { limit: number; interval: number }> = {
  '/api/external/scryfall': RATE_LIMITS.SCRYFALL,
  '/api/external/telegram': RATE_LIMITS.TELEGRAM,
  '/api/external/tcgplayer': RATE_LIMITS.TCGPLAYER,
}

/**
 * Next.js middleware function
 *
 * Combines rate limiting (from Plan 01-03) and auth protection (this plan).
 *
 * Concern 1: Rate limiting for /api/external/* routes
 * Concern 2: Auth protection for /dashboard/* routes
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CONCERN 1: Rate limiting for /api/external/* routes (from Plan 01-03)
  if (pathname.startsWith('/api/external/')) {
    // Extract source from path (e.g., /api/external/scryfall -> scryfall)
    const segments = pathname.split('/')
    const source = segments[3] || 'default'

    // Get rate limit config for this source
    const limit = RATE_LIMIT_CONFIG[`/api/external/${source}`] || RATE_LIMITS.SCRYFALL

    // Extract identifier (IP address or user ID)
    const identifier =
      request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous'

    try {
      // Check rate limit
      const redis = getClient()
      const result = await checkRateLimit(`${source}:${identifier}`, limit.limit, limit.interval, 1)

      // If rate limit exceeded, return 429
      if (!result.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', retryAfter: limit.interval },
          { status: 429, headers: { 'Retry-After': String(limit.interval) } },
        )
      }

      // Add rate limit headers to response
      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', String(limit.limit))
      response.headers.set('X-RateLimit-Remaining', String(result.remaining))
      response.headers.set('X-RateLimit-Interval', String(limit.interval))
      return response
    } catch (error) {
      // Log error but fail open to prevent Redis issues from blocking requests
      console.error('Rate limit check failed:', error)
      return NextResponse.next()
    }
  }

  // CONCERN 2: Auth protection for /dashboard/* routes (this plan)
  if (pathname.startsWith('/dashboard/')) {
    const token = request.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      // Token is valid, allow request
      verifyToken(token)
    } catch (error) {
      // Token is invalid, clear cookie and redirect
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth_token')
      return response
    }
  }

  return NextResponse.next()
}

/**
 * Middleware matcher configuration
 *
 * Specifies which routes the middleware should apply to.
 * Protects /api/external/* routes with rate limiting (from Plan 01-03).
 * Protects /dashboard/* routes with auth verification (this plan).
 * Excludes /api/auth/*, /_next/*, and static files.
 */
export const config = {
  matcher: ['/api/external/:path*', '/dashboard/:path*'],
}
