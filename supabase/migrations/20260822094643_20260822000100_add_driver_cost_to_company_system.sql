/*
# Driver Cost-to-Company and Total Running Cost Feature

## Overview
Adds driver employment cost tracking (salary/pension/etc), per-client opt-in for cost-to-company,
user access permissions for employment data confidentiality, and manual trip completion time.

## New Tables
- `driver_employment_costs`: Stores per-driver cost-to-company data (weekly cost, standard hours, hourly rate).
  Physically separated from the drivers table to reinforce salary confidentiality at the database level.

## New Columns
### organizations
- `use_driver_cost_to_company` (boolean, default false): Per-client opt-in flag for driver cost-to-company.

### organization_users
- `can_view_driver_employment` (boolean, default false): User can view driver employment/salary data.
- `can_edit_driver_employment` (boolean, default false): User can edit driver employment/salary data.

### vehicle_transactions
- `manual_return_time` (timestamptz, nullable): Manual trip completion time for unreturned vehicles.

## Security
- RLS enabled on driver_employment_costs.
- SELECT policy: Only same-org users with can_view_driver_employment (or main/secondary main user, or super admin) can read.
- INSERT/UPDATE policy: Only same-org users with can_edit_driver_employment (or main/secondary main user, or super admin) can write.
- DELETE policy: Only super admin or main/secondary main user can delete.
- Garage users are explicitly excluded — they have no path to this table.
- A SECURITY DEFINER helper function `can_view_driver_employment` and `can_edit_driver_employment` are created
  to avoid RLS recursion on organization_users.

## Important Notes
1. Employment cost data is per-driver — each driver can have different weekly cost and hours.
2. The hourly rate is computed automatically (weekly_cost / standard_hours) and stored for query efficiency.
3. These permissions are only relevant for client organization users and super admin.
4. The manual_return_time column allows entering a trip completion time when a driver neglects to return a vehicle.
*/

-- ============================================================
-- 1. Add use_driver_cost_to_company to organizations
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations'
    AND column_name = 'use_driver_cost_to_company'
  ) THEN
    ALTER TABLE organizations ADD COLUMN use_driver_cost_to_company boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 2. Add employment permission columns to organization_users
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_users'
    AND column_name = 'can_view_driver_employment'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_view_driver_employment boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_users'
    AND column_name = 'can_edit_driver_employment'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN can_edit_driver_employment boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 3. Add manual_return_time to vehicle_transactions
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_transactions'
    AND column_name = 'manual_return_time'
  ) THEN
    ALTER TABLE vehicle_transactions ADD COLUMN manual_return_time timestamptz;
  END IF;
END $$;

-- ============================================================
-- 4. Create driver_employment_costs table
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_employment_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  weekly_cost_to_company numeric(12,2) NOT NULL DEFAULT 0,
  standard_weekly_hours numeric(6,2) NOT NULL DEFAULT 40,
  hourly_rate numeric(12,4) GENERATED ALWAYS AS (
    CASE WHEN standard_weekly_hours > 0
      THEN weekly_cost_to_company / standard_weekly_hours
      ELSE 0
    END
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(driver_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_employment_costs_driver ON driver_employment_costs(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_employment_costs_org ON driver_employment_costs(organization_id);

ALTER TABLE driver_employment_costs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Helper SECURITY DEFINER functions to avoid RLS recursion
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_view_driver_employment(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  -- Super admin always has access
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Main or secondary main user in the organization can view
  IF EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND is_active = true
    AND (is_main_user = true OR is_secondary_main_user = true)
  ) THEN
    RETURN true;
  END IF;

  -- User with explicit can_view_driver_employment permission
  RETURN EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND is_active = true
    AND can_view_driver_employment = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_driver_employment(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  -- Super admin always has access
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Main or secondary main user in the organization can edit
  IF EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND is_active = true
    AND (is_main_user = true OR is_secondary_main_user = true)
  ) THEN
    RETURN true;
  END IF;

  -- User with explicit can_edit_driver_employment permission
  RETURN EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND is_active = true
    AND can_edit_driver_employment = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_driver_employment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_driver_employment(uuid) TO authenticated;

-- ============================================================
-- 6. RLS policies on driver_employment_costs
-- ============================================================
DROP POLICY IF EXISTS "select_driver_employment_costs" ON driver_employment_costs;
CREATE POLICY "select_driver_employment_costs"
ON driver_employment_costs FOR SELECT
TO authenticated
USING (can_view_driver_employment(organization_id));

DROP POLICY IF EXISTS "insert_driver_employment_costs" ON driver_employment_costs;
CREATE POLICY "insert_driver_employment_costs"
ON driver_employment_costs FOR INSERT
TO authenticated
WITH CHECK (can_edit_driver_employment(organization_id));

DROP POLICY IF EXISTS "update_driver_employment_costs" ON driver_employment_costs;
CREATE POLICY "update_driver_employment_costs"
ON driver_employment_costs FOR UPDATE
TO authenticated
USING (can_edit_driver_employment(organization_id))
WITH CHECK (can_edit_driver_employment(organization_id));

DROP POLICY IF EXISTS "delete_driver_employment_costs" ON driver_employment_costs;
CREATE POLICY "delete_driver_employment_costs"
ON driver_employment_costs FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
  OR EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
    AND organization_id = driver_employment_costs.organization_id
    AND is_active = true
    AND (is_main_user = true OR is_secondary_main_user = true)
  )
);

-- ============================================================
-- 7. Update existing organizations update policy to allow
--    users to set use_driver_cost_to_company on their own org
-- ============================================================
-- The existing organizations update policy already handles main user / super admin.
-- No change needed — the new column is covered by the existing UPDATE policy.