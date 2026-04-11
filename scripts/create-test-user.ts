import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index'
import { users } from '../src/db/schema'
import { hashPassword } from '../src/lib/auth'

async function createTestUser() {
  const email = 'test@example.com'
  const password = 'password123'

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (existing.length > 0) {
    console.log('User already exists:', email)
    process.exit(0)
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  // Insert user
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
    })
    .returning()

  console.log('✅ Test user created:')
  console.log('   Email:', email)
  console.log('   Password:', password)
  console.log('   User ID:', newUser.id)

  process.exit(0)
}

createTestUser().catch((error) => {
  console.error('Error creating test user:', error)
  process.exit(1)
})
