import { relations } from 'drizzle-orm'
import { integer, pgTable, serial, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { cards } from './cards'
import { users } from './users'

export const wishlists = pgTable(
  'wishlists',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    cardId: varchar('card_id', { length: 255 })
      .notNull()
      .references(() => cards.oracleId),
    addedAt: timestamp('added_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserCard: unique('uniqueUserCard').on(table.userId, table.cardId),
  }),
)

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
