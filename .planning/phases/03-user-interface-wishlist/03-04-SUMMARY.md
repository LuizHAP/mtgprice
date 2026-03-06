---
phase: 03-user-interface-wishlist
plan: 04
subsystem: Bot Commands
tags: [bot, telegram, wishlist, commands]
dependency_graph:
  requires:
    - phase: 03-user-interface-wishlist
      plan: 03-00 (Test Infrastructure)
    - phase: 03-user-interface-wishlist
      plan: 03-01 (Wishlist CRUD API)
  provides:
    - feature: Bot wishlist management commands
      route: /add, /remove, /list, /price
  affects:
    - file: src/bot/index.ts (updated with new command registrations)
tech_stack:
  added: []
  patterns:
    - Conversational flow with state management (Map-based storage)
    - Rate limiting per user (chat ID)
    - Message formatting with emoji indicators
    - Search + select pattern for multiple matches
    - Long message splitting (Telegram 4096 char limit)
key_files:
  created:
    - path: src/bot/utils/format.ts
      lines: 159
      purpose: Message formatting helpers (prices, trends, cards)
    - path: src/bot/utils/search.ts
      lines: 84
      purpose: Shared card search logic
    - path: src/bot/middleware/rate-limit.ts
      lines: 44
      purpose: Bot-specific rate limiting (10 req/min per user)
    - path: src/bot/commands/add.ts
      lines: 169
      purpose: /add command with search + select flow
    - path: src/bot/commands/remove.ts
      lines: 126
      purpose: /remove command (name or index)
    - path: src/bot/commands/list.ts
      lines: 142
      purpose: /list command with rate limiting
    - path: src/bot/commands/price.ts
      lines: 84
      purpose: /price command (best price across 4 sources)
  modified:
    - path: src/bot/index.ts
      changes: Added imports for 4 new commands, updated bot menu
decisions: []
metrics:
  duration_seconds: 240
  tasks_completed: 7
  files_created: 7
  files_modified: 1
  total_lines: 808
  commits: 7
  started_at: "2026-03-06T22:11:16Z"
  completed_at: "2026-03-06T22:15:16Z"
---

# Phase 3 Plan 04: Telegram Bot Wishlist Commands Summary

**One-liner:** Telegram bot wishlist management with conversational search + select flow, per-user rate limiting, and multi-source price comparison using shared queries from web UI.

## Overview

Implemented complete Telegram bot interface for wishlist management (WISH-04 requirement). All 4 commands (/add, /remove, /list, /price) use the same database queries as the web UI, ensuring data consistency. Commands include conversational flows for search and selection, rate limiting to prevent spam, and rich formatting with emoji indicators.

## Implementation Summary

### Files Created (7 files, 808 lines)

**Utility Functions (243 lines)**
- `src/bot/utils/format.ts` (159 lines) - Message formatting helpers for prices, trends, cards, and error messages. Handles null prices gracefully, formats trends with emoji (↑↓±), and provides consistent message formatting across all commands.
- `src/bot/utils/search.ts` (84 lines) - Shared card search logic. Searches cards table with ILIKE (case-insensitive), finds exact matches for auto-add, formats numbered lists for user selection. Limits to 10 results to prevent spam.

**Middleware (44 lines)**
- `src/bot/middleware/rate-limit.ts` (44 lines) - Bot-specific rate limiting using Redis-backed token bucket from Phase 1. Limits to 10 requests per minute per user (identified by chat ID). Returns friendly error message when limit exceeded.

**Command Handlers (521 lines)**
- `src/bot/commands/add.ts` (169 lines) - Conversational search + select flow. Searches database for cards, auto-adds exact matches, shows numbered list for multiple matches, handles user replies for selection. Uses Map-based state storage with 10-minute TTL to prevent memory leaks. Handles duplicate cards gracefully.
- `src/bot/commands/remove.ts` (126 lines) - Removes cards by name (exact match, case-insensitive) or index number (from /list output). Validates index range, handles cards not in wishlist.
- `src/bot/commands/list.ts` (142 lines) - Displays wishlist as numbered list with prices and trends. Format: "📈 [N] Card Name - R$ X (Source) - ↑10%". Applies rate limiting middleware. Handles empty wishlist. Splits long messages (Telegram 4096 char limit) at newlines to avoid breaking card entries.
- `src/bot/commands/price.ts` (84 lines) - Shows best price for a card across all 4 sources. Aggregates by oracle_id (multiple printings). Calculates price trend vs last week. Format: "Card Name - R$ X (Source) - ↑10%".

### Files Modified (1 file)

- `src/bot/index.ts` - Imported all 4 new command handlers (add, remove, list, price). Updated bot.api.setMyCommands with all 5 commands (start, add, remove, list, price). Removed placeholder commands.

## Key Features

### Conversational Flow (/add command)
- Search database with ILIKE query (case-insensitive partial match)
- Auto-add exact matches without showing selection list
- Show numbered list for multiple matches (max 10)
- Wait for user reply with number
- Validate selection (must be valid number within range)
- Clear pending searches after 10 minutes (TTL) to prevent memory leaks

