/*
  # Create Invoices System

  1. New Tables
    - `invoices`: Monthly invoices for organizations
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `invoice_number` (text, unique)
      - `invoice_date` (date)
      - `billing_period_start` (date)
      - `billing_period_end` (date)
      - `subtotal` (numeric)
      - `vat_amount` (numeric)
      - `vat_rate` (numeric)
      - `total_amount` (numeric)
      - `amount_paid` (numeric)
      - `amount_outstanding` (numeric)
      - `payment_terms` (text)
      - `payment_due_date` (date)
      - `status` (text: issued, paid, partially_paid, overdue, cancelled)
      - `issued_at` (timestamptz)
      - `paid_at` (timestamptz, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `invoice_sequences`: Track invoice numbering per organization
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations, unique)
      - `prefix` (text, default 'INV-')
      - `current_number` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `invoice_line_items`: Individual items on invoices
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key to invoices)
      - `line_number` (integer)
      - `description` (text)
      - `quantity` (integer)
      - `unit_price` (numeric)
      - `line_total` (numeric)
      - `item_type` (text: monthly_fee, fuel_charge, late_fee, adjustment)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage invoices
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  invoice_number text NOT NULL UNIQUE,
  invoice_date date NOT NULL,
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  vat_amount numeric NOT NULL CHECK (vat_amount >= 0),
  vat_rate numeric NOT NULL CHECK (vat_rate >= 0 AND vat_rate <= 1),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  amount_paid numeric DEFAULT 0 CHECK (amount_paid >= 0),
  amount_outstanding numeric NOT NULL CHECK (amount_outstanding >= 0),
  payment_terms text DEFAULT '30-Days',
  payment_due_date date NOT NULL,
  status text DEFAULT 'issued' CHECK (status IN ('issued', 'paid', 'partially_paid', 'overdue', 'cancelled')),
  issued_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create invoice_sequences table
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  prefix text DEFAULT 'INV-',
  current_number integer DEFAULT 0 CHECK (current_number >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  line_number integer NOT NULL CHECK (line_number > 0),
  description text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  line_total numeric NOT NULL CHECK (line_total >= 0),
  item_type text DEFAULT 'monthly_fee' CHECK (item_type IN ('monthly_fee', 'fuel_charge', 'late_fee', 'adjustment')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(invoice_id, line_number)
);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_period ON invoices(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

-- RLS Policies for invoices
CREATE POLICY "Super admins can do everything with invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
      AND o.name = 'Super Admin Organization'
    )
  );

CREATE POLICY "Management org users can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.name = 'Management Organization'
    )
  );

CREATE POLICY "Organizations can view their own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for invoice_sequences
CREATE POLICY "Super admins can manage invoice sequences"
  ON invoice_sequences FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
      AND o.name = 'Super Admin Organization'
    )
  );

CREATE POLICY "Management org can view invoice sequences"
  ON invoice_sequences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.name = 'Management Organization'
    )
  );

-- RLS Policies for invoice_line_items
CREATE POLICY "Super admins can manage line items"
  ON invoice_line_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
      AND o.name = 'Super Admin Organization'
    )
  );

CREATE POLICY "Management org users can view all line items"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.name = 'Management Organization'
    )
  );

CREATE POLICY "Organizations can view their invoice line items"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND i.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
