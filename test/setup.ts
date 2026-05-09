import { afterAll, beforeAll } from 'vitest'

// Set up environment variables for tests
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/mtgprice'
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'

// Mock console methods in test environment to reduce noise
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress specific error messages in tests
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
      return
    }
    originalError.call(console, ...args)
  }

  console.warn = (...args: unknown[]) => {
    // Suppress specific warning messages in tests
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})
