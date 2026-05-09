---
phase: 5
slug: metagame-integration
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
last_audited: 2026-05-08
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `pnpm test:run -- src/scraper/metagame` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~26 seconds (metagame suite), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run -- src/scraper/metagame`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 26 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | — | — | N/A (infra only) | infra | `pnpm test:run -- src/scraper/metagame` | ✅ | ✅ green |
| 5-02-01 | 02 | 1 | META-01, META-02 | T-5-02-01, T-5-02-05, T-5-02-08 | Card names sanitized (max 255 chars), stale meta guard, fail-safe | unit | `pnpm test:run -- src/scraper/metagame/__tests__/mtgtop8.test.ts` | ✅ | ✅ green |
| 5-02-02 | 02 | 1 | META-03 | T-5-02-01, T-5-02-04 | Card names sanitized, fail-safe on network error, fallback path | unit | `pnpm test:run -- src/scraper/metagame/__tests__/edhrec.test.ts` | ✅ | ✅ green |
| 5-03-01 | 03 | 1 | META-01, META-02, META-03 | T-5-03-01, T-5-03-05, T-5-03-06, T-5-03-08 | Rate limit gated, empty oracle_id filtered, partial batch resilience | unit | `pnpm test:run -- src/scraper/metagame/__tests__/scryfall-resolver.test.ts` | ✅ | ✅ green |
| 5-04-01 | 04 | 2 | META-01, META-02, META-03 | T-5-04-01, T-5-04-02, T-5-04-03, T-5-04-06 | isAutoAdded filter on delete, FK ordering, multi-source resilience, row cap | unit | `pnpm test:run -- src/scraper/metagame/__tests__/orchestrator.test.ts` | ✅ | ✅ green |
| 5-05-01 | 05 | 2 | META-01, META-02, META-03 | T-5-05-01, T-5-05-07 | Cron registration, env override, callback resilience | unit | `pnpm test:run -- src/scheduler/__tests__/jobs.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Test Coverage Summary

| File | Tests | Status | Requirements Covered |
|------|-------|--------|---------------------|
| `src/scraper/metagame/__tests__/edhrec.test.ts` | 5 | ✅ all pass | META-03 |
| `src/scraper/metagame/__tests__/mtgtop8.test.ts` | 7 | ✅ all pass | META-01, META-02 |
| `src/scraper/metagame/__tests__/scryfall-resolver.test.ts` | 8 | ✅ all pass | META-01, META-02, META-03 |
| `src/scraper/metagame/__tests__/orchestrator.test.ts` | 9 | ✅ all pass | META-01, META-02, META-03 |
| `src/scheduler/__tests__/jobs.test.ts` | 5 | ✅ all pass | META-01, META-02, META-03 |
| **Total** | **34** | **✅ all pass** | All phase requirements |

---

## Wave 0 Requirements

- [x] `src/scraper/metagame/__tests__/edhrec.test.ts` — 5 real assertions for META-03 (Commander fetch)
- [x] `src/scraper/metagame/__tests__/mtgtop8.test.ts` — 7 real assertions for META-01, META-02 (mocked HTML)
- [x] `src/scraper/metagame/__tests__/scryfall-resolver.test.ts` — 8 assertions for name→oracle_id resolution
- [x] `src/scraper/metagame/__tests__/orchestrator.test.ts` — 9 assertions for wishlist upsert + removal logic
- [x] Schema migration: `ALTER TABLE wishlists ADD COLUMN is_auto_added boolean NOT NULL DEFAULT false`
- [x] Rate limit preset: `RATE_LIMITS.SCRYFALL_HEAVY = { limit: 2, interval: 1 }` in `src/lib/ratelimit/rate-limiter.ts`

*Existing infrastructure (Vitest, package.json) covered all framework needs — no framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MTGTop8 cheerio selector correctness | META-01, META-02 | Exact selector requires live HTML inspection | Run `pnpm ts-node -e "const r = await fetch('https://www.mtgtop8.com/topcards?f=ST&meta=52'); console.log(await r.text())"` and verify first 5 parsed card names match known Standard staples |
| EDHREC JSON response root key | META-03 | Undocumented endpoint may vary | Log raw response on first run; confirm `cardviews` array present and contains >10 entries |
| Weekly cron fires at 2:00 AM Sunday | META-01, META-02, META-03 | Time-based trigger impractical to automate | Monitor scheduler logs after first Sunday deployment; confirm `Weekly metagame refresh triggered` log line |

---

## Validation Audit 2026-05-08

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tasks covered | 6 / 6 |
| Tests passing | 34 / 34 |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-05-08
