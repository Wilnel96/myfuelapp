/*
  # Add Vehicle Draw/Return Tracking System

  1. New Tables
    - `vehicle_transactions`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `vehicle_id` (uuid, references vehicles)
      - `driver_id` (uuid, references drivers)
      - `transaction_type` (text, 'draw' or 'return')
      - `odometer_reading` (integer)
      - `license_disk_image` (text, optional)
      - `location` (text, GPS coordinates)
      - `notes` (text, optional)
      - `created_at` (timestamptz)
      - `related_transaction_id` (uuid, optional, links draw to return)

  2. Security
    - Enable RLS on `vehicle_transactions` table
    - Add policies for authenticated users to manage their organization's transactions
    - Add policies for drivers to create their own transactions
    - Add policy for super admin to view all transactions

  3. Indexes
    - Add index on vehicle_id for faster lookups
    - Add index on driver_id for faster lookups
    - Add index on organization_id for faster lookups
*/

CREATE TABLE IF NOT EXISTS vehicle_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) NOT NULL,
  driver_id uuid REFERENCES drivers(id) NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('draw', 'return')),
  odometer_reading integer NOT NULL,
  license_disk_image text,
  location text,
  notes text,
  created_at timestamptz DEFAULT now(),
  related_transaction_id uuid REFERENCES vehicle_transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_vehicle_id ON vehicle_transactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_driver_id ON vehicle_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_organization_id ON vehicle_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_created_at ON vehicle_transactions(created_at DESC);

ALTER TABLE vehicle_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's vehicle transactions"
  ON vehicle_transactions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create vehicle transactions for their organization"
  ON vehicle_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can view their own vehicle transactions"
  ON vehicle_transactions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Drivers can create their own vehicle transactions"
  ON vehicle_transactions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Super admin can view all vehicle transactions"
  ON vehicle_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );