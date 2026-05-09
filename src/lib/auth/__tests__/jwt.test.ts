/**
 * JWT token generation and verification tests
 *
 * Tests for AUTH-01 requirement: JWT-based session management
 *
 * Activated in Plan 07-01 (TEST-02)
 */

import { signToken, verifyToken } from '@/lib/auth'
import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'

// NOTE: process.env.JWT_SECRET is set globally in test/setup.ts as
// 'test-secret-key-for-jwt-signing'. Do NOT redeclare in beforeAll/afterAll —
// unsetting it would break other tests in the suite (Pitfall 4 in 07-RESEARCH.md).

describe('JWT token generation and verification', () => {
  it('should sign token with user payload', async () => {
    const token = signToken(42, 'user@example.com')
    expect(typeof token).toBe('string')
    // Standard JWT shape: header.payload.signature
    expect(token.split('.')).toHaveLength(3)
    // Payload contains the user info we signed
    const decoded = jwt.decode(token) as { userId: number; email: string }
    expect(decoded.userId).toBe(42)
    expect(decoded.email).toBe('user@example.com')
  })

  it('should verify valid token', async () => {
    const token = signToken(42, 'user@example.com')
    const payload = verifyToken(token)
    expect(payload.userId).toBe(42)
    expect(payload.email).toBe('user@example.com')
  })

  it('should reject invalid token', async () => {
    // Malformed token
    expect(() => verifyToken('not.a.valid.token')).toThrow()
    // Tampered signature on a real token
    const valid = signToken(1, 'a@b.com')
    const parts = valid.split('.')
    const tampered = `${parts[0]}.${parts[1]}.tamperedsignature`
    expect(() => verifyToken(tampered)).toThrow()
  })

  it('should reject expired token', async () => {
    // Use jsonwebtoken directly with negative expiresIn → instantly-expired token.
    // This avoids vi.useFakeTimers() which has known issues with async mocks in Vitest 3.x.
    const secret = process.env.JWT_SECRET as string
    const expiredToken = jwt.sign({ userId: 1, email: 'test@example.com' }, secret, { expiresIn: -1 })
    expect(() => verifyToken(expiredToken)).toThrow()
  })

  it('should include issued-at and expiration claims', async () => {
    const before = Math.floor(Date.now() / 1000)
    const token = signToken(42, 'user@example.com')
    const payload = verifyToken(token)
    // iat is set by jsonwebtoken at sign time
    expect(payload.iat).toBeDefined()
    expect(payload.iat).toBeGreaterThanOrEqual(before)
    // exp is set because signToken passes expiresIn: '1d'
    expect(payload.exp).toBeDefined()
    // 1 day = 86400 seconds — allow ±2s drift for clock granularity
    const exp = payload.exp ?? 0
    const iat = payload.iat ?? 0
    expect(exp - iat).toBeGreaterThanOrEqual(86398)
    expect(exp - iat).toBeLessThanOrEqual(86402)
  })
})
