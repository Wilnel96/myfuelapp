/*
  # Add Local Account Payment Fields
  
  1. Changes
    - Add `local_account_number` column to `organizations` table
      - Stores the client's local account number for garage payments
      - Only used when payment_option is 'Local Account'
    - Add `vehicle_number` column to `vehicles` table
      - Stores the vehicle-specific account number
      - Used in combination with local_account_number for NFC payments to garage tills
      - May be the same as local_account_number depending on garage till system
  
  2. Security
    - No RLS changes needed as existing policies cover these columns
    - Fields are not encrypted as per requirements
    - PIN verification required to access these numbers (handled in application logic)
*/

-- Add local_account_number to organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'local_account_number'
  ) THEN
    ALTER TABLE organizations ADD COLUMN local_account_number text;
  END IF;
END $$;

-- Add vehicle_number to vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'vehicle_number'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN vehicle_number text;
  END IF;
END $$;