/*
  # Add Image Verification Fields to Fuel Transactions

  1. Changes
    - Add `license_disk_image` column to store base64 encoded license disk photo
    - Add `number_plate_image` column to store base64 encoded number plate photo
    - Add `location` column to store GPS coordinates of transaction
    - Add `verified` column to indicate if transaction was verified through scanning
    
  2. Notes
    - Images stored as text (base64) for simplicity
    - Location stored as text in format "lat,lng"
    - Verified defaults to false for manual entries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'license_disk_image'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN license_disk_image text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'number_plate_image'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN number_plate_image text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'location'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'verified'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN verified boolean DEFAULT false;
  END IF;
END $$;
