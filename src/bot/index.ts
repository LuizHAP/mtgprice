import { bot } from '../lib/telegram'
import { whitelistMiddleware } from './middleware/whitelist'
import './commands/start' // Import to register the command

console.log('🤖 Starting Telegram bot...')
console.log('📍 Chat ID whitelist:', process.env.TELEGRAM_CHAT_ID || 'NOT SET')
console.log('🔑 Bot token:', process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'NOT SET')

// Apply whitelist middleware to all commands
bot.use(whitelistMiddleware)

// Register bot commands in Telegram menu
bot.api
  .setMyCommands([
    { command: 'start', description: 'Authenticate with password' },
    { command: 'price', description: 'Check card price' }, // Placeholder for Phase 4
    { command: 'history', description: 'View price history alerts' }, // Placeholder for Phase 4
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
