import { pgTable, serial, varchar, numeric, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { cards } from './cards'

export const prices = pgTable('prices', {
  id: serial('id').primaryKey(),
  cardId: varchar('card_id', { length: 255 }).notNull().references(() => cards.oracleId),
  source: varchar('source', { length: 50 }).notNull(),
  priceBrl: numeric('price_brl', { precision: 10, scale: 2 }).notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
}, (table) => ({
  cardTimestampIdx: index('prices_card_timestamp_idx').on(table.cardId, table.timestamp),
}))

export const pricesRelations = relations(prices, ({ one }) => ({
  card: one(cards, {
    fields: [prices.cardId],
    references: [cards.oracleId],
  }),
}))
