/*
  # Fix Function Search Path Security Issues (v3)

  ## Overview
  This migration fixes security issues related to mutable search paths in database functions.
  Functions with mutable search paths are vulnerable to search_path attacks where malicious users
  could create objects in their own schemas to intercept function calls.

  ## Security Impact
  Setting an immutable search_path prevents:
  - Search path injection attacks
  - Unauthorized access through schema manipulation
  - Function hijacking vulnerabilities

  ## Functions Fixed
  1. `validate_id_number_dob` - ID number validation function
  2. `check_fuel_transaction_invoice_integrity` - Invoice integrity checking function

  ## Changes
  - Drop all function overloads (trigger and regular versions)
  - Recreate with explicit search_path to 'public, pg_temp'
  - Use SECURITY DEFINER with immutable search_path

  ## Notes
  - pg_temp is included to allow temporary tables in the session
  - public schema is explicitly set to prevent search path injection
  - These functions run with elevated privileges (SECURITY DEFINER)
*/

-- Drop all versions of validate_id_number_dob
DROP FUNCTION IF EXISTS validate_id_number_dob() CASCADE;
DROP FUNCTION IF EXISTS validate_id_number_dob(text, date) CASCADE;

-- Recreate validate_id_number_dob as trigger function with immutable search_path
CREATE FUNCTION validate_id_number_dob()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validate ID number length
  IF LENGTH(NEW.id_number) != 13 THEN
    RAISE EXCEPTION 'ID number must be exactly 13 digits';
  END IF;

  -- Validate ID number contains only digits
  IF NOT (NEW.id_number ~ '^\d{13}$') THEN
    RAISE EXCEPTION 'ID number must contain only digits';
  END IF;

  -- Extract date components from ID number
  DECLARE
    year_part text := SUBSTRING(NEW.id_number FROM 1 FOR 2);
    month_part text := SUBSTRING(NEW.id_number FROM 3 FOR 2);
    day_part text := SUBSTRING(NEW.id_number FROM 5 FOR 2);
    full_year integer;
    id_date date;
  BEGIN
    -- Convert 2-digit year to 4-digit year
    full_year := CAST(year_part AS integer);
    IF full_year <= EXTRACT(YEAR FROM CURRENT_DATE)::integer - 2000 THEN
      full_year := full_year + 2000;
    ELSE
      full_year := full_year + 1900;
    END IF;

    -- Attempt to construct date from ID number
    BEGIN
      id_date := make_date(full_year, CAST(month_part AS integer), CAST(day_part AS integer));
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid date in ID number';
    END;

    -- Validate that ID date matches provided date of birth
    IF id_date != NEW.date_of_birth THEN
      RAISE EXCEPTION 'ID number does not match date of birth';
    END IF;
  END;

  RETURN NEW;
END;
$$;

