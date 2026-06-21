/*
  # Add Reactivate Functions for Soft-Deleted Items

  1. New Functions
    - `reactivate_vehicle(vehicle_id)` - Restores a soft-deleted vehicle
    - `reactivate_driver(driver_id)` - Restores a soft-deleted driver
    
  2. Behavior
    - Clears the deleted_at and deleted_by timestamps
    - Returns success/error status
    - Only allows reactivation of items that belong to user's organization
    - Super admins can reactivate any item
*/

-- Function to reactivate a soft-deleted vehicle
CREATE OR REPLACE FUNCTION reactivate_vehicle(vehicle_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  vehicle_org_id uuid;
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

  -- Check if vehicle is actually deleted
  IF NOT EXISTS (
    SELECT 1 FROM vehicles WHERE id = vehicle_id AND deleted_at IS NOT NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle is not deleted');
  END IF;

  -- Reactivate the vehicle
  UPDATE vehicles
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = vehicle_id;

  RETURN json_build_object('success', true, 'message', 'Vehicle reactivated successfully');
END;
$$;

-- Function to reactivate a soft-deleted driver
CREATE OR REPLACE FUNCTION reactivate_driver(driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  driver_org_id uuid;
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

  -- Check if driver is actually deleted
  IF NOT EXISTS (
    SELECT 1 FROM drivers WHERE id = driver_id AND deleted_at IS NOT NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Driver is not deleted');
  END IF;

  -- Reactivate the driver
  UPDATE drivers
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = driver_id;

  RETURN json_build_object('success', true, 'message', 'Driver reactivated successfully');
END;
$$;

COMMENT ON FUNCTION reactivate_vehicle(uuid) IS 'Reactivates a soft-deleted vehicle by clearing deleted_at and deleted_by timestamps';
COMMENT ON FUNCTION reactivate_driver(uuid) IS 'Reactivates a soft-deleted driver by clearing deleted_at and deleted_by timestamps';