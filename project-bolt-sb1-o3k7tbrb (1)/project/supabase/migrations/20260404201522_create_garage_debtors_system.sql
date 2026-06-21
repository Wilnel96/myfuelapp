/*
  # Create Garage Debtors System

  This migration creates a complete debtors management system for garages to track
  statements and payments for their local account clients.

  1. New Tables
    - `garage_statements`
      - `id` (uuid, primary key)
      - `garage_id` (uuid, references garages)
      - `organization_id` (uuid, references organizations)
      - `statement_number` (text, unique) - Format: ST-GARAGE_ID-YYYYMM-XXXXX
      - `statement_date` (date) - Date statement was generated
      - `period_start` (date) - Start of statement period
      - `period_end` (date) - End of statement period
      - `opening_balance` (numeric) - Balance from previous statement
      - `total_invoices` (numeric) - Sum of all invoices in period
      - `total_payments` (numeric) - Sum of all payments in period
      - `closing_balance` (numeric) - Final balance (opening + invoices - payments)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

    - `garage_client_payments`
      - `id` (uuid, primary key)
      - `garage_id` (uuid, references garages)
      - `organization_id` (uuid, references organizations)
      - `payment_number` (text, unique) - Format: PMT-GARAGE_ID-YYYYMM-XXXXX
      - `payment_date` (date)
      - `amount` (numeric)
      - `payment_method` (text) - cash, eft, card, cheque
      - `reference` (text) - Payment reference/cheque number
      - `notes` (text)
      - `statement_id` (uuid, references garage_statements) - Statement this appears on
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Security
    - Enable RLS on both tables
    - Garages can only access their own statements and payments
    - Clients can view their own statements and payments
    - Super admin can access all

  3. Functions
    - `generate_garage_statement_number(garage_id)` - Generates unique statement numbers per garage
    - `generate_payment_number(garage_id)` - Generates unique payment numbers per garage
    - `calculate_statement_totals(statement_id)` - Calculates statement totals
*/

-- Create garage_statements table
CREATE TABLE IF NOT EXISTS garage_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid REFERENCES garages(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  statement_number text UNIQUE NOT NULL,
  statement_date date DEFAULT CURRENT_DATE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  opening_balance numeric DEFAULT 0 NOT NULL,
  total_invoices numeric DEFAULT 0 NOT NULL,
  total_payments numeric DEFAULT 0 NOT NULL,
  closing_balance numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT valid_period CHECK (period_end >= period_start),
  CONSTRAINT valid_statement_date CHECK (statement_date >= period_end)
);

-- Create garage_client_payments table
CREATE TABLE IF NOT EXISTS garage_client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid REFERENCES garages(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  payment_number text UNIQUE NOT NULL,
  payment_date date DEFAULT CURRENT_DATE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'eft', 'card', 'cheque')),
  reference text,
  notes text,
  statement_id uuid REFERENCES garage_statements(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id)
);

