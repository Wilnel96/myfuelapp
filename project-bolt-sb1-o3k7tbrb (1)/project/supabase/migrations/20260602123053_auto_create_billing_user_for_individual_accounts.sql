/*
  # Auto-create Billing User for individual accounts

  1. Problem
    - When an individual signs up via the edge function with create_billing_user_from_main=true,
      the Billing User row is created correctly going forward.
    - However, existing accounts (e.g. Garth Muller) that were created before this fix
      have no Billing User row, so the billing section appears empty in Organization Details.
    - Also, the handle_new_user trigger (used for direct signups, not edge function)
      does not create a Billing User row.

  2. Solution
    - Backfill any organization that has a Main User but NO Billing User row:
      insert a Billing User row copying the Main User's details.
    - Update handle_new_user() to also insert a Billing User row.

  3. Changes
    - Backfill INSERT for orgs missing a Billing User
    - Updated handle_new_user() function
*/

-- ============================================================
-- 1. Backfill: insert Billing User rows for orgs that are missing one
-- ============================================================
INSERT INTO organization_users (
  user_id,
  organization_id,
  email,
  first_name,
  surname,
  title,
  phone_office,
  phone_mobile,
  is_main_user,
  is_active,
  role,
  can_add_vehicles,
  can_edit_vehicles,
  can_delete_vehicles,
  can_add_drivers,
  can_edit_drivers,
  can_delete_drivers,
  can_view_reports,
  can_edit_organization_info,
  can_view_fuel_transactions,
  can_create_reports,
  can_view_custom_reports,
  can_manage_users,
  can_view_financial_data
)
SELECT
  mu.user_id,
  mu.organization_id,
  mu.email,
  mu.first_name,
  mu.surname,
  'Billing User',
  mu.phone_office,
  mu.phone_mobile,
  false,
  true,
  'user',
  mu.can_add_vehicles,
  mu.can_edit_vehicles,
  mu.can_delete_vehicles,
  mu.can_add_drivers,
  mu.can_edit_drivers,
  mu.can_delete_drivers,
  mu.can_view_reports,
  mu.can_edit_organization_info,
  mu.can_view_fuel_transactions,
  mu.can_create_reports,
  mu.can_view_custom_reports,
  mu.can_manage_users,
  mu.can_view_financial_data
FROM organization_users mu
JOIN organizations o ON o.id = mu.organization_id
WHERE mu.is_main_user = true
  AND o.organization_type = 'individual'
  AND NOT EXISTS (
    SELECT 1 FROM organization_users bu
    WHERE bu.organization_id = mu.organization_id
      AND bu.title = 'Billing User'
  );

-- ============================================================
-- 2. Update handle_new_user to also create a Billing User row
--    (used for direct auth signups not going through edge function)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  org_id uuid;
  org_name text;
  user_name text;
  user_surname text;
  is_org_user boolean;
BEGIN
  -- If this is a user created by the edge function (has organization_id in metadata),
  -- skip — the edge function handles everything.
  is_org_user := (NEW.raw_user_meta_data->>'organization_id') IS NOT NULL;
  IF is_org_user THEN
    RETURN NEW;
  END IF;

  org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', 'Organization');
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
  user_surname := COALESCE(NEW.raw_user_meta_data->>'surname', '');

  -- Create organization
  INSERT INTO organizations (name, status)
  VALUES (org_name, 'active')
  RETURNING id INTO org_id;

  -- Create profile
  INSERT INTO profiles (id, organization_id, email, full_name, role)
  VALUES (NEW.id, org_id, NEW.email, user_name || ' ' || user_surname, 'admin');

  -- Create Main User row (role='main_user' triggers auto_grant_main_user_permissions)
  INSERT INTO organization_users (
    user_id, organization_id, is_main_user, is_active, role,
    title, first_name, surname, email
  )
  VALUES (
    NEW.id, org_id, true, true, 'main_user',
    'Main User', user_name, user_surname, NEW.email
  );

  -- Also create a Billing User row pointing to the same person
  INSERT INTO organization_users (
    user_id, organization_id, is_main_user, is_active, role,
    title, first_name, surname, email
  )
  VALUES (
    NEW.id, org_id, false, true, 'user',
    'Billing User', user_name, user_surname, NEW.email
  );

  RETURN NEW;
END;
$function$;
