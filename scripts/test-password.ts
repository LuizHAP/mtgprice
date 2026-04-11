import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index'
import { users } from '../src/db/schema'
import { comparePassword } from '../src/lib/auth'

async function testPassword() {
  const email = 'test@example.com'
  const password = 'password123'

  const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (userResult.length === 0) {
    console.log('❌ User not found')
    process.exit(1)
  }

  const user = userResult[0]
  console.log('✅ User found:', user.id)
  console.log('   Testing password:', password)

  const isValid = await comparePassword(password, user.passwordHash)

  console.log('   Password valid:', isValid)

  if (!isValid) {
    // Try resetting password
    console.log('❌ Password comparison failed')
    console.log('   This might be a different password than expected')
  }

  process.exit(0)
}

testPassword().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
