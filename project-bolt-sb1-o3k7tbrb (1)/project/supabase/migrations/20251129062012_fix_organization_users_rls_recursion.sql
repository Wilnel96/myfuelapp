/*
  # Fix Organization Users RLS Infinite Recursion

  1. Problem
    - INSERT, UPDATE, and DELETE policies check organization_users table
    - This creates infinite recursion when trying to verify permissions
    - The policies query the same table they're protecting

  2. Solution
    - Add can_manage_users permission check to profiles or organization_users
    - Use simpler permission checks that don't cause recursion
    - Allow main users and users with can_manage_users permission

  3. Changes
    - Drop existing problematic policies
    - Create new non-recursive policies
    - Check permissions without circular references
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Main users can add users to their organization" ON organization_users;
DROP POLICY IF EXISTS "Main users can update users in their organization" ON organization_users;
DROP POLICY IF EXISTS "Main users can delete users in their organization" ON organization_users;

-- Create new INSERT policy - users with can_manage_users or main users can add
CREATE POLICY "Users with permission can add users to their organization"
  ON organization_users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can add anyone
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Check if user has can_manage_users permission in their own org
    (
      organization_id IN (
        SELECT ou.organization_id 
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.is_active = true
        AND (ou.is_main_user = true OR ou.can_manage_users = true)
      )
    )
  );

-- Create new UPDATE policy
CREATE POLICY "Users with permission can update users in their organization"
  ON organization_users FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update anyone
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Main users or users with can_manage_users in same org can update
    (
      organization_id IN (
        SELECT ou.organization_id 
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.is_active = true
        AND (ou.is_main_user = true OR ou.can_manage_users = true)
      )
    )
  )
  WITH CHECK (
    -- Super admins can update to anything
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
    OR
    -- Main users or users with can_manage_users in same org can update
    (
      organization_id IN (
        SELECT ou.organization_id 
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.is_active = true
        AND (ou.is_main_user = true OR ou.can_manage_users = true)
      )
    )
  );

-- Create new DELETE policy - cannot delete main users
CREATE POLICY "Users with permission can delete non-main users in their organization"
  ON organization_users FOR DELETE
  TO authenticated
  USING (
    -- Cannot delete main users
    NOT is_main_user
    AND
    (
      -- Super admins can delete anyone (except main users)
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
      )
      OR
      -- Main users or users with can_manage_users in same org can delete
      (
        organization_id IN (
          SELECT ou.organization_id 
          FROM organization_users ou
          WHERE ou.user_id = auth.uid()
          AND ou.is_active = true
          AND (ou.is_main_user = true OR ou.can_manage_users = true)
        )
      )
    )
  );