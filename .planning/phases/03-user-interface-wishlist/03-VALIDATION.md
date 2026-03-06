---
phase: 3
slug: user-interface-wishlist
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0.9 |
| **Config file** | vitest.config.ts (exists from Phase 1) |
| **Quick run command** | `npm run test:run` |
| **Full suite command** | `npm run test:run -- --coverage` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run`
- **After every plan wave:** Run `npm run test:run -- --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-00-01 | 00 | 0 | Foundation | unit | `grep "@testing-library/user-event" package.json` | ❌ W0 | ⬜ pending |
| 03-00-02 | 00 | 0 | Foundation | unit | `npm run test:run test/helpers/bot.test.ts \|\| ls test/helpers/` | ✅ W0 | ⬜ pending |
| 03-00-03 | 00 | 0 | WISH-01, WISH-02 | integration | `ls src/api/__tests__/wishlist.test.ts && grep "test.skip" src/api/__tests__/wishlist.test.ts \| wc -l` | ❌ W0 | ⬜ pending |
| 03-00-04 | 00 | 0 | WISH-03, DASH-01 | integration | `ls src/api/__tests__/cards/search.test.ts && grep "test.skip" src/api/__tests__/cards/search.test.ts \| wc -l` | ❌ W0 | ⬜ pending |
| 03-00-05 | 00 | 0 | WISH-04 | integration | `ls src/bot/__tests__/commands/*.test.ts && grep -c "test.skip" src/bot/__tests__/commands/*.test.ts` | ❌ W0 | ⬜ pending |
| 03-00-06 | 00 | 0 | DASH-01 | integration | `ls src/lib/wishlist/__tests__/*.test.ts && grep -c "test.skip" src/lib/wishlist/__tests__/*.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-01 | 01 | 1 | WISH-01, WISH-02 | unit | `grep -c "export type" src/types/wishlist.ts` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | WISH-01, WISH-02 | unit | `npm run test:run src/lib/wishlist/__tests__/validators.test.ts \|\| grep "export const.*Schema" src/lib/wishlist/validators.ts` | ✅ | ⬜ pending |
| 03-01-03 | 01 | 1 | WISH-01, WISH-02 | integration | `npm run test:run src/lib/wishlist/__tests__/queries.test.ts` | ✅ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | WISH-01 | integration | `npm run test:run src/api/__tests__/wishlist.test.ts` | ✅ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | WISH-02 | integration | `npm run test:run src/api/__tests__/wishlist.test.ts` | ✅ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | WISH-03 | integration | `npm run test:run src/api/__tests__/cards/search.test.ts` | ✅ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | DASH-01 | integration | `npm run test:run src/api/__tests__/cards/details.test.ts \|\| curl -s http://localhost:3000/api/cards/test-oracle` | ✅ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | DASH-01 | integration | `npm run test:run src/api/__tests__/prices/comparison.test.ts \|\| curl -s http://localhost:3000/api/prices/test-oracle` | ✅ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | Foundation | manual | User installs Shadcn/ui components (checkpoint:human-action) | ✅ | ⬜ pending |
| 03-03-02 | 03 | 2 | WISH-05 | unit | `grep -c "export" src/components/layout/Header.tsx src/components/layout/Footer.tsx` | ✅ | ⬜ pending |
| 03-03-03 | 03 | 2 | WISH-03 | integration | `npm run test:run src/web/__tests__/components/SearchBar.test.ts \|\| manual testing in browser` | ✅ W0 | ⬜ pending |
| 03-03-04 | 03 | 2 | WISH-05 | integration | `npm run test:run src/web/__tests__/components/CardGrid.test.ts \|\| manual testing in browser` | ✅ W0 | ⬜ pending |
| 03-03-05 | 03 | 2 | DASH-01 | integration | `npm run test:run src/web/__tests__/components/PriceTable.test.ts \|\| manual testing in browser` | ✅ W0 | ⬜ pending |
| 03-03-06 | 03 | 2 | WISH-05 | unit | `grep -c "export" src/components/wishlist/EmptyState.tsx` | ✅ | ⬜ pending |
| 03-03-07 | 03 | 2 | WISH-05 | integration | `npm run build && grep -c "export default" src/app/wishlist/page.tsx` | ✅ | ⬜ pending |
| 03-03-08 | 03 | 2 | DASH-02 | integration | `npm run build && curl -I http://localhost:3000/` | ✅ | ⬜ pending |
| 03-04-01 | 04 | 2 | WISH-04 | unit | `npm run test:run src/bot/__tests__/utils/format.test.ts \|\| grep -c "export" src/bot/utils/format.ts` | ✅ | ⬜ pending |
| 03-04-02 | 04 | 2 | WISH-04 | unit | `npm run test:run src/bot/__tests__/middleware/rate-limit.test.ts \|\| grep -c "export" src/bot/middleware/rate-limit.ts` | ✅ | ⬜ pending |
| 03-04-03 | 04 | 2 | WISH-01, WISH-03 | integration | `npm run test:run src/bot/__tests__/commands/add.test.ts` | ✅ W0 | ⬜ pending |
| 03-04-04 | 04 | 2 | WISH-02 | integration | `npm run test:run src/bot/__tests__/commands/remove.test.ts` | ✅ W0 | ⬜ pending |
| 03-04-05 | 04 | 2 | WISH-05 | integration | `npm run test:run src/bot/__tests__/commands/list.test.ts` | ✅ W0 | ⬜ pending |
| 03-04-06 | 04 | 2 | DASH-01 | integration | `npm run test:run src/bot/__tests__/commands/price.test.ts` | ✅ W0 | ⬜ pending |
| 03-04-07 | 04 | 2 | WISH-04 | integration | `grep -c "import.*commands" src/bot/index.ts && npm run bot:dev (check startup logs for /add, /remove, /list, /price)` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/helpers/bot.test.ts` — bot conversation test helpers
- [ ] `test/helpers/db.test.ts` — database test fixtures
- [ ] `test/helpers/auth.test.ts` — authentication test helpers
- [ ] `src/api/__tests__/wishlist.test.ts` — wishlist API stubs (WISH-01, WISH-02)
- [ ] `src/api/__tests__/cards/search.test.ts` — card search stubs (WISH-03)
- [ ] `src/bot/__tests__/commands/*.test.ts` — bot command stubs (WISH-04)
- [ ] `src/lib/wishlist/__tests__/*.test.ts` — wishlist query stubs (DASH-01)
- [ ] `@testing-library/user-event` — installed via package.json

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shadcn/ui component installation | Foundation | Interactive CLI requires user input | Run `npx shadcn@latest add [component]` for 8 components |
| UI component visual testing | WISH-05, DASH-02 | Frontend visual feedback | Manual testing in browser: http://localhost:3000/wishlist |
| Bot command interaction flow | WISH-04 | Multi-step conversation flows | Manual testing via Telegram: /add (search), select from list |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
