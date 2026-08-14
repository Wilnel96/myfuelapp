/*
# Add system_role hierarchy to organization_users

## Summary
Introduces a system_role column on organization_users that defines a
hierarchy for management-org (System Portal) users. A trigger maps the
chosen role onto the existing Back Office boolean permission columns.

## Hierarchy
- system_admin: full access to all Back Office functions
- system_manager: all except editing client financial settings and backup
- system_operator: invoices + fuel price update, no client settings
- system_viewer: read-only across Back Office
- system_back_office: limited view, no fuel price or client settings
- none: no Back Office access (client-portal-style access only)

## New column
- organization_users.system_role (text, NOT NULL DEFAULT 'none')
  CHECK constraint limits to the six allowed values.

## Backfill
- Existing main_user / secondary_main_user rows set to 'system_admin'
- All other rows remain 'none'

## Trigger
- sync_system_role_permissions(): BEFORE INSERT OR UPDATE OF system_role
  trigger that sets the nine Back Office boolean columns from system_role.

## Security
- REVOKE UPDATE on system_role from anon (column-level defense in depth).
  The existing UPDATE RLS policy on organization_users already restricts
  which rows can be updated to main/secondary/super_admin users.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'system_role'
  ) THEN
    ALTER TABLE organization_users
      ADD COLUMN system_role text NOT NULL DEFAULT 'none';
  END IF;
END $$;

ALTER TABLE organization_users DROP CONSTRAINT IF EXISTS organization_users_system_role_check;
ALTER TABLE organization_users ADD CONSTRAINT organization_users_system_role_check
  CHECK (system_role IN (
    'system_admin',
    'system_manager',
    'system_operator',
    'system_viewer',
    'system_back_office',
    'none'
  ));

-- Backfill existing main/secondary main users
UPDATE organization_users
SET system_role = 'system_admin'
WHERE (is_main_user = true OR is_secondary_main_user = true)
  AND system_role = 'none';

CREATE OR REPLACE FUNCTION public.sync_system_role_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.system_role IS DISTINCT FROM OLD.system_role THEN
    CASE NEW.system_role
      WHEN 'system_admin' THEN
        NEW.can_access_back_office       := true;
        NEW.can_view_org_info            := true;
        NEW.can_edit_org_info            := true;
        NEW.can_view_client_settings     := true;
        NEW.can_edit_client_settings     := true;
        NEW.can_view_invoice_management  := true;
        NEW.can_edit_invoice_management  := true;
        NEW.can_view_fuel_price_update   := true;
        NEW.can_edit_fuel_price_update   := true;
      WHEN 'system_manager' THEN
        NEW.can_access_back_office       := true;
        NEW.can_view_org_info            := true;
        NEW.can_edit_org_info            := true;
        NEW.can_view_client_settings     := true;
        NEW.can_edit_client_settings     := false;
        NEW.can_view_invoice_management  := true;
        NEW.can_edit_invoice_management  := true;
        NEW.can_view_fuel_price_update   := true;
        NEW.can_edit_fuel_price_update   := true;
      WHEN 'system_operator' THEN
        NEW.can_access_back_office       := true;
        NEW.can_view_org_info            := true;
        NEW.can_edit_org_info            := false;
        NEW.can_view_client_settings     := false;
        NEW.can_edit_client_settings     := false;
        NEW.can_view_invoice_management  := true;
        NEW.can_edit_invoice_management  := true;
        NEW.can_view_fuel_price_update   := true;
        NEW.can_edit_fuel_price_update   := true;
      WHEN 'system_viewer' THEN
        NEW.can_access_back_office       := true;
        NEW.can_view_org_info            := true;
        NEW.can_edit_org_info            := false;
        NEW.can_view_client_settings     := true;
        NEW.can_edit_client_settings     := false;
        NEW.can_view_invoice_management  := true;
        NEW.can_edit_invoice_management  := false;
        NEW.can_view_fuel_price_update   := true;
        NEW.can_edit_fuel_price_update   := false;
      WHEN 'system_back_office' THEN
        NEW.can_access_back_office       := true;
        NEW.can_view_org_info            := true;
        NEW.can_edit_org_info            := false;
        NEW.can_view_client_settings     := false;
        NEW.can_edit_client_settings     := false;
        NEW.can_view_invoice_management  := true;
        NEW.can_edit_invoice_management  := false;
        NEW.can_view_fuel_price_update   := false;
        NEW.can_edit_fuel_price_update   := false;
      WHEN 'none' THEN
        NEW.can_access_back_office       := false;
        NEW.can_view_org_info            := false;
        NEW.can_edit_org_info            := false;
        NEW.can_view_client_settings     := false;
        NEW.can_edit_client_settings     := false;
        NEW.can_view_invoice_management  := false;
        NEW.can_edit_invoice_management  := false;
        NEW.can_view_fuel_price_update   := false;
        NEW.can_edit_fuel_price_update   := false;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION sync_system_role_permissions() FROM anon;

DROP TRIGGER IF EXISTS trg_sync_system_role_permissions ON organization_users;
CREATE TRIGGER trg_sync_system_role_permissions
  BEFORE INSERT OR UPDATE OF system_role ON organization_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_system_role_permissions();

REVOKE UPDATE (system_role) ON organization_users FROM anon;
