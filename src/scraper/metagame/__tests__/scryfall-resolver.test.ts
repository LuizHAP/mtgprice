import { describe, it } from 'vitest'

// Wave 0 stub for Plan 03 (Scryfall name -> oracle_id batch resolver).
// Plan 03 will replace the .todo() entries with real assertions.
// Coverage target: META-01,02,03 (resolution required for all three formats)

describe('resolveNamesToOracleIds', () => {
  it.todo('batches names into POST /cards/collection requests with up to 75 identifiers each')
  it.todo('returns { name, oracleId, metadata } tuples for all resolved cards')
  it.todo('honors RATE_LIMITS.SCRYFALL_HEAVY (2 req/s) between batches')
  it.todo('logs and skips names appearing in response.data.not_found')
  it.todo('returns empty array when input list is empty without making any HTTP call')
  it.todo('handles HTTP 429 by sleeping and retrying once before giving up')
})
