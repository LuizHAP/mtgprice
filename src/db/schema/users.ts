import { pgTable, serial, varchar, timestamp, relations } from 'drizzle-orm/pg-core'
import { wishlists } from './wishlists'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  telegramChatId: varchar('telegram_chat_id', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const usersRelations = relations(users, ({ many }) => ({
  wishlists: many(wishlists),
}))
