import { pgTable, serial, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { cards } from './cards'

export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  cardId: varchar('card_id', { length: 255 }).notNull().references(() => cards.oracleId),
  addedAt: timestamp('added_at').notNull().defaultNow(),
})

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  user: one(users, {
    fields: [wishlists.userId],
    references: [users.id],
  }),
  card: one(cards, {
    fields: [wishlists.cardId],
    references: [cards.oracleId],
  }),
}))
