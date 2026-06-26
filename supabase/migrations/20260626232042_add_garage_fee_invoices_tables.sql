
-- Consolidated garage fee invoices (one per garage per billing period)
CREATE TABLE IF NOT EXISTS garage_fee_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  invoice_date date NOT NULL,
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,4) NOT NULL DEFAULT 0.15,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  amount_outstanding numeric(12,2) NOT NULL DEFAULT 0,
  payment_terms text,
  payment_due_date date,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','paid','partially_paid','overdue','cancelled')),
  issued_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (garage_id, billing_period_start, billing_period_end)
);

-- Line items per sub-client within a consolidated garage fee invoice
CREATE TABLE IF NOT EXISTS garage_fee_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES garage_fee_invoices(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  item_type text,
  sub_client_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  sub_client_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_garage_fee_invoices_garage_id ON garage_fee_invoices(garage_id);
CREATE INDEX IF NOT EXISTS idx_garage_fee_invoices_status ON garage_fee_invoices(status);
CREATE INDEX IF NOT EXISTS idx_garage_fee_invoice_line_items_invoice_id ON garage_fee_invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_garage_fee_invoice_line_items_sub_client ON garage_fee_invoice_line_items(sub_client_org_id);

ALTER TABLE garage_fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE garage_fee_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Management (super_admin) can do everything
CREATE POLICY "mgmt_select_garage_fee_invoices" ON garage_fee_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "mgmt_insert_garage_fee_invoices" ON garage_fee_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mgmt_update_garage_fee_invoices" ON garage_fee_invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mgmt_delete_garage_fee_invoices" ON garage_fee_invoices FOR DELETE TO authenticated USING (true);

CREATE POLICY "mgmt_select_garage_fee_line_items" ON garage_fee_invoice_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "mgmt_insert_garage_fee_line_items" ON garage_fee_invoice_line_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mgmt_update_garage_fee_line_items" ON garage_fee_invoice_line_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mgmt_delete_garage_fee_line_items" ON garage_fee_invoice_line_items FOR DELETE TO authenticated USING (true);
