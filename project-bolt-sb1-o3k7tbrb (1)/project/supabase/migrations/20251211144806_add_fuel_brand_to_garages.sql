/*
  # Add Fuel Brand to Garages

  1. Changes
    - Add `fuel_brand` column to garages table to store the brand of fuel sold at the garage
    - Examples: Shell, BP, Engen, Sasol, Total, Caltex, etc.
  
  2. Notes
    - Field is optional (nullable) to support independent garages
    - Uses text type for flexibility with brand names
*/

-- Add fuel_brand column to garages table
ALTER TABLE garages
ADD COLUMN IF NOT EXISTS fuel_brand text;

-- Add comment to explain the column
COMMENT ON COLUMN garages.fuel_brand IS 'The brand of fuel sold at this garage (e.g., Shell, BP, Engen, Sasol, Total, Caltex)';