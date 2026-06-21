/*
  # Add Monthly Driver Fee Support

  1. Changes
    - `organizations`: adds `monthly_fee_per_driver` (numeric, nullable) — per-org override for driver fee
    - `global_settings`: seeds `monthly_fee_per_driver` default key with value 0

  2. Notes
    - Mirrors the existing `monthly_fee_per_vehicle` / `monthly_fee_per_vehicle` global setting pattern exactly
    - Default is 0 so no accidental charges are raised before the fee is explicitly configured
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'monthly_fee_per_driver'
  ) THEN
    ALTER TABLE organizations ADD COLUMN monthly_fee_per_driver numeric DEFAULT NULL;
  END IF;
END $$;

INSERT INTO global_settings (key, value)
VALUES ('monthly_fee_per_driver', '0')
ON CONFLICT (key) DO NOTHING;
