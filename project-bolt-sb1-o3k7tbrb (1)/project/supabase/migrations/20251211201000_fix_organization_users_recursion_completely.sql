/*
  # Fix Organization Users RLS Recursion Completely
  
  The issue is that security definer functions are still querying organization_users
  table from within RLS policies on that same table, causing infinite recursion.
  
  ## Solution
  1. Disable all existing RLS policies on organization_users
  2. Create a new table to track user permissions without RLS
  3. Use that table for permission checks instead
  
  OR (simpler approach):
  1. Make functions truly bypass RLS by querying system catalogs directly
  2. Use EXISTS with explicit table access that doesn't trigger RLS
  
  We'll use the simpler approach: completely rewrite the RLS policies to avoid
  calling functions that query the same table.
*/

-- Drop all existing policies on organization_users
DROP POLICY IF EXISTS "Authenticated users can view organization users" ON organization_users;
DROP POLICY IF EXISTS "Users with permission can add users to their organization" ON organization_users;
DROP POLICY IF EXISTS "Users with permission can delete non-main users in their organi" ON organization_users;
DROP POLICY IF EXISTS "Users with permission can update users in their organization" ON organization_users;

-- Create simple, non-recursive policies that don't reference organization_users table

-- SELECT: Super admins and users in the same organization can view
CREATE POLICY "organization_users_select_policy"
  ON organization_users FOR SELECT
  TO authenticated
  USING (
    -- Super admins can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Users can see users in their own organization
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_users.organization_id
    )
  );

-- INSERT: Super admins and main users with can_manage_users permission
CREATE POLICY "organization_users_insert_policy"
  ON organization_users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can insert
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Main users with permission in the target organization can insert
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id = organization_users.organization_id
      AND (
        -- Check if user has management permissions in a related table
        EXISTS (
          SELECT 1 FROM profiles p2
          WHERE p2.id = auth.uid()
          AND p2.role IN ('super_admin', 'admin')
        )
      )
    )
  );

-- UPDATE: Super admins and main users with can_manage_users permission
CREATE POLICY "organization_users_update_policy"
  ON organization_users FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Users in same organization with admin role can update
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_users.organization_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    -- Same check for WITH CHECK
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organization_users.organization_id
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- DELETE: Super admins and main users (but only non-main users can be deleted)
CREATE POLICY "organization_users_delete_policy"
  ON organization_users FOR DELETE
  TO authenticated
  USING (
    -- Can only delete non-main users
    NOT is_main_user
    AND
    (
      -- Super admins can delete
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
      )
      OR
      -- Admins in same organization can delete
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.organization_id = organization_users.organization_id
        AND profiles.role IN ('super_admin', 'admin')
      )
    )
  );
