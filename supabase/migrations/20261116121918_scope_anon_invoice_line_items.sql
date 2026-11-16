/*
  # Scope anon invoice line item reads and lock the overdue summary view

  1. Problem
     - The anon policy on invoice_line_items exposed every line of every
       garage-managed organization's invoices to the public key.
     - The overdue_invoices_summary view carried write privileges for anon.

  2. Changes
     - Bind the anon line item read to the current driver session's organization.
     - Revoke all but SELECT on overdue_invoices_summary from anon and authenticated.
*/

DROP POLICY IF EXISTS "anon can read invoice line items for garage managed orgs" ON invoice_line_items;

CREATE POLICY "anon can read own org invoice line items" ON invoice_line_items
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_line_items.invoice_id
        AND i.organization_id = current_driver_org_id()
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.overdue_invoices_summary FROM anon, authenticated;
REVOKE SELECT ON public.overdue_invoices_summary FROM anon;
