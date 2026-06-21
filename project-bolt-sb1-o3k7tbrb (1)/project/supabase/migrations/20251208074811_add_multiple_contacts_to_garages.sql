/*
  # Add Multiple Contact Persons Support to Garages

  1. Changes
    - Add `contact_persons` JSONB array field to store multiple contact persons
    - Each contact person has: name, email, phone, password, is_primary
    - Migrate existing contact_person, contact_email, contact_phone, password to contact_persons array
    - Keep old fields for backward compatibility initially
    
  2. Structure
    contact_persons: [
      {
        name: "John Doe",
        email: "john@garage.com",
        phone: "0123456789",
        password: "securepass",
        is_primary: true
      }
    ]

  3. Security
    - All contact persons can login to manage garage prices
    - Primary contact is the main contact person shown in directories
*/

-- Add contact_persons field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'contact_persons'
  ) THEN
    ALTER TABLE garages ADD COLUMN contact_persons JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Migrate existing contact data to contact_persons array
UPDATE garages
SET contact_persons = jsonb_build_array(
  jsonb_build_object(
    'name', COALESCE(contact_person, ''),
    'email', COALESCE(contact_email, ''),
    'phone', COALESCE(contact_phone, ''),
    'password', COALESCE(password, ''),
    'is_primary', true
  )
)
WHERE contact_persons = '[]'::jsonb
  AND (contact_person IS NOT NULL OR contact_email IS NOT NULL);

-- Add a helper function to get primary contact
CREATE OR REPLACE FUNCTION get_garage_primary_contact(garage_row garages)
RETURNS JSONB AS $$
  SELECT elem
  FROM jsonb_array_elements(garage_row.contact_persons) AS elem
  WHERE (elem->>'is_primary')::boolean = true
  LIMIT 1;
$$ LANGUAGE SQL STABLE;