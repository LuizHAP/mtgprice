---
phase: 04-opportunity-detection-notifications
plan: "02"
subsystem: opportunities/config
tags: [config, env-vars, validation, tdd]
dependency_graph:
  requires: []
  provides:
    - "loadDetectionConfig() and DetectionConfig type via @/lib/opportunities"
  affects:
    - "src/lib/opportunities/config.ts (new)"
    - "src/lib/opportunities/index.ts (new)"
    - "src/lib/opportunities/__tests__/config.test.ts (new)"
tech_stack:
  added: []
  patterns:
    - "env-var validation with Number.isFinite guard + logger.warn fallback"
    - "TDD red-green cycle for pure config loader"
    - "cronToHHMM helper deriving human-readable run times from cron expressions"
key_files:
  created:
    - src/lib/opportunities/config.ts
    - src/lib/opportunities/index.ts
    - src/lib/opportunities/__tests__/config.test.ts
  modified: []
decisions:
  - "loadDetectionConfig re-reads process.env on every call — no singleton; callers that mutate the result get their own copy"
  - "parseFloat used for dropThreshold (allows 0.25), parseInt for day counts (integer semantics)"
  - "cronToHHMM falls back to '??' rather than crashing on unparseable cron expressions"
  - "All pre-existing TypeScript errors in other files (bot/components/lib) are out of scope and not fixed"
metrics:
  duration_seconds: 208
  completed_date: "2026-05-08T13:49:44Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
  commits: 2
---

# Phase 04 Plan 02: Detection Config Loader Summary

**One-liner:** Validated env-var config loader for all 5 DETECT_* and 3 CRON_* tunables, with NaN/negative/zero guards and human-readable run-time derivation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Write failing tests for loadDetectionConfig | 878ce59 | src/lib/opportunities/__tests__/config.test.ts |
| 2 (GREEN) | Implement loadDetectionConfig | 81a28db | src/lib/opportunities/config.ts, src/lib/opportunities/index.ts |

## What Was Built

`src/lib/opportunities/config.ts` exports:

- `DetectionConfig` interface — exactly 9 fields: `dropThreshold`, `lookbackDays`, `baselineDays`, `cooldownDays`, `minHistoryDays`, `cronMorning`, `cronAfternoon`, `cronEvening`, `runTimesHuman`
- `loadDetectionConfig()` — reads 8 env vars on every call, validates numerics with `Number.isFinite`, calls `logger.warn` on invalid values, returns a fresh object with safe defaults

`src/lib/opportunities/index.ts` — barrel re-exporting both above so downstream plans can use `import { loadDetectionConfig, type DetectionConfig } from '@/lib/opportunities'`.

## Verification Results

- 10/10 unit tests pass (`pnpm test src/lib/opportunities --run`)
- Default values confirmed: `dropThreshold: 0.15`, `lookbackDays: 7`, `baselineDays: 30`, `cooldownDays: 7`, `minHistoryDays: 30`
- Default `runTimesHuman`: `'09:00, 15:00, 21:00'`
- NaN/negative/zero inputs produce `logger.warn` and fall back — never throw
- TypeScript check clean for the new files (pre-existing errors in other files are out of scope)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `loadDetectionConfig` reads live env vars on every call; no hardcoded placeholder values flow to any output.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Module reads only `DETECT_*` and `CRON_*` env vars — no secrets (TELEGRAM_BOT_TOKEN, DATABASE_URL, JWT_SECRET). No Telegram I/O. No DB access.

## Self-Check

## Self-Check: PASSED

All created files exist and all commits verified:
- FOUND: src/lib/opportunities/config.ts
- FOUND: src/lib/opportunities/index.ts
- FOUND: src/lib/opportunities/__tests__/config.test.ts
- FOUND commit: 878ce59 (test RED)
- FOUND commit: 81a28db (feat GREEN)
