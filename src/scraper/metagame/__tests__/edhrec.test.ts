import { describe, it } from 'vitest'

// Wave 0 stub for Plan 02 (EDHREC Commander fetcher).
// Plan 02 will replace the .todo() entries with real assertions.
// Coverage target: META-03 (Commander top 50 names extracted from EDHREC JSON)

describe('fetchEDHRECTopCards', () => {
  it.todo('returns the first 50 card names from cardviews when response.data.cardviews is populated')
  it.todo('falls back to container.json_dict.cardlists[0].cardviews if root cardviews missing')
  it.todo('returns empty array and logs warning when response is malformed')
  it.todo('respects circuit breaker on HTTP 5xx (skips Commander that week without throwing)')
  it.todo('truncates response to provided limit (default 50)')
})
