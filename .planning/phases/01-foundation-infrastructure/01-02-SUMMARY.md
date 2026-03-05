---
phase: 01-foundation-infrastructure
plan: 02
title: "Create database schema with TimescaleDB hypertables and Drizzle ORM"
one-liner: "PostgreSQL schema with Drizzle ORM, TimescaleDB hypertables for time-series price data, composite indexes for fast queries, and foreign key relationships between users, cards, prices, and wishlists tables."
completed-date: 2026-03-05
duration: "< 5 minutes"
status: complete
tags: [database, orm, schema, timescaledb, migration]
subsystem: "Database Layer"
dependency-graph:
  requires:
    - "PostgreSQL 16+ with TimescaleDB 2.15+ extension"
    - "Node.js 20+ runtime environment"
    - "DATABASE_URL environment variable configured"
  provides:
    - "Schema definitions for all 4 tables (users, cards, prices, wishlists)"
    - "Database client (drizzle) for use in API routes and services"
    - "Migration scripts for TimescaleDB hypertable conversion"
    - "Composite index for 90% query coverage (card_id, timestamp DESC)"
  affects:
    - "Phase 2: Price data collection will use prices table"
    - "Phase 3: Notification system will query prices table"
    - "Phase 4: Dashboard will use all tables for display"
tech-stack:
  added:
    - "drizzle-orm@0.38.4 - TypeScript-first ORM with SQL-like API"
    - "postgres@3.4.5 - PostgreSQL driver for Node.js"
    - "drizzle-kit@0.30.4 - Migration generation and database push tool"
  patterns:
    - "Drizzle schema-first approach with TypeScript definitions"
    - "TimescaleDB hypertables for automatic time-series partitioning"
    - "Composite indexes (card_id, timestamp DESC) for query optimization"
    - "Foreign key relations for data integrity"
key-files:
  created:
    - path: "src/db/schema/users.ts"
      purpose: "User table with email, passwordHash, telegramChatId for AUTH-01"
    - path: "src/db/schema/cards.ts"
      purpose: "Card metadata table with oracleId (Scryfall), name, set, rarity, color"
    - path: "src/db/schema/prices.ts"
      purpose: "Time-series price data with cardId, source, priceBrl, timestamp for PRICE-08"
    - path: "src/db/schema/wishlists.ts"
      purpose: "User wishlist tracking with userId, cardId, addedAt"
    - path: "src/db/schema/index.ts"
      purpose: "Schema exports and TypeScript type inference"
    - path: "src/db/index.ts"
      purpose: "Database client connection using drizzle-orm and postgres"
    - path: "drizzle.config.ts"
      purpose: "Drizzle Kit configuration for migration generation"
    - path: "drizzle/0001_timescale_hypertable.sql"
      purpose: "TimescaleDB hypertable conversion SQL (manual execution)"
    - path: "drizzle/0002_indexes.sql"
      purpose: "Composite index creation for fast time-series queries"
    - path: "drizzle/README.md"
      purpose: "Migration guide with step-by-step instructions"
  modified:
    - path: "package.json"
      changes: "Added db:generate, db:migrate, db:studio scripts"
decisions:
  - title: "Price storage: one row per source"
    rationale: "Enables flexible comparison across sources (Liga Magic, TCGPlayer, CardMarket, CardKingdom). Trade-off: 4x storage (~17.6M rows/year) but handles different update schedules."
    alternatives-considered:
      - "Single row with JSON columns for multiple sources"
      - "Separate table per source"
  - title: "TimescaleDB hypertable with 7-day chunks"
    rationale: "Automatic time-based partitioning for 10-100x faster queries. 7-day chunk interval optimal for 2-3x daily checks across 4 sources (~48K rows/day)."
    alternatives-considered:
      - "Regular PostgreSQL table with manual partitioning"
      - "InfluxDB (65% higher storage cost)"
  - title: "Composite index on (card_id, timestamp DESC)"
    rationale: "Covers 90% of queries that filter by card and order by time. Index order is critical: PostgreSQL reads left-to-right, so card_id must come first."
    alternatives-considered:
      - "Index on (timestamp, card_id) - wrong order for our queries"
      - "No index (Seq Scan on large tables)"
