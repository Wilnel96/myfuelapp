/*
  # Add PrDP and Medical Certificate Fields to Drivers

  1. Changes
    - Add `has_prdp` boolean field to track if driver has a Professional Driving Permit
    - Add `prdp_type` text field for the type of PrDP (Passengers, Goods, or Dangerous Goods)
    - Add `prdp_expiry_date` date field for PrDP expiration date
    - Add `medical_certificate_on_file` boolean field to track if medical certificate is on file

  2. Notes
    - `has_prdp` defaults to false
    - `prdp_type` is nullable and only set when `has_prdp` is true
    - `prdp_expiry_date` is nullable and only set when `has_prdp` is true
    - `medical_certificate_on_file` defaults to false
*/

DO $$
BEGIN
  -- Add has_prdp column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'has_prdp'
  ) THEN
    ALTER TABLE drivers ADD COLUMN has_prdp boolean DEFAULT false NOT NULL;
  END IF;

  -- Add prdp_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'prdp_type'
  ) THEN
    ALTER TABLE drivers ADD COLUMN prdp_type text;
  END IF;

  -- Add prdp_expiry_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'prdp_expiry_date'
  ) THEN
    ALTER TABLE drivers ADD COLUMN prdp_expiry_date date;
  END IF;

  -- Add medical_certificate_on_file column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'medical_certificate_on_file'
  ) THEN
    ALTER TABLE drivers ADD COLUMN medical_certificate_on_file boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add constraint to ensure prdp_type is one of the valid values when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_prdp_type_check'
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_prdp_type_check
      CHECK (prdp_type IS NULL OR prdp_type IN ('PrDP - Passengers', 'PrDP - Goods', 'PrDP - Dangerous Goods'));
  END IF;
END $$;