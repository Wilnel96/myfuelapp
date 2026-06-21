/*
  # Fix Soft Delete Functions

  1. Issue
    - Soft delete functions may be failing due to RLS policies
    - Need to ensure functions have proper permissions and bypass RLS
    
  2. Changes
    - Recreate soft_delete_vehicle function with proper error handling
    - Recreate soft_delete_driver function with proper error handling
    - Add better permission checks
    - Ensure functions can properly update records
*/

-- Drop and recreate soft_delete_vehicle with better permissions
DROP FUNCTION IF EXISTS soft_delete_vehicle(uuid);

CREATE OR REPLACE FUNCTION soft_delete_vehicle(vehicle_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  vehicle_org_id uuid;
  result json;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get user's organization
  SELECT organization_id INTO user_org_id
  FROM profiles
  WHERE id = current_user_id;

  IF user_org_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No organization found');
  END IF;

  -- Get vehicle's organization
  SELECT organization_id INTO vehicle_org_id
  FROM vehicles
  WHERE id = vehicle_id;

  IF vehicle_org_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found');
  END IF;

  -- Check if user has permission (owns vehicle or is parent org or is super admin)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = current_user_id AND role = 'super_admin'
  ) AND vehicle_org_id != user_org_id AND vehicle_org_id NOT IN (
    SELECT id FROM organizations WHERE parent_org_id = user_org_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Perform soft delete
  UPDATE vehicles
  SET deleted_at = now(),
      deleted_by = current_user_id
  WHERE id = vehicle_id
  AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle already deleted or not found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- Drop and recreate soft_delete_driver with better permissions
DROP FUNCTION IF EXISTS soft_delete_driver(uuid);

CREATE OR REPLACE FUNCTION soft_delete_driver(driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  driver_org_id uuid;
  result json;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get user's organization
  SELECT organization_id INTO user_org_id
  FROM profiles
  WHERE id = current_user_id;

  IF user_org_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No organization found');
  END IF;

  -- Get driver's organization
  SELECT organization_id INTO driver_org_id
  FROM drivers
  WHERE id = driver_id;

  IF driver_org_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Driver not found');
  END IF;

  -- Check if user has permission (owns driver or is parent org or is super admin)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = current_user_id AND role = 'super_admin'
  ) AND driver_org_id != user_org_id AND driver_org_id NOT IN (
    SELECT id FROM organizations WHERE parent_org_id = user_org_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Perform soft delete
  UPDATE drivers
  SET deleted_at = now(),
      deleted_by = current_user_id
  WHERE id = driver_id
  AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Driver already deleted or not found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;