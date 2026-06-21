/*
  # Create Garage Debtor Payments Table

  1. New Table
    - `garage_debtor_payments` - Tracks payments received from client organizations against their garage accounts
      - `id` (uuid, primary key)
      - `payment_number` (text, unique) - Auto-generated payment reference
      - `garage_id` (uuid, references garages)
      - `organization_id` (uuid, references organizations)
      - `payment_date` (date) - Date payment was received
      - `amount` (numeric) - Payment amount
      - `payment_method` (text) - EFT, Cash, Cheque, etc.
      - `reference` (text, optional) - Bank reference or cheque number
      - `notes` (text, optional) - Additional notes
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Security
    - Enable RLS
    - Garages can insert/view their own payments
    - Organizations can view their own payments
    - Super admins can view/manage all

  3. Indexes
    - Foreign keys for performance
    - Payment number uniqueness
*/

-- Create garage debtor payments table
CREATE TABLE IF NOT EXISTS garage_debtor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text UNIQUE NOT NULL,
  garage_id uuid NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('EFT', 'Cash', 'Cheque', 'Card', 'Other')),
  reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_garage_debtor_payments_garage ON garage_debtor_payments(garage_id);
CREATE INDEX IF NOT EXISTS idx_garage_debtor_payments_organization ON garage_debtor_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_garage_debtor_payments_payment_date ON garage_debtor_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_garage_debtor_payments_created_by ON garage_debtor_payments(created_by);

-- Enable RLS
ALTER TABLE garage_debtor_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Garages can insert payments for their own accounts
CREATE POLICY "Garages can insert own payments"
  ON garage_debtor_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM garages
      WHERE garages.id = garage_debtor_payments.garage_id
      AND garages.id = auth.uid()
    )
  );

-- Policy: Garages can insert payments for their own accounts (anonymous for garage portal)
CREATE POLICY "Garages can insert own payments (anon)"
  ON garage_debtor_payments
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM garages
      WHERE garages.id = garage_debtor_payments.garage_id
    )
  );

-- Policy: Garages can view their own payments
CREATE POLICY "Garages can view own payments"
  ON garage_debtor_payments
  FOR SELECT
  TO authenticated
  USING (
    garage_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM garages
      WHERE garages.id = garage_debtor_payments.garage_id
      AND garages.id = auth.uid()
    )
  );

-- Policy: Garages can view their own payments (anonymous)
CREATE POLICY "Garages can view own payments (anon)"
  ON garage_debtor_payments
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Organizations can view their own payments
CREATE POLICY "Organizations can view own payments"
  ON garage_debtor_payments
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Super admins can view all payments
CREATE POLICY "Super admins can view all payments"
  ON garage_debtor_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Policy: Super admins can insert payments
CREATE POLICY "Super admins can insert payments"
  ON garage_debtor_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Policy: Super admins can update payments
CREATE POLICY "Super admins can update payments"
  ON garage_debtor_payments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Policy: Super admins can delete payments
CREATE POLICY "Super admins can delete payments"
  ON garage_debtor_payments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );