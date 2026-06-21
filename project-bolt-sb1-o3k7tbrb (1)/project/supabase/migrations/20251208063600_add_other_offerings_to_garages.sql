/*
  # Add Other Offerings to Garages

  1. Changes
    - Add `other_offerings` JSONB column to garages table
    - This will store various offerings like convenience shops, takeaways, LPG, etc.
    
  2. Data Structure
    The JSONB will store:
    - convenience_shop: boolean
    - branded_convenience_store: { enabled: boolean, name: string }
    - takeaways: boolean
    - branded_takeaways: { enabled: boolean, name: string }
    - specialty_offering: { enabled: boolean, name: string }
    - lpg_gas: boolean
    - paraffin: boolean
    - other: { enabled: boolean, name: string }
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'other_offerings'
  ) THEN
    ALTER TABLE garages ADD COLUMN other_offerings JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;