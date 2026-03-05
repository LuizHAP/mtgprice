/**
 * Auth utility tests (TDD RED phase)
 *
 * Tests for auth utility functions including password hashing,
 * password comparison, JWT signing, and JWT verification.
 */

import type { JwtPayload } from '@/types/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { comparePassword, hashPassword, signToken, verifyToken } from './auth'

// Mock bcrypt
vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}))

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(),
  verify: vi.fn(),
}))

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

describe('hashPassword', () => {
  it('should hash password with bcrypt', async () => {
    const plainPassword = 'testPassword123'
    const hashedPassword = 'hashedPassword123'

    vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword)

    const result = await hashPassword(plainPassword)

    expect(result).toBe(hashedPassword)
    expect(result).not.toBe(plainPassword)
    expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 10)
  })

  it('should be able to verify hashed password with comparePassword', async () => {
    const plainPassword = 'testPassword123'
    const hashedPassword = 'hashedPassword123'

    vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword)
    vi.mocked(bcrypt.compare).mockResolvedValue(true)

    await hashPassword(plainPassword)
    const result = await comparePassword(plainPassword, hashedPassword)

    expect(result).toBe(true)
  })
})

describe('comparePassword', () => {
  it('should verify correct password', async () => {
    const plainPassword = 'testPassword123'
    const hashedPassword = 'hashedPassword123'

    vi.mocked(bcrypt.compare).mockResolvedValue(true)

    const result = await comparePassword(plainPassword, hashedPassword)

    expect(result).toBe(true)
    expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword)
  })

  it('should reject wrong password', async () => {
    const wrongPassword = 'wrongPassword'
    const hashedPassword = 'hashedPassword123'

    vi.mocked(bcrypt.compare).mockResolvedValue(false)

    const result = await comparePassword(wrongPassword, hashedPassword)

    expect(result).toBe(false)
    expect(bcrypt.compare).toHaveBeenCalledWith(wrongPassword, hashedPassword)
  })
})

describe('signToken', () => {
  it('should create valid JWT', () => {
    const payload = { userId: 1, email: 'test@example.com' }
    const token = 'valid.jwt.token'

    vi.mocked(jwt.sign).mockReturnValue(token)

    const result = signToken(payload.userId, payload.email)

    expect(result).toBe(token)
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: payload.userId, email: payload.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
    )
  })

  it('should be able to verify signed token with verifyToken', () => {
    const payload = { userId: 1, email: 'test@example.com' }
    const token = 'valid.jwt.token'

    vi.mocked(jwt.sign).mockReturnValue(token)
    vi.mocked(jwt.verify).mockReturnValue(payload)

    const signedToken = signToken(payload.userId, payload.email)
    const result = verifyToken(signedToken)

    expect(result).toEqual(payload)
  })
})

describe('verifyToken', () => {
  it('should decode valid token', () => {
    const payload: JwtPayload = { userId: 1, email: 'test@example.com' }
    const token = 'valid.jwt.token'

    vi.mocked(jwt.verify).mockReturnValue(payload)

    const result = verifyToken(token)

    expect(result).toEqual(payload)
    expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET)
  })

  it('should throw on invalid token', () => {
    const invalidToken = 'invalid.jwt.token'

    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('Invalid token')
    })

    expect(() => verifyToken(invalidToken)).toThrow('Invalid token')
  })

  it('should throw on malformed token', () => {
    const malformedToken = 'not-a-jwt'

    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('jwt malformed')
    })

    expect(() => verifyToken(malformedToken)).toThrow('jwt malformed')
  })

  it('should throw on expired token', () => {
    const expiredToken = 'expired.jwt.token'

    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('Token expired')
    })

    expect(() => verifyToken(expiredToken)).toThrow('Token expired')
  })
})
