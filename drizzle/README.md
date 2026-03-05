# Database Migration Guide

This directory contains SQL migrations for TimescaleDB optimization that must be executed manually after running Drizzle migrations.

## Migration Steps

### 1. Generate and Apply Drizzle Migrations

```bash
# Generate migration SQL from schema changes
pnpm db:generate

# Push schema changes to database
pnpm db:migrate
```

### 2. Apply TimescaleDB Hypertable Conversion

After running `drizzle-kit push`, manually execute the TimescaleDB hypertable conversion:

```bash
# Connect to your PostgreSQL database with TimescaleDB extension
psql $DATABASE_URL

# Execute the hypertable conversion
\i drizzle/0001_timescale_hypertable.sql
```

**Important:** TimescaleDB hypertable conversion cannot be done through Drizzle migrations alone. It requires manual SQL execution after table creation.

### 3. Apply Performance Indexes

```bash
# From the same psql session
\i drizzle/0002_indexes.sql
```

### 4. Verify Hypertable Creation

```sql
-- Check if prices table is now a hypertable
SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'prices';

-- Expected output: 1 row with hypertable_name='prices', time_column_name='timestamp'
```

### 5. Verify Index Creation

```sql
-- Check if composite index exists
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename = 'prices'
  AND indexname = 'idx_prices_card_timestamp';

-- Expected output: 1 row with the composite index definition
```

## Hypertable Benefits

Converting the `prices` table to a TimescaleDB hypertable provides:

- **10-100x faster time-series queries** with automatic partitioning
- **Automatic data retention** with drop_chunks() for old data
- **Efficient storage** with columnar compression for time-series data
- **Simplified queries** with time_bucket() and other time-series functions

## Composite Index Benefits

The index on `(card_id, timestamp DESC)` covers:

- **90% of queries** that filter by card and order by time
- **Fast price history lookups** for specific cards
- **Efficient trend analysis** queries

## Troubleshooting

### Error: "create_hypertable() does not exist"

**Cause:** TimescaleDB extension is not installed.

**Solution:** Install TimescaleDB extension first:
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### Error: "table already exists"

**Cause:** Hypertable conversion was already applied.

**Solution:** This is normal. Verify with:
```sql
SELECT * FROM timescaledb_information.hypertables;
```

## Data Retention (Future)

After the system is running, you may want to add a retention policy:

```sql
-- Keep raw data for 90 days, then automatically drop
SELECT add_retention_policy('prices', INTERVAL '90 days');
```

This should be done after the initial testing phase, once you have validated data collection is working correctly.
