/*
  # Credit Notes System

  ## Overview
  Adds a complete credit note system linked to the existing invoices infrastructure.
  Credit notes allow management to issue full or partial credits against an existing
  invoice when a client queries a charge or an adjustment is required.

  ## New Tables

  ### credit_notes
  - `id` (uuid, pk)
  - `credit_note_number` (text, unique) — formatted CN-YYYYMM-NNNNNN
  - `organization_id` (uuid, fk → organizations)
  - `invoice_id` (uuid, fk → invoices, nullable) — the invoice being credited
  - `credit_note_date` (date)
  - `reason` (text) — free-text reason for the credit
  - `subtotal` (numeric) — pre-VAT credit amount
  - `vat_amount` (numeric) — VAT on the credit
  - `vat_rate` (numeric, 0–1)
  - `total_amount` (numeric) — subtotal + vat_amount
  - `status` (text) — issued | applied | cancelled
  - `issued_by` (uuid, fk → auth.users)
  - `issued_at`, `created_at`, `updated_at` (timestamptz)
  - `notes` (text, nullable)

  ### credit_note_line_items
  - `id` (uuid, pk)
  - `credit_note_id` (uuid, fk → credit_notes)
  - `line_number` (int)
  - `description` (text)
  - `quantity` (numeric)
  - `unit_price` (numeric)
  - `line_total` (numeric)

  ## Sequence
  Reuses the same invoice_sequence table with a separate CN prefix counter stored
  in a new `credit_note_sequence` table (same pattern as invoice_sequence).

  ## Security
  - RLS enabled on both tables
  - Super admins and management org users can read/write all credit notes
  - Client org users can only read their own org's credit notes
*/

-- ─── credit_note_sequence ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_note_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_number integer NOT NULL DEFAULT 0,
  prefix text NOT NULL DEFAULT 'CN',
  created_at timestamptz DEFAULT now()
);

INSERT INTO credit_note_sequence (current_number, prefix)
SELECT 0, 'CN'
WHERE NOT EXISTS (SELECT 1 FROM credit_note_sequence);

-- ─── Function: get_next_credit_note_number ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_next_credit_note_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  next_number INTEGER;
  cn_number TEXT;
  current_year TEXT;
  current_month TEXT;
BEGIN
  current_year  := TO_CHAR(NOW(), 'YYYY');
  current_month := TO_CHAR(NOW(), 'MM');

  UPDATE public.credit_note_sequence
  SET current_number = current_number + 1
  WHERE id = (SELECT id FROM public.credit_note_sequence LIMIT 1)
  RETURNING current_number INTO next_number;

  IF next_number IS NULL THEN
    INSERT INTO public.credit_note_sequence (current_number, prefix)
    VALUES (1, 'CN')
    RETURNING current_number INTO next_number;
  END IF;

  cn_number := 'CN-' || current_year || current_month || '-' || LPAD(next_number::TEXT, 6, '0');
  RETURN cn_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_credit_note_number() TO authenticated;

-- ─── credit_notes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number text UNIQUE NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  vat_amount numeric NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  vat_rate numeric NOT NULL DEFAULT 0.15 CHECK (vat_rate >= 0 AND vat_rate <= 1),
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'applied', 'cancelled')),
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT cn_valid_amounts CHECK (total_amount = subtotal + vat_amount)
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_organization_id ON credit_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_created_at ON credit_notes(created_at DESC);

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

-- Management / super-admin: full access
CREATE POLICY "Management users can select credit notes"
  ON credit_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'management')
    )
  );

CREATE POLICY "Management users can insert credit notes"
  ON credit_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'management')
    )
  );

CREATE POLICY "Management users can update credit notes"
  ON credit_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'management')
    )
  );

-- Client org users: read their own org's credit notes
CREATE POLICY "Client users can select own org credit notes"
  ON credit_notes FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ─── credit_note_line_items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_note_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  line_number integer NOT NULL CHECK (line_number > 0),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total numeric NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE (credit_note_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_cn_line_items_credit_note_id ON credit_note_line_items(credit_note_id);

ALTER TABLE credit_note_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management users can select credit note line items"
  ON credit_note_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'management')
    )
  );

CREATE POLICY "Management users can insert credit note line items"
  ON credit_note_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'management')
    )
  );

CREATE POLICY "Management users can update credit note line items"
  ON credit_note_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'management')
    )
  );

CREATE POLICY "Client users can select own org credit note line items"
  ON credit_note_line_items FOR SELECT
  TO authenticated
  USING (
    credit_note_id IN (
      SELECT cn.id FROM credit_notes cn
      JOIN organization_users ou ON ou.organization_id = cn.organization_id
      WHERE ou.user_id = auth.uid() AND ou.is_active = true
    )
  );

-- ─── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_credit_notes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_notes_updated_at
  BEFORE UPDATE ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_credit_notes_updated_at();
