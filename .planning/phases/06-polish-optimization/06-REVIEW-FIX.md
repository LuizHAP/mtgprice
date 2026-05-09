---
phase: 06
fixed_at: 2026-05-09T00:00:00Z
fix_scope: critical_warning
findings_in_scope: 3
fixed: 3
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed:** 2026-05-09
**Scope:** critical_warning (High + Medium)
**Findings in scope:** 3
**Fixed:** 3 / Skipped: 0
**Status:** all_fixed

---

## HI-01: `process.env = undefined` pollutes environment across test files — FIXED

**Commit:** `fix(06): HI-01 — use delete to restore env vars in retry tests`
**Commit:** `fix(06): HI-01 — use delete to restore TELEGRAM_CHAT_ID in circuit-breaker tests`

**Files changed:**
- `src/lib/__tests__/retry.test.ts` — afterEach now uses `delete process.env.SCRAPER_RETRY_ATTEMPTS` and `delete process.env.SCRAPER_RETRY_BASE_DELAY_MS` when vars were absent before the test; line 93 also uses `delete` to simulate an unset var
- `src/scraper/__tests__/circuit-breaker.test.ts` — afterEach now uses `delete process.env.TELEGRAM_CHAT_ID` when `originalChatId` was undefined

Biome's `lint/performance/noDelete` rule was suppressed with inline `biome-ignore` comments — `delete` is semantically required for `process.env` keys; assigning `undefined` coerces to the string `"undefined"`.

---

## ME-01: Circuit-breaker Telegram guard missing `TELEGRAM_BOT_TOKEN` — FIXED

**Commit:** `fix(06): ME-01 — guard TELEGRAM_BOT_TOKEN alongside TELEGRAM_CHAT_ID`

**File changed:**
- `src/scraper/circuit-breaker.ts:78-82` — guard now reads both `TELEGRAM_CHAT_ID` and `TELEGRAM_BOT_TOKEN` and returns early if either is absent, preventing misleading caught errors when only one is configured

---

## ME-02: Progress log uses submission index instead of completion count — FIXED

**Commit:** `fix(06): ME-02 — use completion counter instead of submission index for progress log`

**File changed:**
- `src/scraper/orchestrator.ts:237-257` — replaced `(oracleId, i)` map with `(oracleId)` map and a `let completedCount = 0` counter incremented inside the task closure (both success and error paths), ensuring progress reports reflect actual completion order under p-limit concurrency

---

## Out of Scope (not fixed)

- **LO-01** (`Number(env) || fallback` silently ignores `0`) — Low severity, outside critical_warning scope
- **IN-01** (D-06 ordering test uses source-text position check) — Info severity, outside critical_warning scope

---

_Fixed: 2026-05-09_
_Fixer: Claude (gsd-code-fixer)_
_Scope: critical_warning_
