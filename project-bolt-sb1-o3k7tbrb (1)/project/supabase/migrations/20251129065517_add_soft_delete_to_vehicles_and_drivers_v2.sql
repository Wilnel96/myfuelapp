/*
  # Add Soft Delete to Vehicles and Drivers

  1. Rationale
    - Vehicles and drivers must not be hard deleted until after financial year end
    - Deletion compromises statistics, usage reports, and historical data
    - Client organizations can "delete" items from their view
    - Items remain in system database for data integrity and audit purposes
    
  2. Changes
    - Add deleted_at timestamp to vehicles table
    - Add deleted_by uuid to track who deleted it
    - Add deleted_at timestamp to drivers table
    - Add deleted_by uuid to track who deleted it
    - Update RLS policies to hide soft-deleted items from normal views
    - Super admin can see all records including soft-deleted ones
    
  3. Security
    - Soft deleted items hidden from organization users
    - System maintains complete historical record
    - Supports end-of-year cleanup processes
    - Preserves referential integrity for fuel transactions
*/

-- Add soft delete columns to vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Add soft delete columns to drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Create index for better performance on soft delete queries
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_drivers_deleted_at ON drivers(deleted_at) WHERE deleted_at IS NULL;

-- Drop existing SELECT policies for vehicles
DROP POLICY IF EXISTS "Users can view vehicles in their organization" ON vehicles;
DROP POLICY IF EXISTS "Parent org users can view child org vehicles" ON vehicles;
DROP POLICY IF EXISTS "Super admin can view all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow anonymous users to read vehicles for driver app" ON vehicles;

-- Create new SELECT policies that respect soft deletes
CREATE POLICY "Users can view active vehicles in their organization"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      OR
      organization_id IN (
        SELECT id FROM organizations 
        WHERE parent_org_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Super admin can view all vehicles including deleted"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Anonymous users can view active vehicles for driver app"
  ON vehicles FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

-- Drop existing SELECT policies for drivers
DROP POLICY IF EXISTS "Users can view drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Parent org users can view child org drivers" ON drivers;
DROP POLICY IF EXISTS "Super admin can view all drivers" ON drivers;
DROP POLICY IF EXISTS "Allow anonymous users to read drivers for authentication" ON drivers;

-- Create new SELECT policies that respect soft deletes
CREATE POLICY "Users can view active drivers in their organization"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      OR
      organization_id IN (
        SELECT id FROM organizations 
        WHERE parent_org_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Super admin can view all drivers including deleted"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Anonymous users can view active drivers for authentication"
  ON drivers FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

-- Add helper function to soft delete vehicles
CREATE OR REPLACE FUNCTION soft_delete_vehicle(vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE vehicles
  SET deleted_at = now(),
      deleted_by = auth.uid()
  WHERE id = vehicle_id
  AND deleted_at IS NULL;
END;
$$;

-- Add helper function to soft delete drivers
CREATE OR REPLACE FUNCTION soft_delete_driver(driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE drivers
  SET deleted_at = now(),
      deleted_by = auth.uid()
  WHERE id = driver_id
  AND deleted_at IS NULL;
END;
$$;

-- Add helper function to restore (undelete) vehicles - only for super admin
CREATE OR REPLACE FUNCTION restore_vehicle(vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admin can restore
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admin can restore deleted vehicles';
  END IF;

  UPDATE vehicles
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = vehicle_id;
END;
$$;

-- Add helper function to restore (undelete) drivers - only for super admin
CREATE OR REPLACE FUNCTION restore_driver(driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admin can restore
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admin can restore deleted drivers';
  END IF;

  UPDATE drivers
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = driver_id;
END;
$$;