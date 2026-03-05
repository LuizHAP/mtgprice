/**
 * Authentication utility functions
 *
 * Provides password hashing/verification and JWT signing/verification
 * for user authentication using bcrypt and jsonwebtoken.
 */

import type { JwtPayload } from '@/types/auth'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

/**
 * Hash a password using bcrypt
 *
 * @param password - Plain text password to hash
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/**
 * Compare a plain text password with a hashed password
 *
 * @param password - Plain text password to verify
 * @param hashedPassword - Hashed password to compare against
 * @returns True if password matches, false otherwise
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

/**
 * Compare a plain text password with a plain text bot password
 * Used for Telegram bot authentication (single-user mode)
 *
 * @param password - Plain text password to verify
 * @param botPassword - Plain text bot password to compare against
 * @returns True if password matches, false otherwise
 */
export async function compareBotPassword(password: string, botPassword: string): Promise<boolean> {
  return password === botPassword
}

/**
 * Sign a JWT token for a user
 *
 * @param userId - User ID to include in token payload
 * @param email - User email to include in token payload
 * @returns Signed JWT token string
 * @throws Error if JWT_SECRET environment variable is not set
 */
export function signToken(userId: number, email: string): string {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }

  const payload: JwtPayload = {
    userId,
    email,
  }

  return jwt.sign(payload, secret, { expiresIn: '1d' })
}

/**
 * Verify and decode a JWT token
 *
 * @param token - JWT token string to verify
 * @returns Decoded JWT payload
 * @throws Error if token is invalid, expired, or JWT_SECRET is not set
 */
export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload
    return decoded
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Token verification failed')
  }
}
