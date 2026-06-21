/*
  # Add Monthly Fee Per Vehicle to Organizations

  1. Changes
    - Add `monthly_fee_per_vehicle` column to organizations table
      - Stores the monthly fee charged per vehicle for client organizations
      - Decimal type to handle currency values (e.g., 50.00)
      - Nullable, defaults to null
  
  2. Notes
    - This field is used for client organizations that pay a monthly subscription per vehicle
    - Independent of garage commission percentage
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'monthly_fee_per_vehicle'
  ) THEN
    ALTER TABLE organizations ADD COLUMN monthly_fee_per_vehicle DECIMAL(10, 2) DEFAULT NULL;
  END IF;
END $$;
