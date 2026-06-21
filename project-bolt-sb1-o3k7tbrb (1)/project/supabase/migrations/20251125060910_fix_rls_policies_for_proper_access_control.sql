/*
  # Fix RLS Policies for Proper Access Control

  ## Summary
  Fixes overly permissive RLS policies to properly implement the access control requirements:
  - Super Admin: Can manage all garages and all client organizations
  - Clients: Can only manage their own vehicles and drivers
  - All authenticated users: Can search/view all garages

  ## Changes Made

  ### 1. Vehicles Table
  - Removed overly permissive policies that allowed any user to insert/update/delete ANY vehicle
  - Added proper policies that restrict clients to only manage vehicles in their own organization
  - Super admin can still view all vehicles (existing policy retained)

  ### 2. Garages Table
  - Removed overly permissive insert/update/delete policies
  - Restricted garage management to super admins only
  - Kept read access for all authenticated users (clients can search garages)

  ### 3. Organizations Table
  - Removed permissive insert policy that allowed any user to create organizations
  - Restricted organization creation to super admins only
  - Clients can still view and update their own organization

  ## Security Notes
  - All policies now follow principle of least privilege
  - Super admins retain full access across all tables
  - Clients are properly isolated to their organization's data
  - Garages remain searchable by all clients
*/

-- Fix Vehicles RLS Policies
DROP POLICY IF EXISTS "Users can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can delete vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can view vehicles" ON vehicles;

CREATE POLICY "Users can view vehicles in their organization"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert vehicles in their organization"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update vehicles in their organization"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete vehicles in their organization"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Fix Garages RLS Policies
DROP POLICY IF EXISTS "Users can insert garages" ON garages;
DROP POLICY IF EXISTS "Users can update garages" ON garages;
DROP POLICY IF EXISTS "Users can delete garages" ON garages;
DROP POLICY IF EXISTS "Users can view garages" ON garages;

-- Keep existing super admin and child org policies, just remove the overly permissive ones
-- The existing "Child orgs can view garages" policy already allows all authenticated users to view
-- The existing "Parent org can manage garages" policy already allows super admins to manage

-- Fix Organizations RLS Policies
DROP POLICY IF EXISTS "Users can insert organizations" ON organizations;

CREATE POLICY "Super admins can insert organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
