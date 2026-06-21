/*
  # Add anonymous RLS policies for garage fee invoices

  ## Summary
  Garages operate without Supabase auth (password-based portal login).
  They need to read fee invoices for their managed clients, and the
  generate-garage-fee-invoices edge function (service role) handles inserts.

  ## Changes
  - Add anonymous SELECT policy on `invoices` scoped to orgs managed by any garage
  - Add anonymous SELECT policy on `invoice_line_items` scoped via the same join
*/

-- Allow anonymous read of invoices for garage-managed organizations
CREATE POLICY "anon can read invoices for garage managed orgs"
  ON invoices FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = invoices.organization_id
        AND o.is_garage_managed = true
        AND o.managing_garage_id IS NOT NULL
    )
  );

-- Allow anonymous read of invoice line items for garage-managed org invoices
CREATE POLICY "anon can read invoice line items for garage managed orgs"
  ON invoice_line_items FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN organizations o ON o.id = i.organization_id
      WHERE i.id = invoice_line_items.invoice_id
        AND o.is_garage_managed = true
        AND o.managing_garage_id IS NOT NULL
    )
  );
