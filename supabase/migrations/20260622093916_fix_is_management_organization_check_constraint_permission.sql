-- The is_management_organization function is used in CHECK constraints on
-- vehicles, drivers, and fuel_transactions tables. When any role writes to
-- those tables, PostgreSQL evaluates the CHECK constraint which calls this
-- function. Without SECURITY DEFINER, the calling user needs EXECUTE permission
-- which was revoked in recent security hardening migrations.
--
-- Fix: make the function SECURITY DEFINER so it always runs as the function
-- owner (postgres/superuser) regardless of who triggers the constraint.

CREATE OR REPLACE FUNCTION public.is_management_organization(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = org_id
    AND organization_type = 'management'
  );
$$;

-- Also fix is_client_organization for the same reason (used in same constraints)
CREATE OR REPLACE FUNCTION public.is_client_organization(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = org_id
    AND (organization_type IS NULL OR organization_type = 'client')
  );
$$;
