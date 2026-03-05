import { bot } from '../lib/telegram'
import { whitelistMiddleware } from './middleware/whitelist'
import './commands/start' // Import to register the command

// Apply whitelist middleware to all commands
bot.use(whitelistMiddleware)

// Register bot commands in Telegram menu
bot.api.setMyCommands([
  { command: 'start', description: 'Authenticate with password' },
  { command: 'price', description: 'Check card price' }, // Placeholder for Phase 4
  { command: 'history', description: 'View price history alerts' }, // Placeholder for Phase 4
])

// Start bot polling
bot
  .start()
  .then(() => {
    console.log('Telegram bot started successfully')
  })
  .catch((error) => {
    console.error('Failed to start Telegram bot:', error)
    process.exit(1)
  })
