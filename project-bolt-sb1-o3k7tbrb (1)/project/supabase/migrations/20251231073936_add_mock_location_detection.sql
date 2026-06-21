/*
  # Add Mock Location Detection

  1. Changes
    - Add `is_mock_location` column to fuel_transactions table to flag GPS spoofing
    - Add `location_accuracy` column to store GPS accuracy in meters
    - Add `location_provider` column to identify GPS provider/source

  2. Security
    - Helps identify potential fraud from GPS spoofing
    - Allows flagging and review of suspicious transactions
*/

DO $$
BEGIN
  -- Add is_mock_location column to track if GPS location was mocked/spoofed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'is_mock_location'
  ) THEN
    ALTER TABLE fuel_transactions
    ADD COLUMN is_mock_location boolean DEFAULT false NOT NULL;
  END IF;

  -- Add location_accuracy to store GPS accuracy in meters
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'location_accuracy'
  ) THEN
    ALTER TABLE fuel_transactions
    ADD COLUMN location_accuracy numeric;
  END IF;

  -- Add location_provider to identify GPS source
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'location_provider'
  ) THEN
    ALTER TABLE fuel_transactions
    ADD COLUMN location_provider text;
  END IF;
END $$;

-- Create index for querying mock locations
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_mock_location
ON fuel_transactions(is_mock_location)
WHERE is_mock_location = true;

-- Add comment explaining the mock location detection
COMMENT ON COLUMN fuel_transactions.is_mock_location IS
'Indicates if the GPS location was detected as mocked/spoofed using device APIs';

COMMENT ON COLUMN fuel_transactions.location_accuracy IS
'GPS accuracy in meters - higher values indicate less reliable location data';

COMMENT ON COLUMN fuel_transactions.location_provider IS
'GPS provider/source (e.g., "gps", "network", "fused")';
