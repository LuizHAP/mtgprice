import { index, pgTable, serial, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { cards } from './cards'

export const detectionCandidates = pgTable(
  'detection_candidates',
  {
    id: serial('id').primaryKey(),
    cardId: varchar('card_id', { length: 255 })
      .notNull()
      .references(() => cards.oracleId, { onDelete: 'cascade' }),
    source: varchar('source', { length: 20 }).notNull(),
    firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueCardSource: unique('detection_candidates_card_source_key').on(table.cardId, table.source),
    firstSeenIdx: index('detection_candidates_first_seen_idx').on(table.firstSeenAt),
  }),
)
