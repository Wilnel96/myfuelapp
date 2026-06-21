/*
  # Add password field to garages table

  1. Changes
    - Add `password` column to `garages` table for garage portal authentication
    - Password will be stored as plain text for simple authentication (similar to drivers)
    - This allows garage contact persons to login and manage their fuel prices

  2. Security
    - Password field is optional during initial creation
    - Can be set/updated later by system administrators
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garages' AND column_name = 'password'
  ) THEN
    ALTER TABLE garages ADD COLUMN password text;
  END IF;
END $$;