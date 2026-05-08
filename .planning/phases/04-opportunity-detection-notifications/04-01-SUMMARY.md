---
phase: 04-opportunity-detection-notifications
plan: "01"
subsystem: db-schema
tags: [drizzle, schema, migration, opportunities, detection-candidates, env-vars]
dependency_graph:
  requires:
    - src/db/schema/cards.ts (FK target: cards.oracle_id)
    - src/db/schema/prices.ts (pattern reference for numeric columns)
    - drizzle.config.ts (schema path and dialect)
  provides:
    - src/db/schema/opportunities.ts (Drizzle table + relations + OpportunitySource type)
    - src/db/schema/detectionCandidates.ts (D-07 state store table)
    - drizzle/0004_create_opportunities.sql (migration SQL)
    - .env.example DETECT_* section
  affects:
    - src/db/schema/index.ts (re-export surface updated)
    - All downstream Phase 4 plans (04-02 through 04-05) that import from @/db/schema
tech_stack:
  added: []
  patterns:
    - Drizzle pgTable with numeric(10,2) for price columns
    - Drizzle unique() constraint for idempotent D-07 state store
    - Drizzle index() for composite query coverage
    - TypeScript union type OpportunitySource for compile-time source validation
key_files:
  created:
    - src/db/schema/opportunities.ts
    - src/db/schema/detectionCandidates.ts
    - drizzle/0004_create_opportunities.sql
    - drizzle/meta/0004_snapshot.json
  modified:
    - src/db/schema/index.ts
    - .env.example
    - drizzle/meta/_journal.json
decisions:
  - Used 'ligamagic' (no underscore) in OpportunitySource type, overriding CONTEXT.md D-17's 'liga_magic', to match live prices.source values from src/scraper/orchestrator.ts line 36
  - Enforced OpportunitySource domain via TypeScript union type rather than DB CHECK constraint, so correcting the value set is a code-only change
  - Renamed generated migration from drizzle-kit's auto-named 0001_lovely_the_anarchist.sql to 0004_create_opportunities.sql for sequential consistency
  - Created mtgprice database in the existing notificame postgres container (port 5432 shared) since mtgprice docker-compose was not running
metrics:
  duration: "674 seconds (~11 minutes)"
  completed_date: "2026-05-08"
  tasks_completed: 4
  tasks_total: 4
  files_created: 4
  files_modified: 3
  commits: 3
---

# Phase 04 Plan 01: Opportunity Detection Schema Summary

**One-liner:** Drizzle `opportunities` and `detection_candidates` tables with migration, live DB push, and DETECT_* env var documentation for Phase 4 detection pipeline.

## What Was Built

Two new Drizzle schema files provide the persistent state layer for Phase 4's opportunity detection system:

1. **`src/db/schema/opportunities.ts`** — The `opportunities` table (D-17) storing every detected buying opportunity. Contains `card_id`, `source`, `detected_at`, `current_price`, `baseline_price`, `drop_percent`, and `sent_to_user` columns. Includes a composite index on `(card_id, source, detected_at)` for cooldown queries and `/history` ordering. Exports `OpportunitySource = 'ligamagic' | 'tcgplayer' | 'cardmarket' | 'cardkingdom'` as a TypeScript union type for compile-time enforcement.

2. **`src/db/schema/detectionCandidates.ts`** — The `detection_candidates` table (D-07 state store). A candidate row exists for a `(card_id, source)` pair IFF the previous detection run fired but the opportunity was not yet promoted (first confirming run). On the second consecutive confirming run, the row is promoted to `opportunities` and deleted. UNIQUE constraint on `(card_id, source)` enforces at-most-one candidate per pair.

3. **`drizzle/0004_create_opportunities.sql`** — Generated migration SQL with DDL for both tables, FKs to `cards.oracle_id`, UNIQUE constraint, and all indexes.

4. **`.env.example`** — Documents the 5 `DETECT_*` env vars with D-21 defaults for config loader (Plan 02) and `/config` command (Plan 05).

