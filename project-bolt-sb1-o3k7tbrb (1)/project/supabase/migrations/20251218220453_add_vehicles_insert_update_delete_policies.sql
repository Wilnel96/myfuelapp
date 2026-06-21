/*
  # Add INSERT, UPDATE, and DELETE policies for vehicles table

  1. Policies Added
    - INSERT: Allows authenticated users to insert vehicles in their organization
    - UPDATE: Allows authenticated users to update vehicles in their organization
    - DELETE: Allows authenticated users to soft-delete vehicles in their organization
    
  2. Security
    - All policies check that the user belongs to the organization
    - Uses existing profiles.organization_id for verification
*/

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "vehicles_insert_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_update_policy" ON vehicles;
DROP POLICY IF EXISTS "vehicles_delete_policy" ON vehicles;

-- Allow authenticated users to insert vehicles in their organization
CREATE POLICY "vehicles_insert_policy" 
  ON vehicles 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Allow authenticated users to update vehicles in their organization
CREATE POLICY "vehicles_update_policy" 
  ON vehicles 
  FOR UPDATE 
  TO authenticated 
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Allow authenticated users to soft-delete vehicles in their organization
CREATE POLICY "vehicles_delete_policy" 
  ON vehicles 
  FOR DELETE 
  TO authenticated 
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );