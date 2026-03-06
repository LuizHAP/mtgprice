# Phase 3: User Interface & Wishlist - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Web dashboard and Telegram bot interface for managing wishlists and viewing price data. Users can add/remove cards to monitor, search for cards by name, and compare prices across 4 sources (Liga Magic, TCGPlayer, CardMarket, CardKingdom). This phase delivers the user-facing interfaces for wishlist management (WISH-01 through WISH-05) and price comparison dashboard (DASH-01, DASH-02). Opportunity detection and notifications are separate phases.

</domain>

<decisions>
## Wishlist Management UI (Web Dashboard)

### Card Search: Autocomplete Dropdown
- Search bar with autocomplete as user types
- Dropdown shows matching card suggestions from Scryfall database
- Select from dropdown to add to wishlist
- Faster than manual input, prevents typos, handles card name variations
- Backend: Search against `cards` table using LIKE query on `name` column

### Wishlist Display: Card Grid with Images
- Grid layout showing card images + names + current best price
- Each card displays: Scryfall image URL (hotlink from Phase 2), card name, best price across 4 sources
- Visual, image-rich display good for browsing
- Responsive grid (adapts columns based on screen width)
- Backend: Query `wishlists` table, JOIN `cards` for metadata, LEFT JOIN `prices` for latest prices

### Card Removal: Both Individual + Bulk
- Each card has individual remove button (X icon or button)
- Checkboxes on each card for bulk selection
- "Remove Selected" button for bulk removal operations
- Flexibility for both single-item and multi-item removals
- Confirmation dialog before bulk removal

### Empty State: Guided Suggestions
- Friendly message: "Your wishlist is empty. Start tracking cards!"
- Suggestions to add popular Standard/Modern cards
- Quick-add buttons for suggested cards (pre-filled search)
- Guidance helps new users understand value proposition

## Price Comparison View

### Comparison Layout: Table Format
- Table with columns: Card | Liga Magic | TCGPlayer | CardMarket | CardKingdom | Best
- Dense, scannable format for comparing multiple cards
- Each row shows one card with all 4 source prices
- Sortable columns (by price, by name)
- Backend: Query latest prices from `prices` table for each card/source combination

### Card Details: Separate Page
- Click card name → navigate to `/cards/[oracle_id]` page
- Dedicated page with full card details, all prices, historical data
- Browser navigation works, URLs are shareable
- SEO-friendly, bookmarkable
- Next.js App Router dynamic route

### Price History: Trend Indicators Only
- Show price trend (↑↓) and % change vs last week
- Color-coded: green for down (good for buyers), red for up
- No charts in Phase 3 (charts are v2 requirement ANALY-01)
- Simple indicators sufficient for v1
- Backend: Compare current price vs price from 7 days ago

### Best Price Highlight: Color Highlight
- Highlight lowest price in green/bold text
- Visual cue immediately identifies best deal
- No separate badge needed (color is sufficient)
- Applies per row (best of 4 sources for that card)

## Telegram Bot Commands

### /add Command: Search + Select Pattern
1. User: `/add Black Lotus`
2. Bot: Searches database, shows numbered list of matches
   ```
   1. Black Lotus
   2. Black Lotus (Limited Edition Alpha)
   3. Lotus Petal
   ```
3. User: Replies with number (e.g., "2")
4. Bot: Adds selected card to wishlist, confirms with card name

Handles multiple matches gracefully. Exact match → auto-add (no selection needed).
Backend: Query `cards` table WHERE name ILIKE '%query%', return top 10 matches.

### /list Command: Text Format
- Displays wishlist as numbered list with inline formatting
- Format: "📈 [N] Card Name - R$ X (Source) - ↑10%"
- Text-only for bandwidth efficiency and fast scanning
- Shows: index, card name, best price, source, trend
- No images in Phase 3 (image format is v2 WISH-06)