### Rate Limiting
- Applied to /list and /price commands (10 req/min per user)
- Uses chat ID as rate limit key (per-user limits)
- Returns friendly error message: "Too many requests. Please wait a minute."
- Not applied to /add (conversational flow has natural delays)

### Message Formatting
- Prices: "R$ X.XX" or "N/A" if null
- Trends: "↑10%" (up, red), "↓5%" (down, green), "±" (stable)
- Card entries: "📈 [N] Card Name - R$ X (Source) - ↑10%"
- All 4 sources: "💵 Liga Magic: R$ X", "💵 TCGPlayer: R$ Y", etc.
- Best price: "✅ Best: R$ X (Source) - ↑10%"
- Empty wishlist: "Your wishlist is empty. Use /add to start tracking cards!"

### Long Message Handling
- Telegram messages limited to 4096 characters
- /list command splits long messages at newlines
- Preserves card entry integrity (no mid-entry breaks)
- Sends multiple messages sequentially

## Integration with Existing Code

### Shared Queries from Plan 03-01
All bot commands use the same database query functions as the web API:
- `getUserWishlist(userId)` - Get user's wishlist with card metadata
- `addCardToWishlist(userId, cardId)` - Add card to wishlist (handles duplicates)
- `removeCardFromWishlist(userId, cardId)` - Remove card from wishlist (handles not found)
- `getLatestPricesForCard(cardId)` - Get latest prices from all 4 sources
- `getBestPrice(prices)` - Find lowest price across sources
- `calculatePriceTrend(currentPrice, priceHistory)` - Calculate trend vs 7 days ago
- `getPriceHistory(cardId, limit)` - Get historical price data

This ensures data consistency between web UI and bot interface.

### Bot Infrastructure from Phase 1
- grammY bot instance from `src/lib/telegram.ts`
- Chat ID whitelist middleware from `src/bot/middleware/whitelist.ts`
- /start command pattern from `src/bot/commands/start.ts`
- Redis-backed rate limiting from `src/lib/ratelimit/rate-limiter.ts`

### Database Schema from Phase 1
- `cards` table (oracle_id, name, set, rarity, color, image_url)
- `wishlists` table (user_id, card_id, added_at)
- `prices` table (card_id, source, price_brl, timestamp)

## Deviations from Plan

**None - plan executed exactly as written.**

All tasks completed as specified:
1. ✅ Created bot utility functions (format and search)
2. ✅ Created bot rate limiting middleware
3. ✅ Implemented /add command with search + select flow
4. ✅ Implemented /remove command
5. ✅ Implemented /list command with rate limiting
6. ✅ Implemented /price command
7. ✅ Registered bot commands and updated bot menu

## Verification Checklist

- [x] All 4 command handlers created (/add, /remove, /list, /price)
- [x] Utility functions for formatting and search work correctly
- [x] Rate limiting middleware applied to /list and /price commands
- [x] /add command handles conversational flow (search → select → add)
- [x] /remove command works with both names and index numbers
- [x] /list command displays wishlist with prices and trends
- [x] /price command shows best price across all 4 sources
- [x] All commands use same database queries as web UI
- [x] Bot menu updated with all commands
- [x] All code passes Biome linting
- [x] All files committed individually with proper messages

## Success Criteria

✅ **User can manage wishlist via Telegram bot** (WISH-04 requirement complete)
✅ **Bot commands use same data as web UI** (shared queries from plan 03-01)
✅ **Conversational flows work** (search + select for /add)
✅ **Rate limiting prevents spam** (10 req/min per user)
✅ **Messages formatted with emoji and trends** (↑↓ indicators)
✅ **Phase 3 complete:** Web UI (plan 03-03) + bot UI (plan 03-04) both functional

## Next Steps

Phase 3 is now complete! All plans finished:
- ✅ 03-00: Test Infrastructure Setup
- ✅ 03-01: Wishlist CRUD API Endpoints
- ✅ 03-02: Card Search and Price Comparison API
- ✅ 03-03: Web Dashboard Wishlist Management
- ✅ 03-04: Telegram Bot Wishlist Commands (this plan)

**Ready for Phase 4:** Opportunity Detection & Notifications
- Implement opportunity detection algorithm (price drop + below historical average)
- Create notification system via Telegram bot
- Add /history and /config commands for bot
- Set up scheduled alerts (2-3x daily checks)

## Commits

1. `19fb847` - feat(03-04): create bot utility functions for formatting and search
2. `7d96a51` - feat(03-04): create bot rate limiting middleware
3. `206e532` - feat(03-04): implement /add command with search and select flow
4. `ae40102` - feat(03-04): implement /remove command
5. `faa0253` - feat(03-04): implement /list command with rate limiting
6. `3a3fc54` - feat(03-04): implement /price command
7. `77ee9d7` - feat(03-04): register bot commands and update bot menu

---

**Phase 3 Status:** ✅ COMPLETE (5/5 plans finished)
**Project Progress:** 81% (13/16 phase plans complete)
**Next Phase:** 04-opportunity-detection-alerts
