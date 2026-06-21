/*
  # Fix Security Definer Views and Function Search Paths
  
  This migration:
  1. Removes SECURITY DEFINER from views to prevent privilege escalation
  2. Sets explicit search_path for all functions to prevent search_path attacks
  
  Views fixed:
  - garage_daily_sales
  - vehicle_statistics
  - driver_statistics
  
  Functions fixed:
  - update_organization_users_updated_at
  - handle_new_user
  - auto_create_organization_user
  - auto_update_user_title
  - auto_grant_secondary_main_user_permissions
  - toggle_secondary_main_user
  - check_can_remove_main_user
  - transfer_main_user
  - remove_secondary_main_user_with_role
  - get_garage_primary_contact
*/

-- =====================================================
-- FIX SECURITY DEFINER VIEWS
-- =====================================================

DROP VIEW IF EXISTS garage_daily_sales;
CREATE VIEW garage_daily_sales AS
  SELECT 
    g.id as garage_id,
    g.name as garage_name,
    DATE(ft.transaction_date) as sale_date,
    COUNT(ft.id) as transaction_count,
    SUM(ft.liters) as total_liters,
    SUM(ft.total_amount) as total_amount
  FROM garages g
  LEFT JOIN fuel_transactions ft ON ft.garage_id = g.id
  GROUP BY g.id, g.name, DATE(ft.transaction_date);

DROP VIEW IF EXISTS vehicle_statistics;
CREATE VIEW vehicle_statistics AS
  SELECT 
    v.id as vehicle_id,
    v.license_plate,
    v.organization_id,
    COUNT(ft.id) as fuel_transaction_count,
    COALESCE(SUM(ft.liters), 0) as total_liters_consumed,
    COALESCE(SUM(ft.total_amount), 0) as total_fuel_cost,
    COALESCE(AVG(ft.liters), 0) as avg_liters_per_fill,
    MAX(ft.transaction_date) as last_fuel_date
  FROM vehicles v
  LEFT JOIN fuel_transactions ft ON ft.vehicle_id = v.id
  GROUP BY v.id, v.license_plate, v.organization_id;

DROP VIEW IF EXISTS driver_statistics;
CREATE VIEW driver_statistics AS
  SELECT 
    d.id as driver_id,
    d.first_name,
    d.last_name,
    d.organization_id,
    COUNT(ft.id) as fuel_transaction_count,
    COALESCE(SUM(ft.liters), 0) as total_liters,
    COALESCE(SUM(ft.total_amount), 0) as total_amount,
    MAX(ft.transaction_date) as last_transaction_date
  FROM drivers d
  LEFT JOIN fuel_transactions ft ON ft.driver_id = d.id
  GROUP BY d.id, d.first_name, d.last_name, d.organization_id;

-- =====================================================
-- FIX FUNCTION SEARCH PATHS
-- =====================================================

-- update_organization_users_updated_at
CREATE OR REPLACE FUNCTION update_organization_users_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  org_id uuid;
  org_name text;
  user_name text;
  user_surname text;
BEGIN
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    'Organization'
  );
  
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
  user_surname := COALESCE(NEW.raw_user_meta_data->>'surname', '');
  
  INSERT INTO organizations (name, status)
  VALUES (org_name, 'active')
  RETURNING id INTO org_id;
  
  INSERT INTO profiles (id, organization_id, email, full_name, role)
  VALUES (
    NEW.id,
    org_id,
    NEW.email,
    user_name || ' ' || user_surname,
    'admin'
  );
  
  INSERT INTO organization_users (user_id, organization_id, is_main_user, is_active, title, first_name, surname, email)
  VALUES (NEW.id, org_id, true, true, 'Main User', user_name, user_surname, NEW.email);
  
  RETURN NEW;
END;
$$;

-- auto_create_organization_user
CREATE OR REPLACE FUNCTION auto_create_organization_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO organization_users (user_id, organization_id, is_main_user, is_active, title)
  VALUES (NEW.id, NEW.organization_id, true, true, 'Main User')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- auto_update_user_title
CREATE OR REPLACE FUNCTION auto_update_user_title()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_main_user = true THEN
    NEW.title := 'Main User';
  ELSIF NEW.is_secondary_main_user = true THEN
    NEW.title := 'Secondary Main User';
  END IF;
  
  RETURN NEW;
END;
$$;

-- auto_grant_secondary_main_user_permissions
CREATE OR REPLACE FUNCTION auto_grant_secondary_main_user_permissions()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_secondary_main_user = true THEN
    NEW.can_add_vehicles := true;
    NEW.can_edit_vehicles := true;
    NEW.can_delete_vehicles := true;
    NEW.can_add_drivers := true;
    NEW.can_edit_drivers := true;
    NEW.can_delete_drivers := true;
    NEW.can_view_reports := true;
    NEW.can_create_reports := true;
    NEW.can_manage_users := true;
    NEW.can_edit_organization_info := true;
    NEW.can_view_financial_data := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- toggle_secondary_main_user
DROP FUNCTION IF EXISTS toggle_secondary_main_user(uuid, uuid);
CREATE FUNCTION toggle_secondary_main_user(p_user_id uuid, p_org_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_status boolean;
BEGIN
  SELECT is_secondary_main_user INTO current_status
  FROM organization_users
  WHERE user_id = p_user_id
    AND organization_id = p_org_id;
  
  IF current_status = true THEN
    UPDATE organization_users
    SET is_secondary_main_user = false, title = 'User'
    WHERE user_id = p_user_id
      AND organization_id = p_org_id;
  ELSE
    UPDATE organization_users
    SET is_secondary_main_user = true, title = 'Secondary Main User'
    WHERE user_id = p_user_id
      AND organization_id = p_org_id;
  END IF;
END;
$$;

-- check_can_remove_main_user
DROP FUNCTION IF EXISTS check_can_remove_main_user(uuid, uuid);
CREATE FUNCTION check_can_remove_main_user(p_user_id uuid, p_org_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  main_user_count int;
BEGIN
  SELECT COUNT(*)
  INTO main_user_count
  FROM organization_users
  WHERE organization_id = p_org_id
    AND is_main_user = true
    AND is_active = true;
  
  RETURN main_user_count > 1;
END;
$$;

-- transfer_main_user
DROP FUNCTION IF EXISTS transfer_main_user(uuid, uuid, uuid);
CREATE FUNCTION transfer_main_user(p_old_user_id uuid, p_new_user_id uuid, p_org_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE organization_users
  SET is_main_user = false, title = 'User'
  WHERE user_id = p_old_user_id
    AND organization_id = p_org_id;
  
  UPDATE organization_users
  SET is_main_user = true, title = 'Main User'
  WHERE user_id = p_new_user_id
    AND organization_id = p_org_id;
END;
$$;

-- remove_secondary_main_user_with_role
DROP FUNCTION IF EXISTS remove_secondary_main_user_with_role(uuid, uuid, text);
CREATE FUNCTION remove_secondary_main_user_with_role(p_user_id uuid, p_org_id uuid, p_new_role text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE organization_users
  SET is_secondary_main_user = false, title = p_new_role
  WHERE user_id = p_user_id
    AND organization_id = p_org_id;
END;
$$;

-- get_garage_primary_contact
DROP FUNCTION IF EXISTS get_garage_primary_contact(uuid);
CREATE FUNCTION get_garage_primary_contact(p_garage_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  primary_contact jsonb;
BEGIN
  SELECT contact_persons->0
  INTO primary_contact
  FROM garages
  WHERE id = p_garage_id
  LIMIT 1;
  
  RETURN primary_contact;
END;
$$;
