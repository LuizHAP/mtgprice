/**
 * Authentication type definitions
 *
 * Defines the contracts for authentication system including
 * user data, login inputs, JWT payloads, and API responses.
 */

/**
 * User interface representing a user in the system
 */
export interface User {
  id: number
  email: string
  telegramChatId: string | null
  createdAt: Date
}

/**
 * Login input interface for authentication requests
 */
export interface LoginInput {
  email: string
  password: string
}

/**
 * Authentication response interface for successful login
 */
export interface AuthResponse {
  user: User
  token: string
}

/**
 * JWT payload interface for token verification
 */
export interface JwtPayload {
  userId: number
  email: string
  iat?: number
  exp?: number
}

/**
 * Telegram linking input interface
 */
export interface LinkTelegramInput {
  chatId: string
  password: string
}