metrics:
  tasks-completed: "3/3 (100%)"
  files-created: 10
  files-modified: 1
  commits: 3
  lines-of-code: ~280
  test-coverage: "N/A (Wave 0 tests will be created in 01-05)"
deviations-from-plan: []
auth-gates: []
next-steps:
  - "Set up PostgreSQL 16+ with TimescaleDB 2.15+ extension"
  - "Configure DATABASE_URL environment variable"
  - "Run 'pnpm db:migrate' to create tables"
  - "Execute drizzle/0001_timescale_hypertable.sql manually (see README.md)"
  - "Execute drizzle/0002_indexes.sql manually (see README.md)"
  - "Verify hypertable: SELECT * FROM timescaledb_information.hypertables;"
---

# Phase 1 Plan 02: Create Database Schema Summary

## Overview

Successfully created a complete database schema using Drizzle ORM with PostgreSQL and TimescaleDB optimization. The schema defines 4 tables (users, cards, prices, wishlists) with proper foreign key relationships, a composite index for fast time-series queries, and TimescaleDB hypertable conversion for automatic partitioning.

## What Was Built

### 1. Drizzle Schema Definitions (Task 1)

Created TypeScript-first schema definitions using Drizzle ORM's pg-core:

- **users table** (`src/db/schema/users.ts`)
  - Columns: id, email (unique), passwordHash, telegramChatId (nullable), createdAt
  - Supports AUTH-01 requirement for Telegram linking
  - Relations: hasMany wishlists

- **cards table** (`src/db/schema/cards.ts`)
  - Columns: id, oracleId (unique, Scryfall oracle_id), name, set, rarity, color, imageUrl, lastFetched
  - Index on oracleId for fast lookups
  - Relations: hasMany prices, hasMany wishlists

- **prices table** (`src/db/schema/prices.ts`)
  - Columns: id, cardId (FK → cards.oracleId), source, priceBrl (numeric), timestamp
  - Composite index on (cardId, timestamp DESC) for 90% query coverage
  - Relations: belongsTo card

- **wishlists table** (`src/db/schema/wishlists.ts`)
  - Columns: id, userId (FK → users.id), cardId (FK → cards.oracleId), addedAt
  - Relations: belongsTo user, belongsTo card

- **Schema exports** (`src/db/schema/index.ts`)
  - Centralized exports for all tables and relations
  - Enables TypeScript type inference throughout the application

### 2. Database Connection and Configuration (Task 2)

Set up Drizzle ORM database client and migration tooling:

- **Database client** (`src/db/index.ts`)
  - Uses `drizzle-orm` with `postgres` driver
  - Reads DATABASE_URL from environment variable
  - Exports `db` instance for use in API routes and services
  - Exports all schema types for TypeScript inference

- **Drizzle Kit configuration** (`drizzle.config.ts`)
  - Schema path: `./src/db/schema`
  - Migration output: `./drizzle`
  - Driver: `pg` (PostgreSQL)
  - Credentials from DATABASE_URL environment variable

- **Package scripts** (in `package.json`)
  - `db:generate` - Generate migration SQL from schema changes
  - `db:migrate` - Push schema changes to database
  - `db:studio` - Open Drizzle Studio for database inspection

### 3. TimescaleDB Hypertable Migration (Task 3)

Created manual SQL migrations for time-series optimization:

- **Hypertable conversion** (`drizzle/0001_timescale_hypertable.sql`)
  - Converts prices table to TimescaleDB hypertable
  - 7-day chunk interval for optimal performance
  - Enables 10-100x faster time-series queries
  - Supports automatic data retention with `drop_chunks()`
  - Verification query included

- **Composite index** (`drizzle/0002_indexes.sql`)
  - Creates index on (card_id, timestamp DESC)
  - Covers 90% of queries (price history for a card)
  - Index order is critical for performance
  - Verification query included

