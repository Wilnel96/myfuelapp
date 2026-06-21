/*
  # Make VIN field required again

  1. Changes
    - Alter the `vin` column in `vehicles` table to NOT allow NULL values
    - VIN numbers are mandatory for vehicle verification in mobile fuel app
  
  2. Security
    - No changes to RLS policies
*/

ALTER TABLE vehicles 
ALTER COLUMN vin SET NOT NULL;