/*
  # Create Fuel Transaction Invoices System

  This migration creates a system for generating and tracking invoices for individual fuel transactions.
  When a driver refuels, an invoice is automatically generated and emailed to the client organization
  for accounting records and tax compliance (Receiver of Revenue).

  1. New Tables
    - `fuel_transaction_invoices`
      - `id` (uuid, primary key)
      - `fuel_transaction_id` (uuid, references fuel_transactions)
      - `organization_id` (uuid, references organizations)
      - `invoice_number` (text, unique) - Format: FT-YYYYMM-XXXXX
      - `invoice_date` (timestamptz)
      - `fuel_type` (text)
      - `liters` (numeric)
      - `price_per_liter` (numeric)
      - `subtotal` (numeric) - Amount before VAT
      - `vat_rate` (numeric) - Default 15%
      - `vat_amount` (numeric)
      - `total_amount` (numeric)
      - `vehicle_registration` (text) - Captured at time of transaction
      - `driver_name` (text) - Captured at time of transaction
      - `garage_name` (text) - Captured at time of transaction
      - `garage_address` (text) - Captured at time of transaction
      - `odometer_reading` (integer)
      - `transaction_date` (timestamptz)
      - `email_sent` (boolean) - Track if email was sent
      - `email_sent_at` (timestamptz)
      - `email_recipient` (text)
      - `pdf_url` (text) - Optional: store PDF invoice URL
      - `created_at` (timestamptz)

  2. Updates to Existing Tables
    - Add `invoice_id` to `fuel_transactions` table to link back to invoice

  3. Security
    - Enable RLS on `fuel_transaction_invoices` table
    - Add policies for authenticated users to read their organization's invoices
    - Super admin can read all invoices

  4. Functions
    - `generate_fuel_invoice_number()` - Generates unique invoice numbers
*/

-- Create fuel_transaction_invoices table
CREATE TABLE IF NOT EXISTS fuel_transaction_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_transaction_id uuid REFERENCES fuel_transactions(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  invoice_number text UNIQUE NOT NULL,
  invoice_date timestamptz DEFAULT now() NOT NULL,
  fuel_type text NOT NULL,
  liters numeric NOT NULL CHECK (liters > 0),
  price_per_liter numeric NOT NULL CHECK (price_per_liter > 0),
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  vat_rate numeric DEFAULT 0.15 NOT NULL CHECK (vat_rate >= 0),
  vat_amount numeric NOT NULL CHECK (vat_amount >= 0),
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  vehicle_registration text NOT NULL,
  driver_name text NOT NULL,
  garage_name text NOT NULL,
  garage_address text,
  odometer_reading integer,
  transaction_date timestamptz NOT NULL,
  email_sent boolean DEFAULT false NOT NULL,
  email_sent_at timestamptz,
  email_recipient text,
  pdf_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add invoice_id to fuel_transactions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN invoice_id uuid REFERENCES fuel_transaction_invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_fuel_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month text;
  next_number integer;
  new_invoice_number text;
BEGIN
  -- Format: FT-YYYYMM-XXXXX (e.g., FT-202512-00001)
  current_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');
  
  -- Get the next number for this month
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(invoice_number FROM 'FT-[0-9]{6}-([0-9]{5})') AS INTEGER
    )
  ), 0) + 1
  INTO next_number
  FROM fuel_transaction_invoices
  WHERE invoice_number LIKE 'FT-' || current_month || '-%';
  
  -- Format the invoice number
  new_invoice_number := 'FT-' || current_month || '-' || LPAD(next_number::text, 5, '0');
  
  RETURN new_invoice_number;
END;
$$;

-- Enable RLS
ALTER TABLE fuel_transaction_invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Super admin can read all fuel transaction invoices
CREATE POLICY "Super admin can read all fuel transaction invoices"
  ON fuel_transaction_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Organization users can read their own organization's fuel transaction invoices
CREATE POLICY "Organization users can read own org fuel transaction invoices"
  ON fuel_transaction_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.user_id = auth.uid()
      AND organization_users.organization_id = fuel_transaction_invoices.organization_id
      AND organization_users.is_active = true
    )
  );

-- Policy: Users from parent organizations can read child organization invoices
CREATE POLICY "Parent org users can read child org fuel transaction invoices"
  ON fuel_transaction_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      JOIN organizations child_org ON child_org.id = fuel_transaction_invoices.organization_id
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = child_org.parent_org_id
      AND ou.is_active = true
    )
  );

-- Policy: System can insert fuel transaction invoices (for edge functions)
CREATE POLICY "System can insert fuel transaction invoices"
  ON fuel_transaction_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fuel_transaction_invoices_org_id 
  ON fuel_transaction_invoices(organization_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transaction_invoices_transaction_id 
  ON fuel_transaction_invoices(fuel_transaction_id);

CREATE INDEX IF NOT EXISTS idx_fuel_transaction_invoices_invoice_date 
  ON fuel_transaction_invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_fuel_transaction_invoices_email_sent 
  ON fuel_transaction_invoices(email_sent);
