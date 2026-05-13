---
phase: 9
slug: api-db-integration-tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.9 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/api/__tests__/cards/search.test.ts` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~15–30 seconds (integration tests with real DB) |

---

## Sampling Rate

- **After every task commit:** Run the relevant test file (`search.test.ts` or `actions.test.ts`)
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite must be green with 0 skipped tests
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| DB helpers | 01 | 0 | TEST-08, TEST-09 | — | N/A | — | verify file exists at `src/test/helpers/db.ts` | ❌ W0 | ⬜ pending |
| searchCards extraction | 01 | 1 | TEST-08 | — | N/A | integration | `npx vitest run src/api/__tests__/cards/search.test.ts` | ✅ | ⬜ pending |
| search tests activation | 01 | 1 | TEST-08 | — | N/A | integration | `npx vitest run src/api/__tests__/cards/search.test.ts` | ✅ | ⬜ pending |
| wishlist tests activation | 01 | 2 | TEST-09 | — | N/A | integration | `npx vitest run src/lib/wishlist/__tests__/actions.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/helpers/db.ts` — new no-param helper file (D-01, D-02, D-13)
- [ ] `test/setup.ts` — verify DB credentials match docker-compose (`mtgprice:mtgprice_password`)

*DB credential mismatch found in research: `test/setup.ts` hardcodes `postgres:postgres` but docker-compose uses `mtgprice:mtgprice_password`. Must resolve before any integration test can connect.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No data bleeding between test runs | TEST-08, TEST-09 | Visual check across test runs | Run `pnpm test:run` twice consecutively — second run must not fail due to leftover data |
| FK violation surfaces as PostgreSQL error | TEST-09 | Error message may vary by PG version | Run actions.test.ts and confirm FK violation test passes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
