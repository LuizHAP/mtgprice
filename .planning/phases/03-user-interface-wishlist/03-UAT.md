---
status: testing
phase: 03-user-interface-wishlist
source: [03-00-SUMMARY.md, 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-03-07T12:00:00Z
updated: 2026-03-07T12:05:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 2
name: Add Card to Wishlist via API
expected: |
  POST /api/wishlist with cardId adds card to user's wishlist. Returns success response with cardId. Duplicate requests return 409 error with "Card already in wishlist" message.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: issue
reported: "Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin. The PostCSS plugin has moved to a separate package, so to continue using Tailwind CSS with PostCSS you'll need to install `@tailwindcss/postcss` and update your PostCSS configuration."
severity: blocker

### 2. Add Card to Wishlist via API
expected: POST /api/wishlist with cardId adds card to user's wishlist. Returns success response with cardId. Duplicate requests return 409 error with "Card already in wishlist" message.
result: pending

### 3. View Wishlist with Prices
expected: GET /api/wishlist returns user's wishlist as array of cards with latest prices from all 4 sources (liga_magic, tcgplayer, cardmarket, cardkingdom), best price highlighted, and 7-day price trend.
result: pending

### 4. Remove Card from Wishlist
expected: DELETE /api/wishlist/[card_id] removes card from wishlist. Returns 204 No Content on success. Removing non-existent card returns 404 error.
result: pending

### 5. Search Cards by Name
expected: GET /api/cards/search?q=query returns up to 10 matching cards with oracleId, name, set, and imageUrl. Search is case-insensitive and requires minimum 2 characters.
result: pending

### 6. Get Card Details
expected: GET /api/cards/[oracle_id] returns full card metadata (oracleId, name, set, rarity, color, imageUrl). Returns 404 if oracle_id not found.
result: pending

### 7. Compare Prices Across Sources
expected: GET /api/prices/[oracle_id] returns latest prices from all 4 sources, best price identified (minimum across sources), and price trend vs 7 days ago (up/down/stable with % change).
result: pending

### 8. Web Dashboard Home Page
expected: Opening http://localhost:3000 displays home page with navigation header, overview of the application, and quick stats. Layout is responsive on mobile and desktop.
result: pending

### 9. Web Dashboard Wishlist Page
expected: Opening http://localhost:3000/wishlist displays user's wishlist as responsive card grid (1-4 columns depending on screen width). Each card shows image, name, set, and current price.
result: pending

### 10. Search Bar Autocomplete
expected: Typing in the search bar on wishlist page shows autocomplete dropdown with matching cards after 300ms debounce. Clicking a card adds it to wishlist with success toast notification.
result: pending

### 11. Bulk Remove Cards
expected: Selecting multiple cards via checkboxes and clicking "Remove Selected" shows confirmation dialog. Confirming removes all selected cards from wishlist and updates grid.
result: pending

### 12. Price Comparison Table
expected: Clicking a card opens price comparison table showing all 4 sources with prices, best price highlighted, and price trend indicator. Table is horizontally scrollable on mobile.
result: pending

### 13. Empty Wishlist State
expected: When wishlist is empty, page shows empty state component with message and suggested cards to add. No broken UI or missing components.
result: pending

### 14. Bot Add Command - Exact Match
expected: Sending /add Black Lotus to bot adds "Black Lotus" card to wishlist and confirms with success message. Card appears in both bot /list and web dashboard.
result: pending

### 15. Bot Add Command - Multiple Matches
expected: Sending /add Thoughtseize with multiple matches shows numbered list. Replying with number adds that card to wishlist. Invalid number shows error message.
result: pending

### 16. Bot Remove Command - By Name
expected: Sending /remove Black Lotus removes card from wishlist and confirms with success message. Card removed from both bot and web dashboard.
result: pending

### 17. Bot Remove Command - By Index
expected: Sending /list shows numbered wishlist. Sending /remove 3 removes card at index 3 from wishlist.
result: pending

### 18. Bot List Command
expected: Sending /list displays wishlist as numbered list with card names, best prices with source, and price trend indicators (↑↓±). Long wishlists split across multiple messages.
result: pending

### 19. Bot Price Command
expected: Sending /price Black Lotus shows best price across all 4 sources with source name, price in BRL, and 7-day trend percentage.
result: pending

### 20. Bot Rate Limiting
expected: Sending /list or /price commands rapidly (more than 10/minute) returns rate limit error message: "Too many requests. Please wait a minute."
result: pending

## Summary

total: 20
passed: 0
issues: 1
pending: 19
skipped: 0

## Gaps

- truth: "Server boots without errors and returns live data on cold start"
  status: failed
  reason: "User reported: Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin. The PostCSS plugin has moved to a separate package, so to continue using Tailwind CSS with PostCSS you'll need to install `@tailwindcss/postcss` and update your PostCSS configuration."
  severity: blocker
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
