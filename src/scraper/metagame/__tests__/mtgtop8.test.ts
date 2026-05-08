import { describe, it } from 'vitest'

// Wave 0 stub for Plan 02 (MTGTop8 Standard + Modern fetcher).
// Plan 02 will replace the .todo() entries with real assertions.
// Coverage target: META-01 (Standard), META-02 (Modern)

describe('fetchMTGTop8TopCards', () => {
  it.todo('parses card names from cheerio table rows for Standard (f=ST, meta=52)')
  it.todo('parses card names from cheerio table rows for Modern (f=MO, meta=51)')
  it.todo('logs a warning and returns empty array when fewer than 20 rows are returned (stale meta ID guard)')
  it.todo('truncates to limit=50 even if HTML contains more rows')
  it.todo('strips empty strings and trims whitespace from parsed card names')
  it.todo('caps card name length to 255 characters (matches wishlists.cardId varchar limit)')
})
