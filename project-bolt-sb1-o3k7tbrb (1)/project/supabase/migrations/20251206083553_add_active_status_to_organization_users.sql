/*
  # Add Active/Inactive Status to Organization Users

  ## Changes
  
  1. New Column
    - Add `is_active` boolean to `organization_users` table (default: true)
    - Add index for better query performance
  
  2. Functions
    - `deactivate_organization_user`: Marks a user as inactive
    - `reactivate_organization_user`: Marks a user as active again
  
  3. Notes
    - Inactive users will still be visible in the UI but marked as inactive
    - RLS policies remain unchanged to allow viewing inactive users for record keeping
    - Main users cannot be deactivated (enforced in function)
*/

-- Add is_active column to organization_users
ALTER TABLE organization_users 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_organization_users_is_active 
ON organization_users(is_active);

-- Function to deactivate an organization user
CREATE OR REPLACE FUNCTION deactivate_organization_user(user_id_to_deactivate uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user organization_users;
BEGIN
  -- Get the user to deactivate
  SELECT * INTO target_user
  FROM organization_users
  WHERE id = user_id_to_deactivate;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Prevent deactivating main users or secondary main users
  IF target_user.role IN ('main_user', 'secondary_main_user') THEN
    RAISE EXCEPTION 'Cannot deactivate main users or secondary main users. Please transfer ownership or remove their status first.';
  END IF;

  -- Check if the current user has permission to manage users in this organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.organization_id = target_user.organization_id
    AND ou.permissions->>'manage_users' = 'true'
    AND ou.is_active = true
  ) THEN
    RAISE EXCEPTION 'You do not have permission to deactivate users in this organization';
  END IF;

  -- Deactivate the user
  UPDATE organization_users
  SET is_active = false
  WHERE id = user_id_to_deactivate;
END;
$$;

-- Function to reactivate an organization user
CREATE OR REPLACE FUNCTION reactivate_organization_user(user_id_to_reactivate uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user organization_users;
BEGIN
  -- Get the user to reactivate
  SELECT * INTO target_user
  FROM organization_users
  WHERE id = user_id_to_reactivate;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if the current user has permission to manage users in this organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.organization_id = target_user.organization_id
    AND ou.permissions->>'manage_users' = 'true'
    AND ou.is_active = true
  ) THEN
    RAISE EXCEPTION 'You do not have permission to reactivate users in this organization';
  END IF;

  -- Reactivate the user
  UPDATE organization_users
  SET is_active = true
  WHERE id = user_id_to_reactivate;
END;
$$;