/*
  # Auto-Uppercase Vehicle Registration Numbers

  1. Changes
    - Creates a trigger function to automatically convert registration_number to uppercase
    - Applies the trigger to the vehicles table on INSERT and UPDATE
    - Backfills all existing registration numbers to uppercase

  2. Purpose
    - Ensures consistent display of vehicle registration numbers throughout the system
    - Registration numbers are always stored and displayed in uppercase regardless of input format
*/

-- Create function to uppercase registration_number
CREATE OR REPLACE FUNCTION uppercase_registration_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.registration_number = UPPER(NEW.registration_number);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-uppercase registration_number on insert/update
DROP TRIGGER IF EXISTS uppercase_registration_number_trigger ON vehicles;
CREATE TRIGGER uppercase_registration_number_trigger
  BEFORE INSERT OR UPDATE OF registration_number ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION uppercase_registration_number();

-- Backfill existing registration numbers to uppercase
UPDATE vehicles
SET registration_number = UPPER(registration_number)
WHERE registration_number != UPPER(registration_number);