### /remove Command: Exact Name Match
- `/remove Black Lotus` → removes exact name match
- Error message if card not found: "Card not in wishlist"
- Simple but strict - user must know exact name
- Alternatively, use index from /list: `/remove 3` removes 3rd card

### /price Command: Best Price Only
- `/price Black Lotus` → shows current best price across all sources
- Format: "Black Lotus - R$ 5000 (Liga Magic) - ↑10%"
- Minimal, focused on best deal
- If card has multiple printings, shows oracle_id aggregated result
- All-sources comparison and source filtering are v2 features

### Bot Command Registration
- Register commands via bot.api.setMyCommands (already in Phase 1)
- Commands: /start (auth), /add, /remove, /list, /price
- /history and /config are Phase 4 (notifications)

## Dashboard Layout & Navigation (Claude's Discretion)

### Page Structure
- `/` - Home/Overview (wishlist + recent opportunities)
- `/wishlist` - Full wishlist management
- `/cards/[oracle_id]` - Individual card details
- Navigation: Simple header nav (Logo | Wishlist | About)

### Mobile Responsiveness
- Card grid collapses to 1-2 columns on mobile
- Price table scrolls horizontally on mobile
- Bot commands work identically on mobile Telegram

### Authentication
- Single-user mode (from Phase 1) - no login UI
- Password protection via middleware (already in Phase 1)
- No user settings/profile pages in Phase 3

## Claude's Discretion

### Unspecified UI/UX Details
- Exact spacing, typography, and color scheme (use Shadcn/ui defaults)
- Loading states and skeletons (follow Shadcn/ui patterns)
- Error messages and toast notifications (use Shadcn/ui toast)
- Pagination vs infinite scroll for wishlist (wishlist is small, pagination is fine)
- Dashboard analytics and charts (deferred to v2 - ANALY-01, ANALY-02)

### Technical Implementation Details
- Exact autocomplete debounce timing (300ms is standard)
- Number of search results to show (10 is reasonable)
- Whether to cache search results (implement if slow)
- Exact shade of green/red for price highlights
- Image dimensions and aspect ratios in card grid
- Toast notification duration and positioning

### Telegram Bot Behavior
- Message expiration time for search results (10 minutes is standard)
- Maximum number of search results to show (10 prevents spam)
- Error message phrasing and tone
- Whether to show set/rarity in search results (helps disambiguation)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Authentication system:** `src/lib/auth.ts` - JWT verification, bcrypt password hashing, compareBotPassword for bot auth
- **Telegram bot:** `src/bot/index.ts` - grammY bot instance with command registration, middleware infrastructure
- **Database schema:** `src/db/schema/` - `cards` table (oracle_id, name, set, image_url), `wishlists` table (user_id, card_id), `prices` table (card_id, source, price_brl, timestamp)
- **Rate limiting:** `src/lib/ratelimit/` - Redis-backed token bucket, will need bot UI rate limits

### Established Patterns
- **Monorepo structure:** `src/web/` for dashboard UI, `src/bot/` for Telegram commands, `src/api/` for backend endpoints
- **Next.js App Router:** Use `/app/` directory structure, dynamic routes for `/cards/[oracle_id]`
- **Drizzle ORM:** Query patterns from Phase 2, use joins for wishlist + cards + prices
- **Middleware pattern:** Auth middleware from Phase 1, can extend for route protection
- **Error handling:** Winston logging, structured JSON logs

### Integration Points
- **Wishlist API endpoints:** `/api/wishlist` (GET list, POST add, DELETE remove)
- **Card search API:** `/api/cards/search?q=` (autocomplete endpoint)
- **Price comparison API:** `/api/prices/[oracle_id]` (all sources, latest prices)
- **Card details API:** `/api/cards/[oracle_id]` (metadata + historical prices)
- **Bot command handlers:** `src/bot/commands/add.ts`, `src/bot/commands/remove.ts`, `src/bot/commands/list.ts`, `src/bot/commands/price.ts`
- **Database queries:** Join `wishlists` → `cards` → `prices` for wishlist display, filter by timestamp DESC for latest price per source

### Tech Stack Context
- **Frontend:** Next.js 15.2.3, React 19.1.0, TypeScript 5.9.0
- **UI components:** Shadcn/ui (copiable components, not installed yet) + Tailwind CSS
- **Bot:** grammY 1.36.2 with long polling (development), webhooks (production)
- **Database:** PostgreSQL 16 + TimescaleDB 2.15 with Drizzle ORM 0.38.4
- **State management:** React Context + hooks (from Phase 1 decision)
- **HTTP client:** axios 1.13.6 for API calls
- **Date handling:** date-fns 4.1.0 for trend calculations

### Missing Infrastructure (To be built in Phase 3)
- **No UI components yet:** Greenfield for dashboard, need to install/configure Shadcn/ui
- **No web pages yet:** `src/app/` only has `/api/` routes, need to add page routes
- **No wishlist API endpoints:** Need to build CRUD endpoints for wishlist management
- **No card search:** Need to implement autocomplete endpoint querying `cards` table
- **No bot commands beyond /start:** Need to implement /add, /remove, /list, /price handlers

</code_context>

<specifics>
## Specific Ideas

**User preferences from requirements:**
- Dual interface: web dashboard + Telegram bot (PROJECT.md line 45-48)
- Single-user mode initially (Phase 1 CONTEXT.md line 69-71)
- Price comparison across 4 sources (REQUIREMENTS.md DASH-01)
- Wishlist management via both web and bot (REQUIREMENTS.md WISH-04, WISH-05)

**Design decisions carried forward from prior phases:**
- Card identification: Use Scryfall `oracle_id` (Phase 1 CONTEXT.md line 17-19)
- Image hosting: Hotlink Scryfall URLs (Phase 2 CONTEXT.md line 93-97)
- Single-user authentication: Password + chat_id whitelist (Phase 1 CONTEXT.md line 74-77)
- Price storage: One row per source in `prices` table (Phase 1 CONTEXT.md line 22-25)

**New Phase 3 decisions:**
- Autocomplete search for card discovery (UX: prevents typos, faster than manual input)
- Card grid layout (visual preference, leverages Scryfall images)
- Comparison table for prices (dense, data-rich view)
- Bot search + select pattern (handles multiple printings gracefully)
- Text format for /list (bandwidth-efficient, fast scanning)

**Scope boundaries (what's NOT in Phase 3):**
- Price history charts (deferred to v2 - REQUIREMENTS.md ANALY-01)
- Advanced filtering (by format, by color, by set) - v2 feature
- Collection management (only wishlist in v1)
- Card scanning via camera (v2 - REQUIREMENTS.md WISH-06)
- Multiple user support (single-user mode from Phase 1)
- Advanced bot commands (/history, /config are Phase 4)

</specifics>

<deferred>
## Deferred Ideas

**During this discussion:**
- Dashboard analytics and charts (v2 requirement ANALY-01, ANALY-02)
- Advanced filtering (by format, color, set, rarity)
- Collection tracking (owned cards vs wishlist)
- Card image format in bot (v2 - WISH-06)
- All-sources price comparison in /price command (v2)
- Configurable bot output (/list --images)

**Noted for future consideration:**
- Price alerts configuration UI (Phase 4 - opportunity detection)
- Format-based auto-monitoring (Phase 5 - metagame integration)
- Export wishlist to CSV/JSON (v2 feature)
- Shareable wishlist links (v2 social feature)
- Price prediction/forecasting (explicitly out of scope - REQUIREMENTS.md line 87)
- Mobile app (web dashboard is sufficient for v1 - REQUIREMENTS.md line 92)

</deferred>

---

*Phase: 03-user-interface-wishlist*
*Context gathered: 2026-03-06*
