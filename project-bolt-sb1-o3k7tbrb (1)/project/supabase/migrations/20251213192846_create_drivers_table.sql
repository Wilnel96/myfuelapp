/*
  # Create drivers table

  1. New Tables
    - `drivers`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `user_id` (uuid, foreign key to profiles/auth.users, nullable for non-system drivers)
      - `first_name` (text)
      - `last_name` (text)
      - `id_number` (text, South African ID number)
      - `date_of_birth` (date)
      - `phone_number` (text)
      - `email` (text)
      - `address` (text)
      - `license_number` (text, driver's license number)
      - `license_type` (text, e.g., Code B, Code C1, etc.)
      - `license_issue_date` (date)
      - `license_expiry_date` (date)
      - `license_restrictions` (text, nullable)
      - `status` (text, active/inactive/suspended)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `drivers` table
    - Add policy for organization members to read drivers in their organization
    - Add policy for organization members to insert drivers
    - Add policy for organization members to update drivers in their organization
    - Add policy for organization members to delete drivers in their organization

  3. Indexes
    - Add index on organization_id for faster lookups
    - Add index on user_id for linking to auth users
    - Add index on license_number for quick searches
*/

CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  id_number text NOT NULL,
  date_of_birth date NOT NULL,
  phone_number text NOT NULL,
  email text,
  address text,
  license_number text NOT NULL,
  license_type text NOT NULL DEFAULT 'Code B',
  license_issue_date date NOT NULL,
  license_expiry_date date NOT NULL,
  license_restrictions text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drivers_organization_id_idx ON drivers(organization_id);
CREATE INDEX IF NOT EXISTS drivers_user_id_idx ON drivers(user_id);
CREATE INDEX IF NOT EXISTS drivers_license_number_idx ON drivers(license_number);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view drivers in their organization"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert drivers in their organization"
  ON drivers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update drivers in their organization"
  ON drivers FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete drivers in their organization"
  ON drivers FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
