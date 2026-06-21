/*
  # Add entity type to organizations

  Adds two columns to the organizations table to capture the legal entity type
  for organization (company) accounts:

  1. New Columns
    - `entity_type` (text) — one of: 'Company', 'Closed Corporation', 'Trust',
      'Partnership', 'Other'. NULL for individual accounts.
    - `entity_type_other` (text) — free-text description used only when
      entity_type = 'Other'. NULL otherwise.

  2. No RLS changes required — these columns are covered by existing
     organizations table policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE organizations ADD COLUMN entity_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'entity_type_other'
  ) THEN
    ALTER TABLE organizations ADD COLUMN entity_type_other text;
  END IF;
END $$;
