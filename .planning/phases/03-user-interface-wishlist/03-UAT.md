---
status: diagnosed
phase: 03-user-interface-wishlist
source: [03-00-SUMMARY.md, 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-03-07T12:00:00Z
updated: 2026-03-07T12:58:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: pass

### 2. Add Card to Wishlist via API
expected: POST /api/wishlist with cardId adds card to user's wishlist. Returns success response with cardId. Duplicate requests return 409 error with "Card already in wishlist" message.
result: issue
reported: "Authentication works and POST successfully adds cards. However: 1) Duplicate detection doesn't work - same card added twice instead of returning 409. 2) DELETE /api/wishlist/[card_id] returns 500 Internal Server Error."
severity: major

### 3. View Wishlist with Prices
expected: GET /api/wishlist returns user's wishlist as array of cards with latest prices from all 4 sources (liga_magic, tcgplayer, cardmarket, cardkingdom), best price highlighted, and 7-day price trend.
result: pass

### 4. Remove Card from Wishlist
expected: DELETE /api/wishlist/[card_id] removes card from wishlist. Returns 204 No Content on success. Removing non-existent card returns 404 error.
result: skipped
reason: Cannot test - DELETE endpoint returns 500 Internal Server Error (documented in Test 2 issue)

### 5. Search Cards by Name
expected: GET /api/cards/search?q=query returns up to 10 matching cards with oracleId, name, set, and imageUrl. Search is case-insensitive and requires minimum 2 characters.
result: pass

### 6. Get Card Details
expected: GET /api/cards/[oracle_id] returns full card metadata (oracleId, name, set, rarity, color, imageUrl). Returns 404 if oracle_id not found.
result: pass

### 7. Compare Prices Across Sources
expected: GET /api/prices/[oracle_id] returns latest prices from all 4 sources, best price identified (minimum across sources), and price trend vs 7 days ago (up/down/stable with % change).
result: pass

### 8. Web Dashboard Home Page
expected: Opening http://localhost:3000 displays home page with navigation header, overview of the application, and quick stats. Layout is responsive on mobile and desktop.
result: pass

### 9. Web Dashboard Wishlist Page
expected: Opening http://localhost:3000/wishlist displays user's wishlist as responsive card grid (1-4 columns depending on screen width). Each card shows image, name, set, and current price.
result: pass

### 10. Search Bar Autocomplete
expected: Typing in the search bar on wishlist page shows autocomplete dropdown with matching cards after 300ms debounce. Clicking a card adds it to wishlist with success toast notification.
result: skipped
reason: Requires browser-based interaction testing (cannot test via curl)

### 11. Bulk Remove Cards
expected: Selecting multiple cards via checkboxes and clicking "Remove Selected" shows confirmation dialog. Confirming removes all selected cards from wishlist and updates grid.
result: skipped
reason: Cannot test - depends on DELETE endpoint bug (Test 2 issue) and requires browser interaction

### 12. Price Comparison Table
expected: Clicking a card opens price comparison table showing all 4 sources with prices, best price highlighted, and price trend indicator. Table is horizontally scrollable on mobile.
result: skipped
reason: Requires browser-based interaction testing (cannot test via curl)

### 13. Empty Wishlist State
expected: When wishlist is empty, page shows empty state component with message and suggested cards to add. No broken UI or missing components.
result: skipped
reason: Cannot test - DELETE endpoint bug prevents emptying wishlist (Test 2 issue)

### 14. Bot Add Command - Exact Match
expected: Sending /add Black Lotus to bot adds "Black Lotus" card to wishlist and confirms with success message. Card appears in both bot /list and web dashboard.
result: skipped
reason: Requires Telegram bot integration testing (cannot automate without Telegram client)

### 15. Bot Add Command - Multiple Matches
expected: Sending /add Thoughtseize with multiple matches shows numbered list. Replying with number adds that card to wishlist. Invalid number shows error message.
result: skipped
reason: Requires Telegram bot integration testing

### 16. Bot Remove Command - By Name
expected: Sending /remove Black Lotus removes card from wishlist and confirms with success message. Card removed from both bot and web dashboard.
result: skipped
reason: Requires Telegram bot integration testing

### 17. Bot Remove Command - By Index
expected: Sending /list shows numbered wishlist. Sending /remove 3 removes card at index 3 from wishlist.
result: skipped
reason: Requires Telegram bot integration testing

### 18. Bot List Command
expected: Sending /list displays wishlist as numbered list with card names, best prices with source, and price trend indicators (↑↓±). Long wishlists split across multiple messages.
result: skipped
reason: Requires Telegram bot integration testing

### 19. Bot Price Command
expected: Sending /price Black Lotus shows best price across all 4 sources with source name, price in BRL, and 7-day trend percentage.
result: skipped
reason: Requires Telegram bot integration testing

### 20. Bot Rate Limiting
expected: Sending /list or /price commands rapidly (more than 10/minute) returns rate limit error message: "Too many requests. Please wait a minute."
result: skipped
reason: Requires Telegram bot integration testing

## Summary

total: 20
passed: 7
issues: 1
pending: 0
skipped: 12

## Gaps

- truth: "POST /api/wishlist adds card, returns 409 on duplicate, DELETE /api/wishlist/[card_id] removes card"
  status: failed
  reason: "User reported: Authentication works and POST successfully adds cards. However: 1) Duplicate detection doesn't work - same card added twice instead of returning 409. 2) DELETE /api/wishlist/[card_id] returns 500 Internal Server Error."
  severity: major
  test: 2
  root_cause: "Two separate issues: 1) DELETE bug in src/lib/wishlist/queries.ts:175 - null check missing (result.length fails when result is null). 2) Duplicate detection bug - missing unique constraint on (userId, cardId) in wishlists table schema (src/db/schema/wishlists.ts)"
  artifacts:
    - path: "src/lib/wishlist/queries.ts"
      issue: "Line 175 checks result.length without null check - .delete().returning() can return null"
      fix: "Change to: if (!result || result.length === 0)"
    - path: "src/db/schema/wishlists.ts"
      issue: "Missing unique constraint on (userId, cardId) combination"
      fix: "Add unique constraint: uniqueUserCard: unique().on(table.userId, table.cardId)"
  missing:
    - "Add unique constraint to wishlists schema"
    - "Create migration to add unique constraint to existing database table"
    - "Add null check to removeCardFromWishlist function"
  debug_session: "afb6225, ac5d74a"
