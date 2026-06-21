/*
  # Update Vehicles Table Structure

  1. Changes to `vehicles` table
    - Add `registration_number` column (replaces license_plate for display)
    - Add `license_disk_expiry` column (date field for license disk expiry)
    - Keep existing columns for compatibility

  2. Notes
    - Existing data preserved
    - New columns added alongside existing ones
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'registration_number'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN registration_number text;
    UPDATE vehicles SET registration_number = license_plate WHERE registration_number IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'license_disk_expiry'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN license_disk_expiry date;
  END IF;
END $$;
