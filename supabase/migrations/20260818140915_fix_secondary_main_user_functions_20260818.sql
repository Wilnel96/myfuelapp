-- Recreate both secondary main user functions with SECURITY DEFINER, fixed search_path,
-- and proper grants. The remove function was dropped during security cleanup migrations.

-- 1. toggle_secondary_main_user: promotes/demotes secondary main user status
CREATE OR REPLACE FUNCTION public.toggle_secondary_main_user(user_id_to_toggle uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status boolean;
BEGIN
  SELECT is_secondary_main_user INTO current_status
  FROM organization_users
  WHERE id = user_id_to_toggle;

  IF current_status = false OR current_status IS NULL THEN
    -- Promote: set flag, title, and grant all permissions
    UPDATE organization_users
    SET 
      is_secondary_main_user = true,
      title = 'Secondary Main User',
      can_add_vehicles = true,
      can_edit_vehicles = true,
      can_delete_vehicles = true,
      can_add_drivers = true,
      can_edit_drivers = true,
      can_delete_drivers = true,
      can_view_reports = true,
      can_edit_organization_info = true,
      can_view_fuel_transactions = true,
      can_create_reports = true,
      can_view_custom_reports = true,
      can_manage_users = true,
      can_view_financial_data = true
    WHERE id = user_id_to_toggle;
  ELSE
    -- Demote: just remove the flag (permissions handled separately)
    UPDATE organization_users
    SET is_secondary_main_user = false
    WHERE id = user_id_to_toggle;
  END IF;
END;
$$;

-- 2. remove_secondary_main_user_with_role: demotes and assigns new role + permissions
CREATE OR REPLACE FUNCTION public.remove_secondary_main_user_with_role(
  user_id_to_demote uuid,
  new_title text,
  new_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE organization_users
  SET 
    is_secondary_main_user = false,
    title = new_title,
    can_add_vehicles = COALESCE((new_permissions->>'can_add_vehicles')::boolean, false),
    can_edit_vehicles = COALESCE((new_permissions->>'can_edit_vehicles')::boolean, false),
    can_delete_vehicles = COALESCE((new_permissions->>'can_delete_vehicles')::boolean, false),
    can_add_drivers = COALESCE((new_permissions->>'can_add_drivers')::boolean, false),
    can_edit_drivers = COALESCE((new_permissions->>'can_edit_drivers')::boolean, false),
    can_delete_drivers = COALESCE((new_permissions->>'can_delete_drivers')::boolean, false),
    can_view_reports = COALESCE((new_permissions->>'can_view_reports')::boolean, false),
    can_edit_organization_info = COALESCE((new_permissions->>'can_edit_organization_info')::boolean, false),
    can_view_fuel_transactions = COALESCE((new_permissions->>'can_view_fuel_transactions')::boolean, false),
    can_create_reports = COALESCE((new_permissions->>'can_create_reports')::boolean, false),
    can_view_custom_reports = COALESCE((new_permissions->>'can_view_custom_reports')::boolean, false),
    can_manage_users = COALESCE((new_permissions->>'can_manage_users')::boolean, false),
    can_view_financial_data = COALESCE((new_permissions->>'can_view_financial_data')::boolean, false)
  WHERE id = user_id_to_demote 
    AND is_secondary_main_user = true;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not a Secondary Main User or does not exist';
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.toggle_secondary_main_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_secondary_main_user_with_role(uuid, text, jsonb) TO authenticated;
