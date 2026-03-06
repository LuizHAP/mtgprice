import type { Context } from 'grammy'
import { vi } from 'vitest'

/**
 * Mock grammY Context factory for testing Telegram bot commands
 */

export interface MockMessageOptions {
  text: string
  chatId?: number | string
  userId?: number
  username?: string
}

export interface MockContextOptions {
  message?: MockMessageOptions
  chatId?: number | string
  userId?: number
  username?: string
  match?: string | RegExpMatchArray
}

/**
 * Creates a mock grammY Message object
 */
export function createMockMessage(
  options: MockMessageOptions,
): // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
any {
  const { text, chatId = 123456, userId = 123456, username = 'testuser' } = options

  return {
    message_id: 1,
    date: Date.now() / 1000,
    chat: {
      id: typeof chatId === 'number' ? chatId : Number.parseInt(chatId, 10),
      type: 'private',
      username,
      first_name: 'Test',
      last_name: 'User',
    },
    from: {
      id: userId,
      is_bot: false,
      username,
      first_name: 'Test',
      last_name: 'User',
      language_code: 'en',
    },
    text,
  }
}

/**
 * Creates a mock grammY Context object for testing bot command handlers
 *
 * @example
 * ```ts
 * const ctx = createMockContext({
 *   message: { text: '/start testpassword', chatId: 123456 }
 * })
 * await startCommandHandler(ctx)
 * ```
 */
export function createMockContext(options: MockContextOptions = {}): Context {
  const { message: messageOptions, chatId = 123456, userId = 123456, username = 'testuser', match } = options

  const message = messageOptions ? createMockMessage(messageOptions) : undefined

  const mockContext = {
    message,
    chat: {
      id: typeof chatId === 'number' ? chatId : Number.parseInt(chatId.toString(), 10),
      type: 'private',
    },
    from: {
      id: userId,
      username,
      first_name: 'Test',
      last_name: 'User',
    },
    match,
    reply: vi.fn().mockResolvedValue({ message_id: 1 }),
    editMessageText: vi.fn().mockResolvedValue({ message_id: 1 }),
  } as unknown as Context

  return mockContext
}
