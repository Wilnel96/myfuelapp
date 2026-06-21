/*
  # Split Garage Contact Name to Name and Surname

  1. Changes
    - Split the `name` field in contact_persons JSONB to separate `name` and `surname` fields
    - Extract surname (last word) from full name
    - Keep remaining text as first name
    - Structure: { name, surname, email, phone, mobile_phone, password, is_primary }

  2. Notes
    - This makes garage contacts consistent with organization_users structure
    - Splits on last space to separate first name and surname
    - If no space found, entire name goes to `name` field and surname is empty
*/

-- Update existing contact_persons to split name into name and surname
UPDATE garages
SET contact_persons = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'name' LIKE '% %' THEN
        -- Has a space, split into name and surname
        elem - 'name' || jsonb_build_object(
          'name', substring(elem->>'name' from '^(.+)\s'),
          'surname', substring(elem->>'name' from '\s([^\s]+)$')
        )
      ELSE
        -- No space, put everything in name field with empty surname
        elem - 'name' || jsonb_build_object(
          'name', elem->>'name',
          'surname', ''
        )
    END
  )
  FROM jsonb_array_elements(contact_persons) AS elem
)
WHERE contact_persons IS NOT NULL
  AND contact_persons != '[]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(contact_persons) AS elem
    WHERE elem ? 'name' AND NOT (elem ? 'surname')
  );