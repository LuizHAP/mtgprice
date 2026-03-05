import type { Config } from 'drizzle-kit'

// Load environment variables from .env.local (override existing)
import { config } from 'dotenv'
const result = config({ path: '.env.local', override: true })
if (result.error) {
  console.error('❌ Failed to load .env.local:', result.error)
}
console.log('✅ Loaded .env.local with override')
console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'))

export default {
  schema: './src/db/schema',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
} satisfies Config
