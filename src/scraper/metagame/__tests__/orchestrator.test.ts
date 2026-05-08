import { describe, it } from 'vitest'

// Wave 0 stub for Plan 04 (metagame orchestrator).
// Plan 04 will replace the .todo() entries with real assertions.
// Coverage target: META-01,02,03 (combined upsert + removal flow)

describe('executeMetagameRefresh', () => {
  it.todo('combines top 50 names from Standard, Modern, and Commander into a single resolution batch')
  it.todo('upserts missing cards into the cards table via Scryfall metadata before wishlist insert (D-06)')
  it.todo('inserts wishlist rows with userId=1 and isAutoAdded=true (D-07)')
  it.todo('uses onConflictDoNothing on UNIQUE(userId, cardId) so re-running is idempotent')
  it.todo('deletes wishlist rows WHERE isAutoAdded=true AND cardId NOT IN (newTop150Set) (D-05)')
  it.todo('NEVER deletes wishlist rows WHERE isAutoAdded=false (preserves user-added cards)')
  it.todo('continues with remaining formats when one source fails (circuit breaker pattern)')
  it.todo('logs a structured summary (added, removed, skipped, failed) after each run')
})
