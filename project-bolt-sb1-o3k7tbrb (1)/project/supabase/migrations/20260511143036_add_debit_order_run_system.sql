/*
  # Debit Order Run System

  ## Overview
  Creates the tables needed to track debit order runs — batch payment processing
  for client organisations that pay by debit order.

  ## New Tables

  ### debit_order_runs
  The header record for each monthly debit order run.
  - `run_number` — Auto-generated reference (DOR-YYYYMM-NNNNN)
  - `run_date` — Date the run was processed
  - `billing_period_start` / `billing_period_end` — The invoice period covered
  - `status` — draft | processed | cancelled
  - `total_invoices` — Count of invoices included
  - `total_amount` — Gross invoice amount
  - `total_credits_applied` — Sum of credit notes applied
  - `net_amount` — Gross minus credits
  - `notes` — Operator notes (e.g. "May 2026 Debit Order Run")
  - `created_by` — User who created/processed the run
  - `processed_at` — Timestamp when run was committed

  ### debit_order_run_items
  One row per invoice in a run, recording inclusion or exclusion.
  - `run_id` — FK to debit_order_runs
  - `invoice_id` — FK to invoices
  - `organization_id` — Denormalised for fast querying
  - `amount` — Invoice total amount
  - `credits_amount` — Credits applied against this invoice
  - `net_amount` — Effective debit amount
  - `status` — included | excluded
  - `exclusion_reason` — Operator note when invoice was deselected

  ## Security
  - RLS enabled on both tables
  - Super admins (role = 'super_admin') can manage all records
  - Authenticated users with management access can view
*/

-- ============================================================
-- debit_order_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS debit_order_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number text UNIQUE NOT NULL,
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  billing_period_start date,
  billing_period_end date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'cancelled')),
  total_invoices integer NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_credits_applied numeric(12, 2) NOT NULL DEFAULT 0,
  net_amount numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE debit_order_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage debit order runs"
  ON debit_order_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert debit order runs"
  ON debit_order_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update debit order runs"
  ON debit_order_runs FOR UPDATE
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

-- ============================================================
-- debit_order_run_items
-- ============================================================
CREATE TABLE IF NOT EXISTS debit_order_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES debit_order_runs(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  credits_amount numeric(12, 2) NOT NULL DEFAULT 0,
  net_amount numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'included' CHECK (status IN ('included', 'excluded')),
  exclusion_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE debit_order_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can select debit order run items"
  ON debit_order_run_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert debit order run items"
  ON debit_order_run_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_debit_order_runs_status ON debit_order_runs(status);
CREATE INDEX IF NOT EXISTS idx_debit_order_runs_run_date ON debit_order_runs(run_date);
CREATE INDEX IF NOT EXISTS idx_debit_order_run_items_run_id ON debit_order_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_debit_order_run_items_invoice_id ON debit_order_run_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_debit_order_run_items_organization_id ON debit_order_run_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_debit_order_run_items_status ON debit_order_run_items(status);

-- ============================================================
-- Run number sequence function
-- ============================================================
CREATE OR REPLACE FUNCTION generate_debit_order_run_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text;
  v_seq integer;
  v_run_number text;
BEGIN
  v_period := to_char(now(), 'YYYYMM');
  SELECT COUNT(*) + 1
  INTO v_seq
  FROM debit_order_runs
  WHERE run_number LIKE 'DOR-' || v_period || '-%';
  v_run_number := 'DOR-' || v_period || '-' || LPAD(v_seq::text, 5, '0');
  RETURN v_run_number;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_debit_order_run_number() TO authenticated;