5. **Live database** — Both tables pushed to the live PostgreSQL and verified via `SELECT` probes.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | a5763ff | feat(04-01): add opportunities and detection_candidates Drizzle schema files |
| Task 2 | 74d8cec | feat(04-01): add DETECT_* env vars to .env.example |
| Task 3 | ee45968 | feat(04-01): generate Drizzle migration for opportunities and detection_candidates tables |
| Task 4 | (live DB operation — no file commit) | Schema pushed to live Postgres; both tables verified |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing node_modules in worktree**
- **Found during:** Task 3 (db:generate)
- **Issue:** Worktree had no `node_modules` — `drizzle-kit: command not found` on first run
- **Fix:** Ran `pnpm install` to install dependencies in the worktree
- **Files modified:** None (runtime fix)

**2. [Rule 3 - Blocking] Missing .env.local in worktree**
- **Found during:** Task 4 (db:migrate)
- **Issue:** Worktree had no `.env.local` so drizzle-kit push couldn't connect to database
- **Fix:** Copied `.env.local` from main project directory to worktree (file is gitignored)
- **Files modified:** None committed (gitignored)

**3. [Rule 3 - Blocking] Port 5432 occupied by notificame_db container; mtgprice database not running**
- **Found during:** Task 4 (db:migrate)
- **Issue:** Password authentication failed — the postgres on port 5432 was `notificame_db`, not `mtgprice-db`. No mtgprice docker volume existed.
- **Fix:** Created `mtgprice` user and `mtgprice` database inside the existing postgres container using `notificame` superuser, then ran push. All 4 existing tables (users, cards, prices, wishlists) were recreated by drizzle-kit push as additive changes; no DROP TABLE or DROP COLUMN operations were performed.
- **Files modified:** None (live database operation)

**4. [Rule 3 - Blocking] Drizzle-kit generated migration with conflicting name 0001_lovely_the_anarchist.sql**
- **Found during:** Task 3 (db:generate)
- **Issue:** The worktree's drizzle meta snapshot only knew about migration 0000, so drizzle-kit named the new migration `0001_*`. This conflicted with the existing `0001_timescale_hypertable.sql`. The plan required `0004_create_opportunities.sql`.
- **Fix:** Renamed the generated file to `0004_create_opportunities.sql`, updated `_journal.json` idx from 1 to 4 and tag accordingly, renamed `0001_snapshot.json` to `0004_snapshot.json`.
- **Files modified:** drizzle/meta/_journal.json, drizzle/meta/0004_snapshot.json

## Verification Results

- `src/db/schema/opportunities.ts` — contains `export const opportunities = pgTable` with all 8 D-17 columns
- `src/db/schema/detectionCandidates.ts` — contains UNIQUE `detection_candidates_card_source_key` and `first_seen_at` index
- `src/db/schema/index.ts` — re-exports both tables and `OpportunitySource` type; all 4 pre-existing exports preserved
- `drizzle/0004_create_opportunities.sql` — contains CREATE TABLE for both tables, FKs to `cards`, ON DELETE CASCADE for detection_candidates
- Live database — both tables present (`\dt` shows 6 tables including opportunities and detection_candidates)
- `pnpm tsc --noEmit` — no TypeScript errors in the new schema files (pre-existing errors in unrelated files are unchanged)
- `.env.example` — all 5 DETECT_* vars with exact D-21 defaults; all existing vars preserved

## Known Stubs

None. All schema columns are fully defined and migrations applied to the live database.

## Threat Flags

None. This plan does not introduce new network endpoints or auth paths. The only new database surface is additive (two new tables). All threat mitigations from the threat register were applied:
- T-04-01-01: Push output inspected — no DROP TABLE/DROP COLUMN found
- T-04-01-02: .env.example contains only default values, no real secrets
- T-04-01-05: OpportunitySource union type enforces 4-value domain at compile time
- T-04-01-06: 'ligamagic' (no underscore) used throughout, matching live prices.source

## Self-Check: PASSED

All files created, all commits present, live database has both tables.
