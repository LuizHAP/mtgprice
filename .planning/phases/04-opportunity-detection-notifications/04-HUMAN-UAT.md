---
status: partial
phase: 04-opportunity-detection-notifications
source: [04-VERIFICATION.md]
started: 2026-05-08T16:02:44Z
updated: 2026-05-08T16:02:44Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Bot commands end-to-end (/history and /config)
expected: Send `/history` from the whitelisted Telegram chat — reply matches D-18 format exactly: header `📜 Últimas N oportunidades` followed by rows `[DD/MM HH:mm] ↓ Card Name — R$ PRICE (Source) — ↓N%`. Send `/config` — reply matches D-20 format exactly with current DETECT_* env var values.
result: [pending]

### 2. Whitelist authorization for new commands
expected: Send `/history` or `/config` from a non-whitelisted chat ID — bot replies with `Sorry, this bot is not available for public use.` and does not return any opportunity or config data. (Pre-existing pattern — needs runtime confirmation that the whitelist gate fires before command handler.)
result: [pending]

### 3. Scheduled pipeline end-to-end
expected: Trigger `executePriceCollection()` manually (or wait for a scheduled run) with real DB and wishlist data — detection runs after prices are collected, digest is sent to Telegram or silently skipped if no opportunities detected, and the collection return value shows `failed: 0` even if detection itself encounters an error.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
