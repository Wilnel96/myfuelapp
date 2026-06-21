/*
  # Fix Garages Schema to Match Frontend Code

  1. Changes
    - Rename `address_line1` to `address_line_1`
    - Rename `address_line2` to `address_line_2`
    - Rename `contact_email` to `email_address`
    - Rename `fuel_types_offered` to `fuel_types`
    - Replace individual fuel price columns with a single `fuel_prices` JSONB column
    - Change `other_offerings` from ARRAY to JSONB to support structured data
    - Remove deprecated columns: `contact_person`, `contact_phone`
  
  2. Notes
    - This aligns the database schema with the frontend expectations
    - Preserves any existing data through column renames
    - Converts fuel prices to the expected JSONB format
*/

-- Rename address columns
ALTER TABLE garages RENAME COLUMN address_line1 TO address_line_1;
ALTER TABLE garages RENAME COLUMN address_line2 TO address_line_2;

-- Rename email column
ALTER TABLE garages RENAME COLUMN contact_email TO email_address;

-- Rename fuel_types_offered to fuel_types
ALTER TABLE garages RENAME COLUMN fuel_types_offered TO fuel_types;

-- Add new fuel_prices JSONB column
ALTER TABLE garages ADD COLUMN IF NOT EXISTS fuel_prices JSONB DEFAULT '{}'::jsonb;

-- Migrate existing fuel price data to the new format
UPDATE garages SET fuel_prices = jsonb_build_object(
  '95', COALESCE(fuel_price_95, 0),
  '93', COALESCE(fuel_price_93, 0),
  'diesel', COALESCE(fuel_price_diesel, 0),
  'lpg', COALESCE(fuel_price_lpg, 0)
) WHERE fuel_prices = '{}'::jsonb;

-- Drop old fuel price columns
ALTER TABLE garages DROP COLUMN IF EXISTS fuel_price_95;
ALTER TABLE garages DROP COLUMN IF EXISTS fuel_price_93;
ALTER TABLE garages DROP COLUMN IF EXISTS fuel_price_diesel;
ALTER TABLE garages DROP COLUMN IF EXISTS fuel_price_lpg;

-- Change other_offerings from ARRAY to JSONB
ALTER TABLE garages DROP COLUMN IF EXISTS other_offerings;
ALTER TABLE garages ADD COLUMN other_offerings JSONB DEFAULT '{}'::jsonb;

-- Remove deprecated columns
ALTER TABLE garages DROP COLUMN IF EXISTS contact_person;
ALTER TABLE garages DROP COLUMN IF EXISTS contact_phone;
