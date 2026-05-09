---
phase: 07-auth-rate-limit-tests
plan: 01
subsystem: auth-tests
tags: [testing, auth, bcrypt, jwt, TEST-01, TEST-02]
requirements: [TEST-01, TEST-02]
dependency_graph:
  requires: []
  provides: [TEST-01, TEST-02]
  affects: [src/lib/auth/__tests__/hash.test.ts, src/lib/auth/__tests__/jwt.test.ts]
tech_stack:
  added: []
  patterns: [vitest-active-tests, bcrypt-real-call-unit-tests, jwt-expiresIn-negative-for-expired]
key_files:
  created: []
  modified:
    - src/lib/auth/__tests__/hash.test.ts
    - src/lib/auth/__tests__/jwt.test.ts
decisions:
  - "Used `bcrypt.getRounds(hash)` instead of regex-parsing hash string to assert 10 salt rounds — more idiomatic and robust"
  - "Used `jwt.sign(..., { expiresIn: -1 })` for expired-token test instead of vi.useFakeTimers() — avoids Vitest 3.x unhandled-rejection warnings with async mocks"
  - "Used `?? 0` fallback instead of `!` non-null assertions for exp/iat arithmetic — biome noNonNullAssertion rule compliance"
  - "Sorted imports per biome organizeImports — @/lib/auth/* before external packages"
metrics:
  duration_seconds: 310
  completed_date: "2026-05-09"
  tasks_completed: 2
  files_modified: 2
---

# Phase 7 Plan 1: Auth Unit Tests Activation Summary

**One-liner:** Activated 9 bcrypt + JWT unit tests (4 + 5) by replacing it.todo stubs with real implementations against existing password.ts and auth.ts modules.

## What Was Built

Two test files were fully activated — no new source code was written. All 9 previously-todo test cases now exercise real implementations:

**hash.test.ts** (TEST-01, D-01): 4 active bcrypt tests against `src/lib/auth/password.ts`
- `should hash password with 10 salt rounds` — asserts `bcrypt.getRounds(hash) === 10`
- `should compare correct password successfully` — asserts `comparePassword(pw, hash) === true`
- `should reject incorrect password` — asserts `comparePassword(wrong, hash) === false`
- `should generate different hashes for same password` — asserts `hash1 !== hash2` but both valid

**jwt.test.ts** (TEST-02, D-02): 5 active JWT tests against `src/lib/auth.ts` (root module)
- `should sign token with user payload` — asserts 3-part JWT shape + decoded userId/email
- `should verify valid token` — asserts verifyToken returns correct payload
- `should reject invalid token` — malformed + tampered-signature cases
- `should reject expired token` — uses `jwt.sign(..., { expiresIn: -1 })` for instant expiry
- `should include issued-at and expiration claims` — asserts iat/exp with ±2s tolerance for 86400s delta

## Files Modified

| File | Lines Before | Lines After | Change |
|------|-------------|------------|--------|
| `src/lib/auth/__tests__/hash.test.ts` | 39 | 45 | +6 lines (stubs → implementations) |
| `src/lib/auth/__tests__/jwt.test.ts` | 47 | 69 | +22 lines (stubs → implementations) |

## Test Counts

| File | Before | After | Delta |
|------|--------|-------|-------|
| hash.test.ts | 0 active, 4 todo | 4 active, 0 todo | +4 activated |
| jwt.test.ts | 0 active, 5 todo | 5 active, 0 todo | +5 activated |
| **Total** | **0 active, 9 todo** | **9 active, 0 todo** | **+9 activated** |

Full suite result: 136 passing | 200 skipped | 45 todo (was 127 passing | 200 skipped | 54 todo)

## Import Target Verification (D-01, D-02)

- **D-01 honored:** `hash.test.ts` imports from `@/lib/auth/password` (the dedicated password sub-module)
- **D-02 honored:** `jwt.test.ts` imports from `@/lib/auth` (the root auth module that exports `signToken`/`verifyToken`) — NOT from `@/lib/auth/index` or `@/lib/auth/password`

## JWT_SECRET Global Setup Confirmation

`process.env.JWT_SECRET` was NOT mutated in either test file. The global setup in `test/setup.ts` sets `JWT_SECRET = 'test-secret-key-for-jwt-signing'` — this was used as-is. No `beforeAll`/`afterAll` teardown was added (Pitfall 4 in 07-RESEARCH.md).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 — hash.test.ts (TEST-01) | `3a5cb6f` | test(07-01): activate bcrypt hash tests (TEST-01) |
| Task 2 — jwt.test.ts (TEST-02) | `862025e` | test(07-01): activate JWT tests (TEST-02) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome import order violations in both files**
- **Found during:** Task 1 and Task 2 post-write lint checks
- **Issue:** The reference implementation in the plan had external imports (`bcryptjs`, `jsonwebtoken`, `vitest`) listed before the internal `@/lib/auth/*` imports. Biome's `organizeImports` rule requires `@/` path imports to sort before external packages.
- **Fix:** Reordered imports to put `@/lib/auth/password` and `@/lib/auth` first, then external packages (`bcryptjs`, `jsonwebtoken`, `vitest`).
- **Files modified:** Both test files
- **Commits:** 3a5cb6f, 862025e

**2. [Rule 1 - Bug] Biome noNonNullAssertion violation in jwt.test.ts**
- **Found during:** Task 2 post-write lint check
- **Issue:** The plan's reference implementation used `payload.exp!` and `payload.iat!` non-null assertions for the arithmetic in the iat/exp claims test. Biome's `noNonNullAssertion` rule forbids this.
- **Fix:** Replaced `payload.exp! - payload.iat!` with explicit `?? 0` fallbacks: `const exp = payload.exp ?? 0; const iat = payload.iat ?? 0`. Semantically identical since both are defined after `expect(...).toBeDefined()` assertions above.
- **Files modified:** `src/lib/auth/__tests__/jwt.test.ts`
- **Commits:** 862025e

**3. [Rule 1 - Bug] Biome formatter violation in jwt.test.ts**
- **Found during:** Task 2 post-write lint check
- **Issue:** The plan's multi-line `jwt.sign({ ... }, secret, { expiresIn: -1 })` call was rejected by Biome formatter as it preferred a single-line form for short arguments.
- **Fix:** Collapsed to single line: `jwt.sign({ userId: 1, email: 'test@example.com' }, secret, { expiresIn: -1 })`
- **Files modified:** `src/lib/auth/__tests__/jwt.test.ts`
- **Commits:** 862025e

## Known Stubs

None. Both files have zero `it.todo` remaining.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes were introduced. This plan modifies only test files.
