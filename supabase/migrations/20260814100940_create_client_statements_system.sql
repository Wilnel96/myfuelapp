/*
# Create Client Statements System

1. New Tables
- `client_statements`: Stores statement runs for client organizations
  - `id` (uuid, primary key)
  - `organization_id` (uuid, FK to organizations) — the client being stated
  - `statement_number` (text, unique) — auto-generated number
  - `statement_date` (date) — date the statement was generated
  - `period_start` (date) — start of the statement period
  - `period_end` (date) — end of the statement period
  - `opening_balance` (numeric, default 0) — outstanding balance at period start
  - `total_invoiced` (numeric, default 0) — total of invoices in the period
  - `total_paid` (numeric, default 0) — total payments received in the period
  - `total_credit_notes` (numeric, default 0) — total credit notes in the period
  - `closing_balance` (numeric, default 0) — outstanding balance at period end
  - `status` (text, default 'draft') — draft, sent, archived
  - `sent_to_email` (text, nullable) — email address the statement was sent to
  - `sent_at` (timestamptz, nullable) — when the statement was emailed
  - `created_by` (uuid, nullable) — user who created the statement
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `client_statements`.
- Super admins and management org users can manage all statements.
- Client users can view their own organization's statements (read-only).
*/

CREATE TABLE IF NOT EXISTS client_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  statement_number text UNIQUE NOT NULL,
  statement_date date NOT NULL DEFAULT CURRENT_DATE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  opening_balance numeric NOT NULL DEFAULT 0,
  total_invoiced numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  total_credit_notes numeric NOT NULL DEFAULT 0,
  closing_balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  sent_to_email text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_statements ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
DROP POLICY IF EXISTS "super_admin_all_client_statements" ON client_statements;
CREATE POLICY "super_admin_all_client_statements"
ON client_statements FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

-- Management org users can read all statements
DROP POLICY IF EXISTS "mgmt_read_client_statements" ON client_statements;
CREATE POLICY "mgmt_read_client_statements"
ON client_statements FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN organization_users ou ON ou.user_id = p.id
    WHERE p.id = auth.uid()
    AND ou.is_main_user = true
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.is_management_org = true
      AND o.id = ou.organization_id
    )
  )
);

-- Client users can read their own org's statements
DROP POLICY IF EXISTS "client_read_own_statements" ON client_statements;
CREATE POLICY "client_read_own_statements"
ON client_statements FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.organization_id = client_statements.organization_id
  )
);

-- Create index for lookups by organization
CREATE INDEX IF NOT EXISTS idx_client_statements_org_id ON client_statements(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_statements_status ON client_statements(status);
CREATE INDEX IF NOT EXISTS idx_client_statements_period ON client_statements(period_start, period_end);
