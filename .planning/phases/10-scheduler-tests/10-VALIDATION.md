---
phase: 10
slug: scheduler-tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:run src/scheduler/__tests__/jobs.test.ts`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | TEST-10 | — | N/A | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | TEST-10 | — | N/A | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ | ⬜ pending |
| 10-01-03 | 01 | 1 | TEST-11 | — | N/A | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ | ⬜ pending |
| 10-01-04 | 01 | 1 | TEST-11 | — | N/A | unit | `pnpm test:run src/scheduler/__tests__/jobs.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new files need to be created before implementation begins — `vitest.config.ts`, `test/setup.ts`, and all `vi.mock` declarations are already in place.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
