/*
  # Add Structured Contact Persons to Organizations

  1. Changes
    - Add JSONB columns for structured contact information
    - Each contact field stores: { name: string, surname: string, email: string, phone: string }
    - Contact types:
      - main_contact (previously "Contact Person")
      - vehicle_contact (for vehicle management)
      - driver_contact (for driver management)
      - billing_contact (for billing/finance)
    
  2. Notes
    - Using JSONB for flexible structured data
    - All fields are optional (nullable)
    - Existing text fields (contact_person_main, etc.) remain for backward compatibility
*/

-- Add structured contact person fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'main_contact'
  ) THEN
    ALTER TABLE organizations ADD COLUMN main_contact jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'vehicle_contact'
  ) THEN
    ALTER TABLE organizations ADD COLUMN vehicle_contact jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'driver_contact'
  ) THEN
    ALTER TABLE organizations ADD COLUMN driver_contact jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'billing_contact'
  ) THEN
    ALTER TABLE organizations ADD COLUMN billing_contact jsonb;
  END IF;
END $$;
