-- Add unique constraint on (user_id, card_id) to prevent duplicate wishlist entries
-- This addresses UAT Gap 2: Duplicate detection doesn't work
-- Migration: 0003_unique_wishlist.sql
-- Date: 2026-03-07

-- Step 1: Remove any existing duplicate entries (keep earliest entry per user-card pair)
DELETE FROM wishlists w1
USING wishlists w2
WHERE w1.user_id = w2.user_id
  AND w1.card_id = w2.card_id
  AND w1.id > w2.id;

-- Step 2: Add unique constraint
ALTER TABLE wishlists
ADD CONSTRAINT uniqueUserCard UNIQUE (user_id, card_id);

-- Verification: Check constraint exists
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'wishlists' AND constraint_type = 'UNIQUE';
