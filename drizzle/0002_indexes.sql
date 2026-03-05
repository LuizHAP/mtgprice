-- Composite Index for Time-Series Queries
-- This index covers 90% of queries: get price history for a card ordered by timestamp
-- The order (card_id, timestamp DESC) is critical for performance

CREATE INDEX IF NOT EXISTS idx_prices_card_timestamp ON prices (card_id, timestamp DESC);

-- Verify index creation
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename = 'prices'
  AND indexname = 'idx_prices_card_timestamp';
