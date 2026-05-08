---
phase: 5
slug: metagame-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
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
| **Estimated runtime** | ~15 seconds (metagame suite), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run -- src/scraper/metagame`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | — | — | N/A | infra | `pnpm test:run -- src/scraper/metagame` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | META-01,02 | T-5-01 / — | Card names sanitized (max 255 chars) | unit | `pnpm test:run -- src/scraper/metagame/__tests__/mtgtop8.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | META-03 | T-5-01 / — | Card names sanitized (max 255 chars) | unit | `pnpm test:run -- src/scraper/metagame/__tests__/edhrec.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 1 | META-01,02,03 | — | N/A | unit | `pnpm test:run -- src/scraper/metagame/__tests__/scryfall-resolver.test.ts` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 2 | META-01,02,03 | T-5-01 / — | Drizzle parameterized queries | unit | `pnpm test:run -- src/scraper/metagame/__tests__/orchestrator.test.ts` | ❌ W0 | ⬜ pending |
| 5-05-01 | 05 | 2 | META-01,02,03 | — | N/A | unit | `pnpm test:run -- src/scheduler` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/scraper/metagame/__tests__/edhrec.test.ts` — stubs for META-03 (Commander fetch)
- [ ] `src/scraper/metagame/__tests__/mtgtop8.test.ts` — stubs for META-01, META-02 (mocked HTML)
- [ ] `src/scraper/metagame/__tests__/scryfall-resolver.test.ts` — stubs for name→oracle_id resolution
- [ ] `src/scraper/metagame/__tests__/orchestrator.test.ts` — stubs for wishlist upsert + removal logic
- [ ] Schema migration: `ALTER TABLE wishlists ADD COLUMN is_auto_added boolean NOT NULL DEFAULT false`
- [ ] Rate limit preset: `RATE_LIMITS.SCRYFALL_HEAVY = { limit: 2, interval: 1 }` in `src/lib/ratelimit/rate-limiter.ts`

*Existing infrastructure (Vitest, package.json) covers all framework needs — no framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MTGTop8 cheerio selector correctness | META-01, META-02 | Exact selector requires live HTML inspection | Run `pnpm ts-node -e "const r = await fetch('https://www.mtgtop8.com/topcards?f=ST&meta=52'); console.log(await r.text())"` and verify first 5 parsed card names match known Standard staples |
| EDHREC JSON response root key | META-03 | Undocumented endpoint may vary | Log raw response on first run; confirm `cardviews` array present and contains >10 entries |
| Weekly cron fires at 2:00 AM Sunday | META-01,02,03 | Time-based trigger impractical to automate | Monitor scheduler logs after first Sunday deployment; confirm `Weekly metagame refresh triggered` log line |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