-- Recreate validate_id_number_dob as regular function with immutable search_path
CREATE FUNCTION validate_id_number_dob(
  id_number text,
  date_of_birth date
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validate ID number length
  IF LENGTH(id_number) != 13 THEN
    RETURN false;
  END IF;

  -- Validate ID number contains only digits
  IF NOT (id_number ~ '^\d{13}$') THEN
    RETURN false;
  END IF;

  -- Extract date components from ID number
  DECLARE
    year_part text := SUBSTRING(id_number FROM 1 FOR 2);
    month_part text := SUBSTRING(id_number FROM 3 FOR 2);
    day_part text := SUBSTRING(id_number FROM 5 FOR 2);
    full_year integer;
    id_date date;
  BEGIN
    -- Convert 2-digit year to 4-digit year
    full_year := CAST(year_part AS integer);
    IF full_year <= EXTRACT(YEAR FROM CURRENT_DATE)::integer - 2000 THEN
      full_year := full_year + 2000;
    ELSE
      full_year := full_year + 1900;
    END IF;

    -- Attempt to construct date from ID number
    BEGIN
      id_date := make_date(full_year, CAST(month_part AS integer), CAST(day_part AS integer));
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;

    -- Validate that ID date matches provided date of birth
    RETURN id_date = date_of_birth;
  END;
END;
$$;

-- Drop all versions of check_fuel_transaction_invoice_integrity
DROP FUNCTION IF EXISTS check_fuel_transaction_invoice_integrity() CASCADE;
DROP FUNCTION IF EXISTS check_fuel_transaction_invoice_integrity(uuid) CASCADE;

-- Recreate as trigger function
CREATE FUNCTION check_fuel_transaction_invoice_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_total numeric;
  v_transaction_total numeric;
BEGIN
  -- Get invoice total
  SELECT total_amount INTO v_invoice_total
  FROM fuel_transaction_invoices
  WHERE id = NEW.invoice_id;

  -- Get transaction total
  v_transaction_total := NEW.total_amount;

  -- Check if amounts match (within 1 cent tolerance)
  IF ABS(v_invoice_total - v_transaction_total) > 0.01 THEN
    RAISE EXCEPTION 'Invoice total (%) does not match transaction total (%)', 
      v_invoice_total, v_transaction_total;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate as regular function
CREATE FUNCTION check_fuel_transaction_invoice_integrity(
  p_invoice_id uuid
) RETURNS TABLE (
  is_valid boolean,
  discrepancies jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_total numeric;
  v_transaction_total numeric;
  v_invoice_fuel_amount numeric;
  v_transaction_fuel_amount numeric;
  v_invoice_oil_amount numeric;
  v_transaction_oil_amount numeric;
  v_discrepancies jsonb := '[]'::jsonb;
  v_is_valid boolean := true;
BEGIN
  -- Get invoice totals
  SELECT total_amount, fuel_amount, oil_total_amount
  INTO v_invoice_total, v_invoice_fuel_amount, v_invoice_oil_amount
  FROM fuel_transaction_invoices
  WHERE id = p_invoice_id;

  -- If invoice not found, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, jsonb_build_array(
      jsonb_build_object('field', 'invoice', 'message', 'Invoice not found')
    );
    RETURN;
  END IF;

  -- Get transaction totals
  SELECT total_amount, (liters * price_per_liter), COALESCE(oil_total_amount, 0)
  INTO v_transaction_total, v_transaction_fuel_amount, v_transaction_oil_amount
  FROM fuel_transactions
  WHERE invoice_id = p_invoice_id;

  -- If transaction not found, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, jsonb_build_array(
      jsonb_build_object('field', 'transaction', 'message', 'Transaction not found')
    );
    RETURN;
  END IF;

  -- Check total amount
  IF ABS(v_invoice_total - v_transaction_total) > 0.01 THEN
    v_is_valid := false;
    v_discrepancies := v_discrepancies || jsonb_build_object(
      'field', 'total_amount',
      'invoice_value', v_invoice_total,
      'transaction_value', v_transaction_total,
      'difference', v_invoice_total - v_transaction_total
    );
  END IF;

  -- Check fuel amount
  IF ABS(v_invoice_fuel_amount - v_transaction_fuel_amount) > 0.01 THEN
    v_is_valid := false;
    v_discrepancies := v_discrepancies || jsonb_build_object(
      'field', 'fuel_amount',
      'invoice_value', v_invoice_fuel_amount,
      'transaction_value', v_transaction_fuel_amount,
      'difference', v_invoice_fuel_amount - v_transaction_fuel_amount
    );
  END IF;

  -- Check oil amount
  IF ABS(COALESCE(v_invoice_oil_amount, 0) - COALESCE(v_transaction_oil_amount, 0)) > 0.01 THEN
    v_is_valid := false;
    v_discrepancies := v_discrepancies || jsonb_build_object(
      'field', 'oil_amount',
      'invoice_value', v_invoice_oil_amount,
      'transaction_value', v_transaction_oil_amount,
      'difference', COALESCE(v_invoice_oil_amount, 0) - COALESCE(v_transaction_oil_amount, 0)
    );
  END IF;

  RETURN QUERY SELECT v_is_valid, v_discrepancies;
END;
$$;

COMMENT ON FUNCTION validate_id_number_dob() IS 'Trigger function to validate South African ID number against date of birth with immutable search_path';
COMMENT ON FUNCTION validate_id_number_dob(text, date) IS 'Validates South African ID number against date of birth with immutable search_path';
COMMENT ON FUNCTION check_fuel_transaction_invoice_integrity() IS 'Trigger function to validate invoice integrity with immutable search_path';
COMMENT ON FUNCTION check_fuel_transaction_invoice_integrity(uuid) IS 'Validates invoice integrity against transaction data with immutable search_path';

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION validate_id_number_dob() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_id_number_dob(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION check_fuel_transaction_invoice_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION check_fuel_transaction_invoice_integrity(uuid) TO authenticated;

-- Recreate triggers if they were dropped
DROP TRIGGER IF EXISTS validate_driver_id_number ON drivers;
CREATE TRIGGER validate_driver_id_number
  BEFORE INSERT OR UPDATE ON drivers
  FOR EACH ROW
  WHEN (NEW.id_number IS NOT NULL AND NEW.date_of_birth IS NOT NULL)
  EXECUTE FUNCTION validate_id_number_dob();
