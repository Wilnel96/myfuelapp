/*
  # Rename expected_garage to actual_garage on vehicle_exceptions

  ## Purpose
  Clarify that the garage field records the garage where the vehicle was actually
  refueled, not where it was merely "expected" to be.

  ## Changes
  1. Rename column `expected_garage` → `actual_garage` on `vehicle_exceptions`.
     - No data loss — this is a safe rename that preserves all existing values.

  ## Security
  - No policy changes needed.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_exceptions' AND column_name = 'expected_garage'
  ) THEN
    ALTER TABLE vehicle_exceptions
    RENAME COLUMN expected_garage TO actual_garage;
  END IF;
END $$;
