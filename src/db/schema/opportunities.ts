import { relations } from 'drizzle-orm'
import { boolean, index, numeric, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core'
import { cards } from './cards'

export type OpportunitySource = 'ligamagic' | 'tcgplayer' | 'cardmarket' | 'cardkingdom'

export const opportunities = pgTable(
  'opportunities',
  {
    id: serial('id').primaryKey(),
    cardId: varchar('card_id', { length: 255 })
      .notNull()
      .references(() => cards.oracleId),
    source: varchar('source', { length: 20 }).notNull(),
    detectedAt: timestamp('detected_at').notNull().defaultNow(),
    currentPrice: numeric('current_price', { precision: 10, scale: 2 }).notNull(),
    baselinePrice: numeric('baseline_price', { precision: 10, scale: 2 }).notNull(),
    dropPercent: numeric('drop_percent', { precision: 5, scale: 2 }).notNull(),
    sentToUser: boolean('sent_to_user').notNull().default(false),
  },
  (table) => ({
    cardSourceDetectedIdx: index('opportunities_card_source_detected_idx').on(
      table.cardId,
      table.source,
      table.detectedAt,
    ),
  }),
)

export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  card: one(cards, {
    fields: [opportunities.cardId],
    references: [cards.oracleId],
  }),
}))