- **Migration guide** (`drizzle/README.md`)
  - Step-by-step instructions for manual TimescaleDB setup
  - Troubleshooting tips for common issues
  - Verification queries for hypertable and index creation
  - Future data retention policy guidance

## Technical Decisions

### Price Storage Model

**Decision:** One row per source (card_id, source, price_brl, timestamp)

**Rationale:**
- Enables flexible comparison across 4 sources (Liga Magic, TCGPlayer, CardMarket, CardKingdom)
- Handles different update schedules per source
- Simplifies queries like "get all prices for card X from source Y"

**Trade-off:** 4x storage (~17.6M rows/year expected) but acceptable given TimescaleDB compression

### TimescaleDB Hypertable

**Decision:** Convert prices table to hypertable with 7-day chunks

**Rationale:**
- Automatic time-based partitioning without manual maintenance
- 10-100x faster queries on time-series data
- Efficient storage with columnar compression
- Simplifies data retention with `drop_chunks()` and retention policies

**Alternative considered:** Regular PostgreSQL table with manual partitioning (too complex, slower)

### Composite Index Order

**Decision:** Index on (card_id, timestamp DESC)

**Rationale:**
- Covers 90% of queries that filter by card_id and sort by timestamp DESC
- Index order is critical: PostgreSQL reads left-to-right
- Wrong order (timestamp, card_id) would not optimize our queries

**Pattern from CONTEXT.md:** Decision locked during planning phase

## Requirements Satisfied

This plan implements **PRICE-08**: "Sistema armazena histórico de preços para cada carta/fonte"

- Prices table schema supports time-series queries (card_id, source, price_brl, timestamp)
- TimescaleDB hypertable optimization for 10-100x faster queries
- Composite index (card_id, timestamp DESC) for fast lookups
- Foreign keys enforce referential integrity (card_id → cards.oracle_id)

## Commits

| Commit | Hash | Message |
|--------|------|---------|
| Task 1 | d5cd5ed | feat(01-02): create Drizzle schema definitions |
| Task 2 | 86ec42a | feat(01-02): set up Drizzle database connection and configuration |
| Task 3 | fbd3b24 | feat(01-02): create TimescaleDB hypertable migration |

## Deviations from Plan

**None** - Plan executed exactly as written. All tasks completed without deviations or auto-fixes.

## Authentication Gates

**None** - No authentication errors encountered during execution.

## Self-Check: PASSED

- [x] All schema files exist in src/db/schema/
- [x] Schema defines all 4 required tables (users, cards, prices, wishlists)
- [x] Foreign keys properly defined (prices.cardId → cards.oracleId, wishlists.userId → users.id)
- [x] Composite index on (card_id, timestamp DESC) defined
- [x] TimescaleDB hypertable SQL exists in drizzle/ directory
- [x] drizzle.config.ts exists with correct configuration
- [x] Database connection client configured in src/db/index.ts
- [x] All 3 commits created with proper format
- [x] Migration guide (README.md) provides clear instructions
- [x] Package scripts added (db:generate, db:migrate, db:studio)

## Next Steps

1. **Infrastructure setup** (outside this plan):
   - Install PostgreSQL 16+ with TimescaleDB 2.15+ extension
   - Configure DATABASE_URL environment variable

2. **Database creation** (manual):
   ```bash
   # Run Drizzle migrations
   pnpm db:migrate

   # Apply TimescaleDB hypertable conversion
   psql $DATABASE_URL -f drizzle/0001_timescale_hypertable.sql

   # Apply composite index
   psql $DATABASE_URL -f drizzle/0002_indexes.sql

   # Verify hypertable creation
   psql $DATABASE_URL -c "SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'prices';"
   ```

3. **Continue to Plan 01-03**: Implement JWT authentication system

---

**Plan completed:** 2026-03-05
**Total duration:** < 5 minutes
**Status:** Complete ✓
