-- Create trailers table for per-client trailer registry
CREATE TABLE IF NOT EXISTS trailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  description TEXT,
  gvm_weight INTEGER NOT NULL DEFAULT 0, -- GVM in kilograms
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Index for organization-scoped queries
CREATE INDEX IF NOT EXISTS idx_trailers_organization_id ON trailers(organization_id);
CREATE INDEX IF NOT EXISTS idx_trailers_status ON trailers(status);

-- Enable RLS
ALTER TABLE trailers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: same pattern as vehicles — org members see their own, super_admin sees all
-- Super admin bypasses RLS via service role; these policies cover authenticated users

-- SELECT: users can see trailers for their own organization
CREATE POLICY "select_own_trailers" ON trailers FOR SELECT
  TO authenticated USING (
    organization_id IN (
      SELECT org_user.organization_id
      FROM organization_users org_user
      WHERE org_user.user_id = auth.uid()
        AND org_user.is_active = true
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = auth.uid()
        AND o.is_management_org = true
        AND o.organization_type = 'management'
    )
  );

-- SELECT for anon (driver mobile app reads trailers during draw)
CREATE POLICY "select_trailers_anon" ON trailers FOR SELECT
  TO anon, authenticated USING (status = 'active' AND deleted_at IS NULL);

-- INSERT: only org members can add trailers
CREATE POLICY "insert_own_trailers" ON trailers FOR INSERT
  TO authenticated WITH CHECK (
    organization_id IN (
      SELECT org_user.organization_id
      FROM organization_users org_user
      WHERE org_user.user_id = auth.uid()
        AND org_user.is_active = true
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = auth.uid()
        AND o.is_management_org = true
        AND o.organization_type = 'management'
    )
  );

-- UPDATE: only org members can edit trailers
CREATE POLICY "update_own_trailers" ON trailers FOR UPDATE
  TO authenticated USING (
    organization_id IN (
      SELECT org_user.organization_id
      FROM organization_users org_user
      WHERE org_user.user_id = auth.uid()
        AND org_user.is_active = true
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = auth.uid()
        AND o.is_management_org = true
        AND o.organization_type = 'management'
    )
  ) WITH CHECK (
    organization_id IN (
      SELECT org_user.organization_id
      FROM organization_users org_user
      WHERE org_user.user_id = auth.uid()
        AND org_user.is_active = true
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = auth.uid()
        AND o.is_management_org = true
        AND o.organization_type = 'management'
    )
  );

-- DELETE: only org members can delete trailers
CREATE POLICY "delete_own_trailers" ON trailers FOR DELETE
  TO authenticated USING (
    organization_id IN (
      SELECT org_user.organization_id
      FROM organization_users org_user
      WHERE org_user.user_id = auth.uid()
        AND org_user.is_active = true
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
    OR organization_id IN (
      SELECT p.organization_id
      FROM profiles p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = auth.uid()
        AND o.is_management_org = true
        AND o.organization_type = 'management'
    )
  );

-- Add trailer_id to vehicle_transactions (nullable — most trips have no trailer)
ALTER TABLE vehicle_transactions ADD COLUMN IF NOT EXISTS trailer_id UUID REFERENCES trailers(id) ON DELETE SET NULL;

-- Create index for trailer_id lookups
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_trailer_id ON vehicle_transactions(trailer_id);

-- Function to check if a driver's license code allows towing a trailer of given GVM weight
-- South African license codes:
--   <= 750 kg trailer: Code B, EB, C1, EC1, C, EC all qualify
--   > 750 kg trailer: Only EB, EC1, EC (codes with E designation) qualify
CREATE OR REPLACE FUNCTION check_driver_trailer_license_qualifies(
  p_driver_license_code TEXT,
  p_trailer_gvm_weight INTEGER
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_trailer_gvm_weight <= 750 THEN
      p_driver_license_code IN ('Code B', 'Code EB', 'Code C1', 'Code EC1', 'Code C', 'Code EC', 'Code A')
    WHEN p_trailer_gvm_weight > 750 THEN
      p_driver_license_code IN ('Code EB', 'Code EC1', 'Code EC')
    ELSE
      false
  END;
$$;

-- Grant execute on the trailer license check function
GRANT EXECUTE ON FUNCTION check_driver_trailer_license_qualifies(TEXT, INTEGER) TO authenticated, anon;
