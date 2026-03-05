import type { Context, MiddlewareFn } from 'grammy'

const allowedChatId = process.env.TELEGRAM_CHAT_ID

if (!allowedChatId) {
  throw new Error('TELEGRAM_CHAT_ID environment variable is not set')
}

export const whitelistMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const chatId = ctx.chat?.id?.toString()

  if (!chatId) {
    return ctx.reply('Sorry, this bot is not available for public use.')
  }

  if (chatId !== allowedChatId) {
    return ctx.reply('Sorry, this bot is not available for public use.')
  }

  return next()
}
