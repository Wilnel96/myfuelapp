/*
  # Update Soft Delete to Show Inactive Status

  1. Changes
    - Update RLS policies to show deleted items (they should be visible but marked inactive)
    - Soft deleted items remain visible to users but show as "Inactive"
    - Add year-end cleanup function to permanently delete items after financial year end
    
  2. Behavior
    - When user "deletes" a vehicle/driver, it's marked with deleted_at timestamp
    - Item remains visible in the list but shows as "Inactive"
    - Items stay in database until year-end cleanup runs
    - After financial year end, system can permanently remove old inactive items
*/

-- Update vehicles SELECT policies to show all items including soft-deleted
DROP POLICY IF EXISTS "Users can view active vehicles in their organization" ON vehicles;
DROP POLICY IF EXISTS "Super admin can view all vehicles including deleted" ON vehicles;
DROP POLICY IF EXISTS "Anonymous users can view active vehicles for driver app" ON vehicles;

-- Create new policies that show ALL vehicles (including soft-deleted)
CREATE POLICY "Users can view all vehicles in their organization"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
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
  );

CREATE POLICY "Super admin can view all vehicles"
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

-- Update drivers SELECT policies to show all items including soft-deleted
DROP POLICY IF EXISTS "Users can view active drivers in their organization" ON drivers;
DROP POLICY IF EXISTS "Super admin can view all drivers including deleted" ON drivers;
DROP POLICY IF EXISTS "Anonymous users can view active drivers for authentication" ON drivers;

-- Create new policies that show ALL drivers (including soft-deleted)
CREATE POLICY "Users can view all drivers in their organization"
  ON drivers FOR SELECT
  TO authenticated
  USING (
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
  );

CREATE POLICY "Super admin can view all drivers"
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

-- Add function to permanently delete vehicles/drivers after year-end
CREATE OR REPLACE FUNCTION cleanup_deleted_items_after_year_end()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year_end date;
  deleted_vehicles_count int;
  deleted_drivers_count int;
BEGIN
  -- Calculate year end (December 31 of previous year)
  current_year_end := date_trunc('year', CURRENT_DATE)::date - interval '1 day';
  
  -- Only super admin can run this
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Only super admin can run year-end cleanup');
  END IF;

  -- Count and delete vehicles marked as deleted before year-end
  WITH deleted_vehicles AS (
    DELETE FROM vehicles
    WHERE deleted_at IS NOT NULL
    AND deleted_at::date <= current_year_end
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_vehicles_count FROM deleted_vehicles;

  -- Count and delete drivers marked as deleted before year-end
  WITH deleted_drivers AS (
    DELETE FROM drivers
    WHERE deleted_at IS NOT NULL
    AND deleted_at::date <= current_year_end
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_drivers_count FROM deleted_drivers;

  RETURN json_build_object(
    'success', true, 
    'vehicles_deleted', deleted_vehicles_count,
    'drivers_deleted', deleted_drivers_count,
    'year_end_processed', current_year_end
  );
END;
$$;

COMMENT ON FUNCTION cleanup_deleted_items_after_year_end() IS 'Permanently deletes vehicles and drivers that were soft-deleted before the end of the previous financial year. Should be run after year-end closing.';