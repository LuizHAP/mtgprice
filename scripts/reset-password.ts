import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index'
import { users } from '../src/db/schema'
import { comparePassword, hashPassword } from '../src/lib/auth'

async function resetPassword() {
  const email = 'test@example.com'
  const newPassword = 'test123'

  // Hash new password
  const passwordHash = await hashPassword(newPassword)

  // Update user
  const [updated] = await db.update(users).set({ passwordHash }).where(eq(users.email, email)).returning()

  console.log('✅ Password reset for:', email)
  console.log('   New password:', newPassword)

  // Verify it works
  const isValid = await comparePassword(newPassword, passwordHash)
  console.log('   Password verification:', isValid ? '✅ PASS' : '❌ FAIL')

  process.exit(0)
}

resetPassword().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
