---
phase: 01
slug: foundation-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x |
| **Config file** | vitest.config.ts (Wave 0 creates) |
| **Quick run command** | `pnpm test --related` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --related`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-00-01 | 00 | 0 | - | setup | `pnpm vitest --run --version` | ✅ vitest.config.ts | ⬜ pending |
| 01-00-02 | 00 | 0 | PRICE-06 | stub | `grep -l "should define users table" src/db/__tests__/*.test.ts` | ✅ All 3 db stubs | ⬜ pending |
| 01-00-03 | 00 | 0 | AUTH-01, AUTH-02 | stub | `grep -l "should hash password" src/lib/auth/__tests__/*.test.ts` | ✅ All 4 auth stubs | ⬜ pending |
| 01-00-04 | 00 | 0 | PRICE-08 | stub | `grep -l "should allow requests" src/lib/ratelimit/__tests__/*.test.ts` | ✅ All 2 rate limiter stubs | ⬜ pending |
| 01-00-05 | 00 | 0 | AUTH-02 | stub | `grep -l "should allow access" src/web/__tests__/middleware.test.ts` | ✅ middleware stub | ⬜ pending |
| 01-01-01 | 01 | 1 | - | integration | `pnpm install && pnpm next dev -- --version` | ✅ package.json | ⬜ pending |
| 01-01-02 | 01 | 1 | - | integration | `pnpm biome check . && pnpm vitest --run` | ✅ biome.json, vitest.config.ts | ⬜ pending |
| 01-01-03 | 01 | 1 | - | integration | `ls -la src/ && test -d src/api && test -d src/bot` | ✅ All src/ dirs | ⬜ pending |
| 01-02-01 | 02 | 1 | PRICE-08 | unit | `cat src/db/schema/index.ts \| grep -E "export.*users\|export.*cards\|export.*prices\|export.*wishlists"` | ✅ schema files | ⬜ pending |
| 01-02-02 | 02 | 1 | PRICE-08 | unit | `grep -q "drizzle-orm" src/db/index.ts && test -f drizzle.config.ts` | ✅ db files | ⬜ pending |
| 01-02-03 | 02 | 1 | PRICE-08 | integration | `grep -q "create_hypertable" drizzle/0001_timescale_hypertable.sql` | ✅ TimescaleDB SQL | ⬜ pending |
| 01-03-01 | 03 | 2 | PRICE-06 | tdd | `pnpm test src/lib/rate-limiter.test.ts` | ✅ rate-limiter.test.ts | ⬜ pending |
| 01-03-02 | 03 | 2 | PRICE-06 | integration | `grep -q "export.*function.*middleware" middleware.ts && grep -q "matcher.*api/external" middleware.ts` | ✅ middleware.ts | ⬜ pending |
| 01-04-01 | 04 | 2 | AUTH-01 | tdd | `pnpm test src/lib/auth.test.ts` | ✅ auth.test.ts | ⬜ pending |
| 01-04-02 | 04 | 2 | AUTH-02 | integration | `grep -q "export.*async.*function.*POST" app/api/auth/login/route.ts && grep -q "cookies.set.*auth_token" app/api/auth/login/route.ts` | ✅ login route | ⬜ pending |
| 01-04-03 | 04 | 2 | AUTH-02 | integration | `grep -q "export.*async.*function.*POST" app/api/auth/logout/route.ts && grep -q "cookies.delete.*auth_token" app/api/auth/logout/route.ts` | ✅ logout route | ⬜ pending |
| 01-04-04 | 04 | 2 | AUTH-01 | integration | `grep -q "export.*async.*function.*POST" app/api/auth/link-telegram/route.ts && grep -q "telegramChatId" app/api/auth/link-telegram/route.ts` | ✅ link-telegram route | ⬜ pending |
| 01-04-05 | 04 | 2 | AUTH-02 | integration | `grep -q "export.*function.*middleware" middleware.ts && grep -q "matcher.*dashboard" middleware.ts` | ✅ middleware.ts | ⬜ pending |
| 01-05-01 | 05 | 3 | AUTH-01 | integration | `grep -q "export.*bot" src/lib/telegram.ts && grep -q "TELEGRAM_CHAT_ID" src/bot/middleware/whitelist.ts` | ✅ telegram files | ⬜ pending |
| 01-05-02 | 05 | 3 | AUTH-01 | integration | `grep -q "bot.command.*start" src/bot/commands/start.ts && grep -q "comparePassword" src/bot/commands/start.ts` | ✅ start command | ⬜ pending |
| 01-05-03 | 05 | 3 | AUTH-01 | checkpoint | Human verification after bot startup | ✅ bot started | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 01-00 (Wave 0) creates all test infrastructure BEFORE implementation:

- [x] `vitest.config.ts` — Vitest configuration with jsdom environment, globals enabled
- [x] `test/setup.ts` — Testing Library setup and global test utilities
- [x] `src/db/__tests__/schema.test.ts` — stubs for PRICE-06 (3 tests)
- [x] `src/db/__tests__/migrations.test.ts` — stubs for PRICE-06 (4 tests)
- [x] `src/db/__tests__/hypertables.test.ts` — stubs for PRICE-06 (3 tests)
- [x] `src/lib/auth/__tests__/hash.test.ts` — stubs for AUTH-01 (3 tests)
- [x] `src/lib/auth/__tests__/jwt.test.ts` — stubs for AUTH-01 (4 tests)
- [x] `src/api/auth/__tests__/login.test.ts` — stubs for AUTH-02 (4 tests)
- [x] `src/bot/__tests__/telegram.test.ts` — stubs for AUTH-01 (4 tests)
- [x] `src/lib/ratelimit/__tests__/token-bucket.test.ts` — stubs for PRICE-08 (6 tests)
- [x] `src/lib/ratelimit/__tests__/redis.test.ts` — stubs for PRICE-08 (4 tests)
- [x] `src/web/__tests__/middleware.test.ts` — stubs for AUTH-02 (6 tests)

**Total: 11 test stub files covering all Phase 1 requirements**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Telegram bot webhook receives update | AUTH-01 | Requires external Telegram service | 1. Start dev server 2. Send message to bot via Telegram app 3. Verify webhook received |
| Redis connection persists rate limit state | PRICE-06 | External Redis service | 1. Run rate limit test 2. Verify Redis key exists 3. Restart server 4. Verify state persisted |
| TimescaleDB chunk performance | PRICE-08 | Requires actual data volume | 1. Insert 50K+ rows 2. Run EXPLAIN ANALYZE on time-series query 3. Verify index usage |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01-00 created)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter
- [x] AUTH-02 logout endpoint added (Task 01-04-03)
- [x] Rate limiter middleware wired to root middleware.ts (Task 01-03-02)

**Approval:** pending

---

## Revision Notes

**2026-03-05 Revision:**
- Created Plan 01-00 (Wave 0) to satisfy Nyquist compliance
- Added logout endpoint to Plan 01-04 (AUTH-02 now complete with login+logout)
- Fixed Plan 01-03 to wire rate limiter to root middleware.ts
- Updated all verification commands to match actual implementations
- Wave structure: 00→Wave 0, 01-02→Wave 1, 03-04→Wave 2, 05→Wave 3
