# Phase 5: Metagame Integration - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-populate monitored cards from the competitive metagame without user intervention. The system fetches top played cards for Standard, Modern, and Commander on a weekly schedule and inserts them into the watchlist so the existing price collection and opportunity detection pipelines cover them automatically.

**Explicitly out of scope for Phase 5:**
- Price charts / visualizations (v2 — ANALY-01)
- Pioneer, Legacy, Vintage, Pauper staples (v2 — META-04 through META-07)
- Per-format enable/disable preferences (deferred to Phase 6 polish)
- User-facing UI for metagame card management (existing wishlist UI inherits these cards)

</domain>

<decisions>
## Implementation Decisions

### Card Count
- **D-01:** Monitor **top 50 cards per format** — Standard, Modern, and Commander each contribute 50 cards for a maximum of 150 auto-monitored cards. This covers all competitive staples without inflating storage or API load.

### Refresh Cadence
- **D-02:** Metagame list refreshes **weekly** (Sunday recommended). Metagame shifts over days to weeks, not hours — weekly refresh keeps the list current without hammering external sources. A dedicated weekly cron job separate from the 3x-daily price collection cron.

### Data Source
- **D-03 (Claude's Discretion):** Researcher should evaluate MTGTop8 (scraping, has Standard/Modern/Legacy/Pioneer), MTGGoldfish (has modern metagame stats), and EDHREC (Commander, has a public API). Prioritize sources with stable access and minimal scraping fragility. EDHREC has a documented public API for Commander top cards — prefer that for Commander. For Standard/Modern, pick the most stable scraped or API-based source.

### Storage Approach
- **D-04 (Claude's Discretion):** Researcher/planner should decide whether metagame cards are inserted directly into the existing `wishlists` table (simplest — feeds detection with zero new query logic, leverages the UNIQUE constraint as upsert guard) or a separate `metagame_cards` table (allows distinguishing personal vs auto-monitored). The planner should default to the `wishlists` table approach per D-08 from Phase 4 ("Phase 5 will auto-add format staples into the wishlist table") unless a clear reason to diverge is found.

### Removal Policy
- **D-05 (Claude's Discretion):** When a card drops off the top-50 tier on the next weekly refresh, the planner should decide between: (a) remove from auto-monitoring (clean list, bounded size), (b) keep forever (accumulated watchlist), or (c) soft-delete / mark inactive. Default recommendation is (a) — remove when no longer in top 50 — to keep the monitored card count bounded. Cards the user added manually should never be auto-removed.

### Missing Card Handling
- **D-06 (Claude's Discretion):** If a metagame card's oracle_id is not yet in the local `cards` table, fetch its metadata from Scryfall and upsert before adding to the watchlist. This reuses the existing Scryfall lookup pattern from Phase 2. Failures should be logged and the card skipped (non-blocking).

### Single-User Scope
- **D-07:** All auto-added metagame cards use `userId = 1` (single-user mode, inherited from Phase 1 D-09 and Phase 4 D-09). No per-user sharding needed.

### Claude's Discretion
Researcher and planner have flexibility on: specific data source implementation (MTGTop8 vs MTGGoldfish vs EDHREC API), whether metagame cards get a distinguishing field in the database, and the exact removal policy mechanism — all within the boundaries above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — META-01, META-02, META-03 define the acceptance criteria for this phase

### Prior Phase Decisions
- `.planning/phases/04-opportunity-detection-notifications/04-CONTEXT.md` — D-08 (detection scope = wishlist), D-09 (single-user mode), D-12 (cooldown logic) — Phase 5 auto-adds to the watchlist that Phase 4 already evaluates
- `.planning/phases/01-foundation-infrastructure/01-CONTEXT.md` — Database conventions (Drizzle ORM, oracle_id as card identifier)
- `.planning/phases/02-core-data-collection/02-CONTEXT.md` — Scryfall lookup pattern, rate limiting conventions, scraping patterns

### Existing Code
- `src/db/schema/wishlists.ts` — Target table for auto-added cards; has UNIQUE(userId, cardId) constraint
- `src/db/schema/cards.ts` — Must contain the card's oracle_id before it can be added to wishlists
- `src/scheduler/jobs.ts` — Where the weekly metagame refresh cron job should be registered
- `src/scraper/orchestrator.ts` — Existing scraper orchestration pattern to follow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `wishlists` table + UNIQUE constraint: upsert-safe insertion with `ON CONFLICT DO NOTHING` for auto-added cards
- `cards` table: oracle_id-keyed cache; Scryfall API fallback pattern already in Phase 2 scraper
- `src/lib/opportunities/queries.ts` `detectOpportunitiesForWishlist()`: already queries wishlist cards — Phase 5 cards flow through automatically with no changes to detection
- `src/scheduler/jobs.ts`: existing cron infrastructure; new weekly job registers alongside the 3x-daily price cron

### Established Patterns
- Drizzle ORM with typed schema: new metagame tables/columns must follow the existing pattern
- Rate limiting: all external API calls go through the Redis-backed rate limiter from Phase 1
- Circuit breaker: scraper failures per source don't block others (Phase 2 pattern to follow for metagame fetching)

### Integration Points
- Weekly cron in `src/scheduler/jobs.ts` → calls metagame fetcher → upserts cards + wishlists
- Price collection already queries all wishlist entries — Phase 5 cards are automatically included

</code_context>

<specifics>
## Specific Ideas

- "Top 50" is a hard limit per format; if the external source returns fewer, take all of them
- Commander top 50 should target EDHREC's "all-time most popular" cards (not cEDH-specific staples), since that's the broadest Commander audience
- Standard and Modern top 50 should represent the current competitive meta, not historical

</specifics>

<deferred>
## Deferred Ideas

- Pioneer, Legacy, Vintage, Pauper staples (META-04 through META-07) — explicitly v2 per REQUIREMENTS.md
- Per-format on/off toggle (user might not play Commander and doesn't want those cards monitored) — Phase 6 polish

</deferred>

---

*Phase: 05-metagame-integration*
*Context gathered: 2026-05-08*
