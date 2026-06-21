/*
  # Add Spending Limits to Organizations

  1. Changes
    - Add `daily_spending_limit` (numeric) to organizations table
      - For clients who pay daily via debit order
      - Nullable to allow unlimited spending if not set
    
    - Add `monthly_spending_limit` (numeric) to organizations table
      - For clients who pay monthly
      - Nullable to allow unlimited spending if not set
  
  2. Notes
    - Both fields are nullable to support organizations without spending limits
    - Limits are stored as numeric values representing currency amounts
    - Either or both limits can be set based on the client's payment arrangement
*/

-- Add daily spending limit column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'daily_spending_limit'
  ) THEN
    ALTER TABLE organizations ADD COLUMN daily_spending_limit numeric(10,2);
  END IF;
END $$;

-- Add monthly spending limit column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'monthly_spending_limit'
  ) THEN
    ALTER TABLE organizations ADD COLUMN monthly_spending_limit numeric(10,2);
  END IF;
END $$;
