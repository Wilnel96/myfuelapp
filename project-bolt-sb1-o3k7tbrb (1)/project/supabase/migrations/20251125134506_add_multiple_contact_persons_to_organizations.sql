/*
  # Add Multiple Contact Persons to Organizations

  1. Changes
    - Add new columns for multiple contact persons:
      - contact_person_main (primary user)
      - contact_person_finance
      - contact_person_vehicles
      - contact_person_drivers
      - contact_person_garages
    - Keep the existing contact_person field for backwards compatibility
    - All new fields are optional (nullable)

  2. Notes
    - Each contact person field can store name, phone, email in text format
    - Main user will have full permissions
    - This supports the hierarchical user permission system
*/

-- Add multiple contact person fields to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contact_person_main'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contact_person_main text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contact_person_finance'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contact_person_finance text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contact_person_vehicles'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contact_person_vehicles text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contact_person_drivers'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contact_person_drivers text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contact_person_garages'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contact_person_garages text;
  END IF;
END $$;
