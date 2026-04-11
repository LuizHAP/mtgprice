import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index'
import { users } from '../src/db/schema'
import { hashPassword } from '../src/lib/auth'

async function checkUser() {
  const email = 'test@example.com'

  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (existing.length === 0) {
    console.log('❌ User does not exist')

    // Create user
    const password = 'password123'
    const passwordHash = await hashPassword(password)
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
      })
      .returning()

    console.log('✅ Created new user:')
    console.log('   Email:', email)
    console.log('   Password:', password)
    console.log('   User ID:', newUser.id)
  } else {
    console.log('✅ User exists:', email)
    console.log('   User ID:', existing[0].id)
    console.log('   Password hash (first 20 chars):', existing[0].passwordHash.substring(0, 20))
  }

  process.exit(0)
}

checkUser().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
