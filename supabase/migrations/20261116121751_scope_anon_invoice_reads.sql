/*
  # Scope anon invoice reads to the driver's own organization

  1. Problem
     - The anon policy on invoices allowed reading every invoice of every
       garage-managed organization, so the public key exposed other clients' billing.

  2. Changes
     - Require the invoice to belong to the organization of the current driver session.
*/

DROP POLICY IF EXISTS "anon can read invoices for garage managed orgs" ON invoices;

CREATE POLICY "anon can read own org invoices" ON invoices
  FOR SELECT TO anon
  USING (organization_id = current_driver_org_id());
