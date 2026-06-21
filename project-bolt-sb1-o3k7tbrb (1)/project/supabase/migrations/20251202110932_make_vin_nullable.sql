/*
  # Make VIN field optional

  1. Changes
    - Alter the `vin` column in `vehicles` table to allow NULL values
    - VIN numbers are not always available at vehicle registration time
  
  2. Security
    - No changes to RLS policies
*/

ALTER TABLE vehicles 
ALTER COLUMN vin DROP NOT NULL;