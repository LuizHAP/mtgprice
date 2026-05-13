---
phase: 11
slug: orchestrator-functions-tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.1.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run src/scraper/__tests__/orchestrator.test.ts`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | TEST-12 | — | N/A | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ | ⬜ pending |
| 11-01-02 | 01 | 1 | TEST-12 | — | N/A | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ | ⬜ pending |
| 11-01-03 | 01 | 1 | TEST-12 | — | N/A | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ | ⬜ pending |
| 11-02-01 | 02 | 1 | TEST-13 | — | N/A | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ | ⬜ pending |
| 11-02-02 | 02 | 1 | TEST-13 | — | N/A | unit | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ | ⬜ pending |
| 11-02-03 | 02 | 1 | TEST-13 | — | N/A | integration | `pnpm test:run src/scraper/__tests__/orchestrator.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Test file already exists with all 20 stubs in place. Vitest configured. No new fixtures or config needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
