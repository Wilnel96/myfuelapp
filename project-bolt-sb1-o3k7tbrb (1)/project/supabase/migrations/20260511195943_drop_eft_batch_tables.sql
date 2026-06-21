/*
  # Drop EFT Batch Tables

  ## Summary
  Removes the daily_eft_batches and eft_batch_items tables as EFT processing
  will not be used in the system. Both tables are confirmed empty.
  Also removes the foreign key column eft_batch_id from fuel_transactions.

  ## Changes
  - Remove `eft_batch_id` column from `fuel_transactions` (FK to daily_eft_batches)
  - Drop `eft_batch_items` table
  - Drop `daily_eft_batches` table
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_transactions' AND column_name = 'eft_batch_id') THEN
    ALTER TABLE fuel_transactions DROP COLUMN eft_batch_id;
  END IF;
END $$;

DROP TABLE IF EXISTS eft_batch_items;
DROP TABLE IF EXISTS daily_eft_batches;
