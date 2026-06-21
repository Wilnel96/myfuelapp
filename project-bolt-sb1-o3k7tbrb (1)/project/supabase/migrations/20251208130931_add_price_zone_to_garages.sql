/*
  # Add Price Zone to Garages

  1. Changes
    - Add `price_zone` field to garages table
      - String field to store the fuel price zone (e.g., "Zone 1", "Zone 2", etc.)
      - Optional field as existing garages may not have this set yet
    
  2. Notes
    - In South Africa, ULP fuel prices are regulated by zone
    - Price zones account for delivery costs to different regions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'price_zone'
  ) THEN
    ALTER TABLE garages ADD COLUMN price_zone text;
  END IF;
END $$;
