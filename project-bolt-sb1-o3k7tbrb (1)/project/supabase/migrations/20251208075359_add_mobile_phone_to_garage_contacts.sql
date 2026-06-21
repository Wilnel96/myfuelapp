/*
  # Add Mobile Phone Field to Garage Contact Persons

  1. Changes
    - Update existing contact_persons to include mobile_phone field
    - Migrate existing contact_phone to mobile_phone in contact_persons
    - Structure: { name, email, phone (landline), mobile_phone, password, is_primary }

  2. Notes
    - This migration updates all existing contact_persons records
    - Mobile phone is the primary contact method
    - Phone can be used for landline/office numbers
*/

-- Update existing contact_persons to add mobile_phone field
UPDATE garages
SET contact_persons = (
  SELECT jsonb_agg(
    elem || jsonb_build_object('mobile_phone', COALESCE(elem->>'phone', ''))
  )
  FROM jsonb_array_elements(contact_persons) AS elem
)
WHERE contact_persons IS NOT NULL
  AND contact_persons != '[]'::jsonb
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(contact_persons) AS elem
    WHERE elem ? 'mobile_phone'
  );