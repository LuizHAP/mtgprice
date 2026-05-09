---
phase: 6
slug: polish-optimization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0.9 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test:run` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | withRetry retries N times | — | N/A | unit | `pnpm test:run -- src/lib/__tests__/retry.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | withRetry exponential backoff | — | N/A | unit | `pnpm test:run -- src/lib/__tests__/retry.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | withRetry propagates error after max attempts | — | N/A | unit | `pnpm test:run -- src/lib/__tests__/retry.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | fetchAllPrices respects concurrency limit | — | N/A | unit | `pnpm test:run -- src/scraper/__tests__/orchestrator.test.ts` | ✅ | ⬜ pending |
| 6-03-01 | 03 | 2 | Circuit breaker open triggers Telegram alert | — | Alert failure must not propagate | unit | `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts` | ✅ | ⬜ pending |
| 6-03-02 | 03 | 2 | Health alert uses correct chatId and message format | — | N/A | unit | `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts` | ✅ | ⬜ pending |
| 6-03-03 | 03 | 2 | Health alert failure does not propagate | — | Fire-and-forget; never throws | unit | `pnpm test:run -- src/scraper/__tests__/circuit-breaker.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/retry.test.ts` — unit tests for `withRetry` (new file; new implementation)
- [ ] Implement skipped stubs in `src/scraper/__tests__/orchestrator.test.ts` for concurrency tests
- [ ] Implement skipped stubs in `src/scraper/__tests__/circuit-breaker.test.ts` for health alert tests

*Existing infrastructure covers framework setup — Vitest is fully configured with 13 passing test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard loads < 2s for 50-card wishlist | Success Criteria #3 | Requires real DB with data and HTTP request timing | Run `pnpm dev`, open `/dashboard`, observe network tab response time for `GET /api/wishlist` with 50+ cards |
| Telegram health alert delivered on circuit open | Success Criteria #4 | Requires live Telegram bot token and chat ID configured | Manually trigger circuit open by stopping a price source, verify Telegram message arrives within 5 seconds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
