/**
 * Password hashing tests
 *
 * Tests for AUTH-01 requirement: Secure password storage with bcrypt
 *
 * Activated in Plan 07-01 (TEST-01)
 */

import { comparePassword, hashPassword } from '@/lib/auth/password'
import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'

describe('Password hashing with bcrypt', () => {
  it('should hash password with 10 salt rounds', async () => {
    const password = 'mySecretPassword123'
    const hash = await hashPassword(password)
    expect(typeof hash).toBe('string')
    expect(hash).not.toBe(password)
    expect(bcrypt.getRounds(hash)).toBe(10)
  })

  it('should compare correct password successfully', async () => {
    const password = 'correctPassword!'
    const hash = await hashPassword(password)
    const result = await comparePassword(password, hash)
    expect(result).toBe(true)
  })

  it('should reject incorrect password', async () => {
    const password = 'correctPassword!'
    const wrongPassword = 'wrongPassword!'
    const hash = await hashPassword(password)
    const result = await comparePassword(wrongPassword, hash)
    expect(result).toBe(false)
  })

  it('should generate different hashes for same password', async () => {
    const password = 'samePassword'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    expect(hash1).not.toBe(hash2)
    expect(await comparePassword(password, hash1)).toBe(true)
    expect(await comparePassword(password, hash2)).toBe(true)
  })
})
