/*
  # Remove plain-text passwords from garage contact_persons

  ## Summary
  This migration removes the legacy plain-text `password` field from the
  `contact_persons` JSONB array stored on each garage row.

  ## Background
  Previously, garage contacts had passwords stored in plain text inside the
  contact_persons JSON column as part of a legacy authentication fallback.
  Authentication is now handled exclusively through Supabase Auth, so storing
  passwords in the database is unnecessary and a security risk.

  ## Changes
  - Strips the `password` key from every object in the `contact_persons` array
    for all garage rows that contain it.

  ## Security
  - No data loss: only the insecure password field is removed.
  - Contact details (name, surname, email, phone, mobile_phone, is_primary)
    are preserved.
*/

UPDATE garages
SET contact_persons = (
  SELECT jsonb_agg(contact - 'password')
  FROM jsonb_array_elements(contact_persons) AS contact
)
WHERE contact_persons IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(contact_persons) AS contact
    WHERE contact ? 'password'
  );
