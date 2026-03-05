import { eq } from 'drizzle-orm'
import type { Context } from 'grammy'
import { db } from '../../db'
import { users } from '../../db/schema'
import { compareBotPassword } from '../../lib/auth'
import { bot } from '../../lib/telegram'

const botPassword = process.env.BOT_PASSWORD

if (!botPassword) {
  throw new Error('BOT_PASSWORD environment variable is not set')
}

export async function startCommandHandler(ctx: Context): Promise<void> {
  // Extract password from command arguments
  const messageText = ctx.message?.text
  if (!messageText) {
    return ctx.reply('Usage: /start <password>')
  }

  const parts = messageText.split(' ')
  if (parts.length < 2) {
    return ctx.reply('Usage: /start <password>')
  }

  const password = parts[1]

  // Verify password
  const isValid = await compareBotPassword(password, botPassword)

  if (!isValid) {
    return ctx.reply('Invalid password. Access denied.')
  }

  // Get chat ID
  const chatId = ctx.chat?.id?.toString()
  if (!chatId) {
    return ctx.reply('Unable to identify your chat. Please try again.')
  }

  try {
    // Update user with Telegram chat ID
    // For single-user mode, we update the first user (you)
    const updatedUsers = await db
      .update(users)
      .set({ telegramChatId: chatId })
      .where(eq(users.id, 1)) // Assuming first user is the admin
      .returning()

    if (updatedUsers.length === 0) {
      return ctx.reply('User not found. Please create an account first.')
    }

    await ctx.reply('Welcome! Your Telegram account is now linked. You will receive notifications here.')

    console.log(`Telegram account linked for user ID 1, chat ID: ${chatId}`)
  } catch (error) {
    console.error('Error linking Telegram account:', error)
    await ctx.reply('An error occurred while linking your account. Please try again.')
  }
}

// Register the command
bot.command('start', startCommandHandler)
