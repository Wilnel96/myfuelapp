/*
# Maintenance invoice PDF attachments

1. Purpose
Allow users to attach a PDF invoice (proof of maintenance) when logging a
maintenance event, and view/download it later from the maintenance history.

2. New columns
- `vehicle_maintenance_records.invoice_path` (text, nullable): storage path of
  the uploaded invoice PDF inside the private `maintenance-invoices` bucket.
- `vehicle_maintenance_records.invoice_name` (text, nullable): original file
  name of the uploaded invoice, shown in the UI.

3. New storage bucket
- `maintenance-invoices`: private bucket. Files are stored under
  `<organization_id>/<record_id>.pdf` so access is scoped per organization.

4. Security
- Storage RLS policies on `maintenance-invoices`:
  - INSERT/SELECT/UPDATE/DELETE allowed for authenticated users whose profile
    `organization_id` matches the first path segment (the organization folder).
  - Super admins (profile role `super_admin`) get full access to all folders.
- No database table grants change: the new columns ride on the existing table.

5. Notes
- Idempotent: uses `IF NOT EXISTS` for the column additions and drops/recreates
  policies. Existing records are unaffected (both new columns are nullable).
*/

ALTER TABLE vehicle_maintenance_records
  ADD COLUMN IF NOT EXISTS invoice_path text,
  ADD COLUMN IF NOT EXISTS invoice_name text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-invoices', 'maintenance-invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "maintenance_invoice_insert" ON storage.objects;
DROP POLICY IF EXISTS "maintenance_invoice_select" ON storage.objects;
DROP POLICY IF EXISTS "maintenance_invoice_update" ON storage.objects;
DROP POLICY IF EXISTS "maintenance_invoice_delete" ON storage.objects;

CREATE POLICY "maintenance_invoice_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-invoices'
  AND (
    (storage.foldername(name))[1] = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  )
);

CREATE POLICY "maintenance_invoice_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'maintenance-invoices'
  AND (
    (storage.foldername(name))[1] = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  )
);

CREATE POLICY "maintenance_invoice_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'maintenance-invoices'
  AND (
    (storage.foldername(name))[1] = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  )
)
WITH CHECK (
  bucket_id = 'maintenance-invoices'
  AND (
    (storage.foldername(name))[1] = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  )
);

CREATE POLICY "maintenance_invoice_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'maintenance-invoices'
  AND (
    (storage.foldername(name))[1] = (SELECT organization_id::text FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  )
);
