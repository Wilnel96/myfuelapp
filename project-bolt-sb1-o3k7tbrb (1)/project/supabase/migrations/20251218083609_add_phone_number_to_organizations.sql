/*
  # Add phone_number to organizations table
  
  Adds the missing phone_number column that was referenced in early migrations
  but wasn't included in the schema restoration.
  
  1. Changes
    - Add `phone_number` (text) column to organizations table
*/

-- Add phone_number column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' 
    AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE organizations ADD COLUMN phone_number text DEFAULT '';
  END IF;
END $$;