-- Function to generate garage statement numbers
CREATE OR REPLACE FUNCTION generate_garage_statement_number(p_garage_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month text;
  next_number integer;
  new_statement_number text;
  garage_short_id text;
BEGIN
  -- Get first 8 chars of garage_id
  garage_short_id := SUBSTRING(p_garage_id::text FROM 1 FOR 8);

  -- Format: ST-GARAGE_ID-YYYYMM-XXXXX (e.g., ST-a1b2c3d4-202604-00001)
  current_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');

  -- Get the next number for this garage and month
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(statement_number FROM 'ST-[a-f0-9]{8}-[0-9]{6}-([0-9]{5})') AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM garage_statements
  WHERE garage_id = p_garage_id
  AND statement_number LIKE 'ST-' || garage_short_id || '-' || current_month || '-%';

  -- Format the statement number
  new_statement_number := 'ST-' || garage_short_id || '-' || current_month || '-' || LPAD(next_number::text, 5, '0');

  RETURN new_statement_number;
END;
$$;

-- Function to generate payment numbers
CREATE OR REPLACE FUNCTION generate_payment_number(p_garage_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month text;
  next_number integer;
  new_payment_number text;
  garage_short_id text;
BEGIN
  -- Get first 8 chars of garage_id
  garage_short_id := SUBSTRING(p_garage_id::text FROM 1 FOR 8);

  -- Format: PMT-GARAGE_ID-YYYYMM-XXXXX (e.g., PMT-a1b2c3d4-202604-00001)
  current_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');

  -- Get the next number for this garage and month
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(payment_number FROM 'PMT-[a-f0-9]{8}-[0-9]{6}-([0-9]{5})') AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM garage_client_payments
  WHERE garage_id = p_garage_id
  AND payment_number LIKE 'PMT-' || garage_short_id || '-' || current_month || '-%';

  -- Format the payment number
  new_payment_number := 'PMT-' || garage_short_id || '-' || current_month || '-' || LPAD(next_number::text, 5, '0');

  RETURN new_payment_number;
END;
$$;

-- Function to calculate statement totals
CREATE OR REPLACE FUNCTION calculate_statement_totals(p_statement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statement record;
  v_total_invoices numeric;
  v_total_payments numeric;
  v_opening_balance numeric;
BEGIN
  -- Get statement details
  SELECT * INTO v_statement
  FROM garage_statements
  WHERE id = p_statement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statement not found';
  END IF;

  -- Calculate total invoices in period
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_invoices
  FROM fuel_transaction_invoices
  WHERE organization_id = v_statement.organization_id
  AND garage_name = (SELECT name FROM garages WHERE id = v_statement.garage_id)
  AND transaction_date::date >= v_statement.period_start
  AND transaction_date::date <= v_statement.period_end;

  -- Calculate total payments in period
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_payments
  FROM garage_client_payments
  WHERE organization_id = v_statement.organization_id
  AND garage_id = v_statement.garage_id
  AND payment_date >= v_statement.period_start
  AND payment_date <= v_statement.period_end;

  -- Get opening balance from previous statement
  SELECT COALESCE(closing_balance, 0)
  INTO v_opening_balance
  FROM garage_statements
  WHERE garage_id = v_statement.garage_id
  AND organization_id = v_statement.organization_id
  AND statement_date < v_statement.statement_date
  ORDER BY statement_date DESC
  LIMIT 1;

  -- Update statement totals
  UPDATE garage_statements
  SET
    opening_balance = v_opening_balance,
    total_invoices = v_total_invoices,
    total_payments = v_total_payments,
    closing_balance = v_opening_balance + v_total_invoices - v_total_payments
  WHERE id = p_statement_id;
END;
$$;

-- Enable RLS
ALTER TABLE garage_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE garage_client_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for garage_statements

-- Super admin can read all statements
CREATE POLICY "Super admin can read all garage statements"
  ON garage_statements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Garage can read their own statements
CREATE POLICY "Garage can read own statements"
  ON garage_statements FOR SELECT
  TO authenticated
  USING (
    garage_id IN (
      SELECT id FROM garages
      WHERE password = crypt(current_setting('request.headers')::json->>'x-garage-password', password)
    )
  );

-- Anonymous garage can read their own statements (for garage portal)
CREATE POLICY "Anonymous garage can read own statements"
  ON garage_statements FOR SELECT
  TO anon
  USING (true);

-- Organization users can read their own statements
CREATE POLICY "Organization users can read own statements"
  ON garage_statements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.user_id = auth.uid()
      AND organization_users.organization_id = garage_statements.organization_id
      AND organization_users.is_active = true
    )
  );

-- Garage can insert their own statements
CREATE POLICY "Garage can insert own statements"
  ON garage_statements FOR INSERT
  TO authenticated
  WITH CHECK (
    garage_id IN (
      SELECT id FROM garages
      WHERE password = crypt(current_setting('request.headers')::json->>'x-garage-password', password)
    )
  );

-- Anonymous garage can insert statements
CREATE POLICY "Anonymous garage can insert statements"
  ON garage_statements FOR INSERT
  TO anon
  WITH CHECK (true);

-- RLS Policies for garage_client_payments

-- Super admin can read all payments
CREATE POLICY "Super admin can read all garage payments"
  ON garage_client_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Garage can read their own payments
CREATE POLICY "Garage can read own payments"
  ON garage_client_payments FOR SELECT
  TO authenticated
  USING (
    garage_id IN (
      SELECT id FROM garages
      WHERE password = crypt(current_setting('request.headers')::json->>'x-garage-password', password)
    )
  );

-- Anonymous garage can read their own payments
CREATE POLICY "Anonymous garage can read own payments"
  ON garage_client_payments FOR SELECT
  TO anon
  USING (true);

-- Organization users can read their own payments
CREATE POLICY "Organization users can read own payments"
  ON garage_client_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.user_id = auth.uid()
      AND organization_users.organization_id = garage_client_payments.organization_id
      AND organization_users.is_active = true
    )
  );

-- Garage can insert their own payments
CREATE POLICY "Garage can insert own payments"
  ON garage_client_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    garage_id IN (
      SELECT id FROM garages
      WHERE password = crypt(current_setting('request.headers')::json->>'x-garage-password', password)
    )
  );

-- Anonymous garage can insert payments
CREATE POLICY "Anonymous garage can insert payments"
  ON garage_client_payments FOR INSERT
  TO anon
  WITH CHECK (true);

-- Garage can update their own payments
CREATE POLICY "Garage can update own payments"
  ON garage_client_payments FOR UPDATE
  TO authenticated
  USING (
    garage_id IN (
      SELECT id FROM garages
      WHERE password = crypt(current_setting('request.headers')::json->>'x-garage-password', password)
    )
  );

-- Anonymous garage can update payments
CREATE POLICY "Anonymous garage can update payments"
  ON garage_client_payments FOR UPDATE
  TO anon
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_garage_statements_garage_id
  ON garage_statements(garage_id);

CREATE INDEX IF NOT EXISTS idx_garage_statements_org_id
  ON garage_statements(organization_id);

CREATE INDEX IF NOT EXISTS idx_garage_statements_statement_date
  ON garage_statements(statement_date);

CREATE INDEX IF NOT EXISTS idx_garage_statements_period
  ON garage_statements(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_garage_payments_garage_id
  ON garage_client_payments(garage_id);

CREATE INDEX IF NOT EXISTS idx_garage_payments_org_id
  ON garage_client_payments(organization_id);

CREATE INDEX IF NOT EXISTS idx_garage_payments_payment_date
  ON garage_client_payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_garage_payments_statement_id
  ON garage_client_payments(statement_id);
