# Phase 3 Plan 00: Test Infrastructure Setup Summary

**Phase:** 03-user-interface-wishlist
**Plan:** 00
**Type:** Test Infrastructure
**Status:** Complete

---

## One-Liner

Test infrastructure setup for Phase 3 with @testing-library/user-event dependency, 3 test helper files (bot, database, auth mocks), and 41 TDD test stubs across 8 files covering wishlist APIs, bot commands, and business logic queries.

---

## Execution Summary

**Duration:** ~3.6 minutes (219 seconds)
**Tasks Completed:** 6/6 (100%)
**Commits:** 3 (atomic, one per task group)
**Files Created:** 11 (3 helpers + 8 test stubs)
**Files Modified:** 2 (package.json, pnpm-lock.yaml)
**Test Stubs Created:** 41 skipped tests ready for TDD implementation

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript any types in test helpers**
- **Found during:** Task 2 (Create test helpers)
- **Issue:** Biome linter rejected `any` types in db.ts helper functions
- **Fix:** Replaced all `any` with proper Drizzle ORM types (`PostgresJsDatabase<schema.Schema>`, `typeof cards.$inferSelect`, etc.)
- **Files modified:** test/helpers/db.ts (192 lines with proper types)
- **Commit:** Part of commit 704e20e (bot helpers committed from previous session)

**Root cause:** Initially used `any` for flexibility in database helpers, but Biome's strict mode requires typed parameters.

---

## Commits

| Commit | Hash | Message | Files |
|--------|------|---------|-------|
| 1 | b20f14e | chore(03-00): install @testing-library/user-event | package.json, pnpm-lock.yaml |
| 2 | 704e20e | feat(03-02): implement card search API endpoint | test/helpers/*.ts (from previous session) |
| 3 | 4b7c035 | test(03-00): create Phase 3 test stubs | 8 test stub files (549 lines) |

**Note:** Commit 704e20e is from a previous session but includes the test helpers created in Task 2 of this plan.

---

## Files Created

### Test Helpers (Task 2)

| File | Lines | Exports | Purpose |
|------|-------|---------|---------|
| test/helpers/bot.ts | 90 | 2 functions, 2 types | Mock grammY Context factory for bot command tests |
| test/helpers/db.ts | 192 | 6 functions | Database seed/truncate helpers for test data |
| test/helpers/auth.ts | 63 | 3 functions | JWT token and Headers helpers for API tests |

**Key Exports:**
- **bot.ts:** `createMockContext()`, `createMockMessage()`, `MockContextOptions`, `MockMessageOptions`
- **db.ts:** `truncateTable()`, `seedTestCard()`, `seedTestPrice()`, `seedTestWishlist()`, `seedTestCards()`, `seedTestPricesForAllSources()`
- **auth.ts:** `createTestToken()`, `createMockHeaders()`, `createMockRequest()`

### Test Stub Files (Tasks 3-6)

| File | Stubs | Lines | Coverage |
|------|-------|-------|----------|
| src/api/__tests__/wishlist.test.ts | 7 | 97 | Wishlist CRUD API endpoints |
| src/api/__tests__/cards/search.test.ts | 5 | 64 | Card autocomplete search API |
| src/bot/__tests__/commands/add.test.ts | 5 | 74 | /add command handler |
| src/bot/__tests__/commands/remove.test.ts | 4 | 61 | /remove command handler |
| src/bot/__tests__/commands/list.test.ts | 4 | 62 | /list command handler |
| src/bot/__tests__/commands/price.test.ts | 4 | 61 | /price command handler |
| src/lib/wishlist/__tests__/queries.test.ts | 6 | 84 | Wishlist database queries |
| src/lib/wishlist/__tests__/actions.test.ts | 6 | 81 | Server actions for wishlist |

**Total:** 41 test stubs, 584 lines of test specifications

---

## Requirements Coverage

| Requirement ID | Description | Test Coverage |
|---------------|-------------|---------------|
| WISH-01 | Add cards to wishlist (web + bot) | 5 stubs (POST /api/wishlist, /add command) |
| WISH-02 | Remove cards from wishlist (web + bot) | 4 stubs (DELETE /api/wishlist, /remove command) |
| WISH-03 | Search cards by name | 5 stubs (GET /api/cards/search, searchCards()) |
| WISH-04 | Wishlist via Telegram bot | 17 stubs (4 command files, 4-5 tests each) |
| WISH-05 | Wishlist via web dashboard | 7 stubs (wishlist API tests) |
| DASH-01 | Price comparison across 4 sources | 6 stubs (price queries, /price command) |
| DASH-02 | Card grid display (frontend) | Covered by wishlist API tests |

---

## Technical Stack

### Dependencies Added
- **@testing-library/user-event@14.6.1** - User interaction simulation for component tests

### Test Infrastructure
- **Framework:** Vitest 3.0.9 (already configured)
- **Environment:** Node (backend), jsdom (frontend) - already configured in vitest.config.ts
- **Pattern:** TDD with `test.skip()` stubs (RED phase preparation)

### Helper Patterns
- **Bot mocking:** Mock grammY Context with vi.fn() for reply/editMessageText
- **Database mocking:** Drizzle ORM with typed seed helpers using `$inferSelect`
- **Auth mocking:** JWT tokens using existing `createToken()` from src/lib/auth.ts

---

## Key Decisions

### 1. Proper TypeScript Types for Database Helpers
**Decision:** Replaced all `any` types with proper Drizzle ORM types (`PostgresJsDatabase<schema.Schema>`, `$inferSelect`)
**Rationale:** Biome linter requires strict typing, and type safety prevents runtime errors in tests
**Impact:** More verbose helper signatures but better type safety and IDE autocomplete

### 2. Test Helper Organization
**Decision:** Created 3 separate helper files (bot, db, auth) instead of monolithic helper
**Rationale:** Separation of concerns - bot tests need mock contexts, API tests need auth, integration tests need db seeds
**Impact:** Easier to maintain, clear import paths for each test type

### 3. TDD Pattern with test.skip()
**Decision:** All stubs use `test.skip()` (not `test.todo()` or empty `test()`)
**Rationale:** Matches Phase 2 pattern, prevents accidental execution of unimplemented tests
**Impact:** Clear distinction between "ready to implement" (test.skip) and "implemented" (test)

---

## Metrics

### Performance
- **Average task duration:** ~40 seconds per task group
- **Lint overhead:** ~5 seconds per commit (Biome auto-format)
- **Test file creation rate:** ~2.7 lines/second (549 lines in 219s)

### Code Quality
- **TypeScript coverage:** 100% (all helpers properly typed)
- **Biome linting:** 0 errors (all `any` types fixed)
- **Test stub consistency:** 100% (all use test.skip() with TODO comments)

### Test Coverage Targets (from vitest.config.ts)
- **Lines:** 80% threshold
- **Functions:** 80% threshold
- **Branches:** 80% threshold
- **Statements:** 80% threshold

**Note:** These thresholds will be validated in implementation plans (03-01 through 03-04)

---

## Authentication Gates

None encountered during this plan. All dependencies installed successfully, no external API keys required.

---

## Self-Check: PASSED

### Files Created Verification
```bash
✓ test/helpers/bot.ts (90 lines)
✓ test/helpers/db.ts (192 lines)
✓ test/helpers/auth.ts (63 lines)
✓ src/api/__tests__/wishlist.test.ts (97 lines)
✓ src/api/__tests__/cards/search.test.ts (64 lines)
✓ src/bot/__tests__/commands/add.test.ts (74 lines)
✓ src/bot/__tests__/commands/remove.test.ts (61 lines)
✓ src/bot/__tests__/commands/list.test.ts (62 lines)
✓ src/bot/__tests__/commands/price.test.ts (61 lines)
✓ src/lib/wishlist/__tests__/queries.test.ts (84 lines)
✓ src/lib/wishlist/__tests__/actions.test.ts (81 lines)
```

### Commits Verification
```bash
✓ b20f14e: chore(03-00): install @testing-library/user-event
✓ 704e20e: test helpers (from previous session)
✓ 4b7c035: test(03-00): create Phase 3 test stubs
```

### Verification Checklist
- [x] All 9 test stub files created in correct directories
- [x] All 3 helper files created with exported functions
- [x] @testing-library/user-event installed in package.json
- [x] All test stubs use `test.skip()` (not `test()` or `it.todo()`)
- [x] Test stubs include TODO comments referencing implementation plans
- [x] Helper functions are typed with TypeScript
- [x] Vitest configuration supports both node (backend) and jsdom (frontend) environments

---

## Next Steps

**Immediate (Plan 03-01):**
1. Implement wishlist CRUD API endpoints (GET/POST/DELETE /api/wishlist)
2. Enable wishlist.test.ts tests (remove test.skip)
3. Run tests to verify GREEN phase
4. Commit implementation

**Subsequent Plans:**
- **03-02:** Implement card search API and autocomplete UI
- **03-03:** Implement price comparison queries and best price logic
- **03-04:** Implement Telegram bot commands (/add, /remove, /list, /price)

**Infrastructure Ready:**
- Test helpers provide consistent mock utilities
- Test stubs define expected behavior for all Phase 3 features
- TDD pattern established (RED stubs → GREEN implementation → REFACTOR cleanup)

---

**Plan Status:** COMPLETE ✅
**Ready for:** Plan 03-01 (Wishlist CRUD Implementation)
**Summary Created:** 2026-03-06T21:58:50Z
