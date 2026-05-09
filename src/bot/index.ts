import { logger } from '../lib/logger'
import { bot } from '../lib/telegram'
import { scheduleMetagameRefresh, schedulePriceCollection } from '../scheduler'
import { whitelistMiddleware } from './middleware/whitelist'

logger.info('Starting Telegram bot')
logger.info(`Chat ID whitelist: ${process.env.TELEGRAM_CHAT_ID || 'NOT SET'}`)
logger.info(`Bot token: ${process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'NOT SET'}`)

// Apply whitelist middleware FIRST — must precede all command registrations.
// ES module static imports are hoisted, so command modules are loaded via
// dynamic imports below to guarantee they run after bot.use() is called.
bot.use(whitelistMiddleware)

// Command imports run AFTER middleware is in the chain.
// Wrapped in async IIFE because top-level await requires ESM output; this preserves load order.
void (async () => {
  await import('./commands/start')
  await import('./commands/add')
  await import('./commands/remove')
  await import('./commands/list')
  await import('./commands/price')
  await import('./commands/history')
  await import('./commands/config')

  // Register bot commands in Telegram menu
  bot.api
    .setMyCommands([
      { command: 'start', description: 'Authenticate with password' },
      { command: 'add', description: 'Add card to wishlist' },
      { command: 'remove', description: 'Remove card from wishlist' },
      { command: 'list', description: 'View your wishlist' },
      { command: 'price', description: 'Check card price' },
      { command: 'history', description: 'View recent opportunities' },
      { command: 'config', description: 'View detection configuration' },
    ])
    .then(() => logger.info('Bot commands registered in Telegram menu'))
    .catch((err) =>
      logger.error(`Failed to register bot commands: ${err instanceof Error ? err.message : String(err)}`),
    )

  // Start schedulers
  schedulePriceCollection().start()
  scheduleMetagameRefresh().start()
  logger.info('Schedulers started (price collection 3x daily, metagame refresh weekly)')

  // Start bot polling
  bot
    .start()
    .then(() => {
      logger.info('Telegram bot started successfully - waiting for messages')
    })
    .catch((error) => {
      logger.error(`Failed to start Telegram bot: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    })
})()
