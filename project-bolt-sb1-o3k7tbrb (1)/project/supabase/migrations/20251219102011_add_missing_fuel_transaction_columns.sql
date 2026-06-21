/*
  # Add Missing Columns to Fuel Transactions

  1. Changes
    - Add `location` column to store GPS coordinates as text
    - Add `license_disk_image` column to store base64 image data
    - Add `number_plate_image` column to store base64 image data  
    - Add `verified` column to track verification status
  
  2. Notes
    - These columns support the mobile fuel purchase verification process
    - Location stores coordinates in "lat,lng" format
    - Images are stored as text (base64 encoded)
    - Verified defaults to false for manual verification workflow
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'location'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN location text;
  END IF;

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
    WHERE table_name = 'fuel_transactions' AND column_name = 'verified'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN verified boolean DEFAULT false;
  END IF;
END $$;
