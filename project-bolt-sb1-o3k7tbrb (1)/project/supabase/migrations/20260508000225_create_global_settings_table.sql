/*
  # Create global_settings table

  Stores system-wide configuration values managed by super admins.

  1. New Table
    - `global_settings`
      - `id` (uuid, primary key)
      - `key` (text, unique) — setting identifier
      - `value` (text) — setting value stored as text
      - `description` (text) — human-readable description
      - `updated_at` (timestamptz) — last modified
      - `updated_by` (uuid, FK auth.users) — who last changed it

  2. Seed Row
    - key = 'monthly_fee_per_vehicle', value = '10', description = 'Default monthly fee charged per active vehicle (ZAR)'

  3. Security
    - Enable RLS
    - Super admins (profiles.role = 'super_admin') can read and update
    - No insert/delete from client side — row is pre-seeded
*/

CREATE TABLE IF NOT EXISTS global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can read all settings
CREATE POLICY "Super admins can read global settings"
  ON global_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Super admins can update settings
CREATE POLICY "Super admins can update global settings"
  ON global_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Seed the default monthly vehicle fee
INSERT INTO global_settings (key, value, description)
VALUES ('monthly_fee_per_vehicle', '10', 'Default monthly fee charged per active vehicle (ZAR)')
ON CONFLICT (key) DO NOTHING;
