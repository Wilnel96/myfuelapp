/*
  # Add Fuel Prices to Garages

  1. Changes
    - Add `fuel_prices` column to `garages` table
      - JSONB data type to store prices for each fuel type
      - Structure: { "ULP-93": 21.50, "ULP-95": 22.00, "Diesel-10": 20.50, etc. }
      - Allows flexible storage of prices for any fuel type
      - Nullable to allow gradual rollout
  
  2. Purpose
    - Enable garages to specify prices per liter for each fuel type they offer
    - Prices stored as numeric values with decimal precision
*/

-- Add fuel_prices column to garages table
ALTER TABLE garages 
ADD COLUMN IF NOT EXISTS fuel_prices JSONB DEFAULT '{}'::jsonb;