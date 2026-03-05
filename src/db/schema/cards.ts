import { relations } from 'drizzle-orm'
import { index, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { prices } from './prices'
import { wishlists } from './wishlists'

export const cards = pgTable(
  'cards',
  {
    id: serial('id').primaryKey(),
    oracleId: varchar('oracle_id', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    set: varchar('set', { length: 10 }),
    rarity: varchar('rarity', { length: 50 }),
    color: varchar('color', { length: 50 }),
    imageUrl: text('image_url'),
    lastFetched: timestamp('last_fetched'),
  },
  (table) => ({
    oracleIdx: index('cards_oracle_idx').on(table.oracleId),
  }),
)

export const cardsRelations = relations(cards, ({ many }) => ({
  prices: many(prices),
  wishlists: many(wishlists),
}))
