/*
  # Add Billing Contact Fields to Organizations

  1. Changes
    - Add `billing_contact_name` column to `organizations` table
    - Add `billing_contact_surname` column to `organizations` table  
    - Add `billing_contact_phone_office` column to `organizations` table
    - Add `billing_contact_phone_mobile` column to `organizations` table
    - Existing `billing_email` column will be used for billing contact email

  2. Notes
    - All fields are optional (nullable)
    - These fields store billing contact information for debit orders and invoicing
    - Billing contact may be different from the main user
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'billing_contact_name'
  ) THEN
    ALTER TABLE organizations ADD COLUMN billing_contact_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'billing_contact_surname'
  ) THEN
    ALTER TABLE organizations ADD COLUMN billing_contact_surname text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'billing_contact_phone_office'
  ) THEN
    ALTER TABLE organizations ADD COLUMN billing_contact_phone_office text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'billing_contact_phone_mobile'
  ) THEN
    ALTER TABLE organizations ADD COLUMN billing_contact_phone_mobile text;
  END IF;
END $$;