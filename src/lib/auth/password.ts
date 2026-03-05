import bcrypt from 'bcryptjs'

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10
  return bcrypt.hash(password, saltRounds)
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password
 * @param hash - Hashed password to compare against
 * @returns True if passwords match, false otherwise
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Compare a plain text password with an environment variable password
 * This is used for the Telegram bot authentication where the password is stored in env
 * @param password - Plain text password to verify
 * @param envPassword - Password from environment variable (plain text for dev simplicity)
 * @returns True if passwords match, false otherwise
 */
export async function compareBotPassword(password: string, envPassword?: string): Promise<boolean> {
  if (!envPassword) {
    return false
  }
  // For bot password, we use direct comparison since it's stored in env
  // In production, consider hashing the BOT_PASSWORD as well
  return password === envPassword
}
