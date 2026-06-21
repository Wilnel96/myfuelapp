/*
  # Add ID Number and Date of Birth Validation

  1. Changes
    - Creates a function to validate that the date of birth matches the ID number
    - South African ID format: YYMMDD SSSS C A Z
    - First 6 digits represent birth date (Year, Month, Day)
    - Adds a check constraint to ensure DOB matches ID number
    - Applies to both new inserts and updates

  2. Validation Rules
    - Extract YYMMDD from ID number (first 6 digits)
    - Compare with actual date of birth
    - Handle century correctly (00-99 could be 1900s or 2000s)
    - ID starting with 00-23 = 2000s, 24-99 = 1900s (assuming current date)

  3. Security
    - Validation runs before insert/update operations
    - Prevents data inconsistencies
    - Ensures compliance with SA ID number standards
*/

-- Function to validate that date of birth matches SA ID number
CREATE OR REPLACE FUNCTION validate_id_number_dob()
RETURNS TRIGGER AS $$
DECLARE
  id_year TEXT;
  id_month TEXT;
  id_day TEXT;
  id_date DATE;
  birth_year INTEGER;
  birth_month INTEGER;
  birth_day INTEGER;
BEGIN
  -- Only validate if both id_number and date_of_birth are provided
  IF NEW.id_number IS NULL OR NEW.date_of_birth IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ensure ID number is at least 13 digits
  IF LENGTH(NEW.id_number) < 13 THEN
    RAISE EXCEPTION 'ID number must be at least 13 digits';
  END IF;

  -- Extract date components from ID number (YYMMDD)
  id_year := SUBSTRING(NEW.id_number FROM 1 FOR 2);
  id_month := SUBSTRING(NEW.id_number FROM 3 FOR 2);
  id_day := SUBSTRING(NEW.id_number FROM 5 FOR 2);

  -- Extract date components from date of birth
  birth_year := EXTRACT(YEAR FROM NEW.date_of_birth)::INTEGER;
  birth_month := EXTRACT(MONTH FROM NEW.date_of_birth)::INTEGER;
  birth_day := EXTRACT(DAY FROM NEW.date_of_birth)::INTEGER;

  -- Convert 2-digit year to 4-digit year
  -- Assume 00-23 = 2000s, 24-99 = 1900s (adjustable based on current year)
  DECLARE
    full_year INTEGER;
  BEGIN
    IF id_year::INTEGER <= 23 THEN
      full_year := 2000 + id_year::INTEGER;
    ELSE
      full_year := 1900 + id_year::INTEGER;
    END IF;

    -- Validate that the extracted date matches the date of birth
    IF full_year != birth_year OR 
       id_month::INTEGER != birth_month OR 
       id_day::INTEGER != birth_day THEN
      RAISE EXCEPTION 'Date of birth (%) does not match ID number (%). ID number indicates: %-%-%, but DOB is: %-%-%.', 
        NEW.date_of_birth,
        NEW.id_number,
        full_year,
        id_month,
        id_day,
        birth_year,
        birth_month,
        birth_day;
    END IF;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS validate_driver_id_dob ON drivers;

-- Create trigger to validate before insert or update
CREATE TRIGGER validate_driver_id_dob
  BEFORE INSERT OR UPDATE OF id_number, date_of_birth ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION validate_id_number_dob();

-- Add a comment to the drivers table documenting this validation
COMMENT ON COLUMN drivers.id_number IS 'South African ID number (13 digits). First 6 digits (YYMMDD) must match date_of_birth.';
COMMENT ON COLUMN drivers.date_of_birth IS 'Driver date of birth. Must match the YYMMDD portion of the id_number.';