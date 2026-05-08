import { bot } from '../lib/telegram'
import { whitelistMiddleware } from './middleware/whitelist'
import './commands/start' // Import to register the command
import './commands/add' // Import to register the command
import './commands/remove' // Import to register the command
import './commands/list' // Import to register the command
import './commands/price' // Import to register the command
import './commands/history' // Import to register the command
import './commands/config' // Import to register the command

console.log('🤖 Starting Telegram bot...')
console.log('📍 Chat ID whitelist:', process.env.TELEGRAM_CHAT_ID || 'NOT SET')
console.log('🔑 Bot token:', process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'NOT SET')

// Apply whitelist middleware to all commands
bot.use(whitelistMiddleware)

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
  .then(() => console.log('✅ Commands registered'))
  .catch((err) => console.error('❌ Failed to register commands:', err))

// Start bot polling
bot
  .start()
  .then(() => {
    console.log('✅ Telegram bot started successfully - waiting for messages...')
    console.log('📱 Send /start <password> to authenticate')
  })
  .catch((error) => {
    console.error('❌ Failed to start Telegram bot:', error)
    process.exit(1)
  })
