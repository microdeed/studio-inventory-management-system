-- Migration: Add batch_id column to transactions table
-- Date: 2025-11-20
-- Description: Adds batch_id column to group related transactions together

-- Add batch_id column (nullable for backward compatibility)
ALTER TABLE transactions ADD COLUMN batch_id VARCHAR(50);

-- Create index for batch queries
CREATE INDEX IF NOT EXISTS idx_transactions_batch ON transactions(batch_id);
