/*
  # Create Vehicle Exceptions Table

  1. New Tables
    - `vehicle_exceptions`
      - `id` (uuid, primary key)
      - `vehicle_id` (uuid, foreign key to vehicles)
      - `driver_id` (uuid, foreign key to drivers)
      - `organization_id` (uuid, foreign key to organizations)
      - `exception_type` (text) - Type of exception (odometer_mismatch, unauthorized_use, etc.)
      - `description` (text) - Detailed description
      - `expected_value` (text) - What was expected (e.g., expected odometer reading)
      - `actual_value` (text) - What was actually recorded
      - `transaction_id` (uuid) - Related vehicle transaction if applicable
      - `resolved` (boolean) - Whether exception has been investigated/resolved
      - `resolved_at` (timestamptz) - When it was resolved
      - `resolved_by` (uuid) - User who resolved it
      - `resolution_notes` (text) - Notes about resolution
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `vehicle_exceptions` table
    - Add policies for authenticated users to read exceptions for their organization
    - Add policies for authenticated users to create exceptions
    - Add policies for users with appropriate permissions to resolve exceptions
    - Super admin can access all exceptions

  3. Indexes
    - Add index on vehicle_id for faster lookups
    - Add index on driver_id for faster lookups
    - Add index on organization_id for faster lookups
    - Add index on resolved status for filtering
*/

-- Create vehicle_exceptions table
CREATE TABLE IF NOT EXISTS vehicle_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  exception_type text NOT NULL,
  description text NOT NULL,
  expected_value text,
  actual_value text,
  transaction_id uuid REFERENCES vehicle_transactions(id) ON DELETE SET NULL,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_vehicle_id ON vehicle_exceptions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_driver_id ON vehicle_exceptions(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_organization_id ON vehicle_exceptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_resolved ON vehicle_exceptions(resolved);
CREATE INDEX IF NOT EXISTS idx_vehicle_exceptions_created_at ON vehicle_exceptions(created_at DESC);

-- Enable RLS
ALTER TABLE vehicle_exceptions ENABLE ROW LEVEL SECURITY;

-- Policy: Super admin can view all exceptions
CREATE POLICY "Super admin can view all exceptions"
  ON vehicle_exceptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Users can view exceptions for their organization
CREATE POLICY "Users can view org exceptions"
  ON vehicle_exceptions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Drivers can view their own exceptions
CREATE POLICY "Drivers can view own exceptions"
  ON vehicle_exceptions
  FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

-- Policy: Authenticated users can create exceptions for their organization's vehicles
CREATE POLICY "Users can create exceptions"
  ON vehicle_exceptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = vehicle_exceptions.vehicle_id
      AND vehicles.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Users with management permissions can update exceptions
CREATE POLICY "Users can update exceptions"
  ON vehicle_exceptions
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vehicle_exceptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER vehicle_exceptions_updated_at
  BEFORE UPDATE ON vehicle_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_exceptions_updated_at();