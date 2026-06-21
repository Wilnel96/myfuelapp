/*
  # Cleanup Duplicate Return Transactions
  
  1. Problem
    - Multiple return transactions exist for the same draw transaction
    - This violates the business rule that each draw should have only one return
    - Total of 23 duplicate returns identified
  
  2. Solution
    - Keep the earliest return transaction for each draw (most likely the legitimate one)
    - Delete all subsequent duplicate returns
  
  3. Data Integrity
    - Only affects return transactions with duplicates
    - Preserves the first (earliest) return for each draw
    - No draws or legitimate returns are affected
*/

-- Delete duplicate return transactions, keeping only the earliest one for each draw
DELETE FROM vehicle_transactions
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      vt_return.id,
      vt_return.related_transaction_id,
      vt_return.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY vt_return.related_transaction_id 
        ORDER BY vt_return.created_at ASC
      ) as rn
    FROM vehicle_transactions vt_return
    WHERE vt_return.transaction_type = 'return'
      AND vt_return.related_transaction_id IS NOT NULL
  ) duplicates
  WHERE rn > 1
);

-- Add a unique constraint to prevent future duplicates
-- This ensures each draw can only have one return
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_return_per_draw 
ON vehicle_transactions(related_transaction_id) 
WHERE transaction_type = 'return' AND related_transaction_id IS NOT NULL;
