/*
  # Add Secondary Main User Support

  1. Changes
    - Add `is_secondary_main_user` field to organization_users table
    - Organizations can now have one main user and one secondary main user
    - Secondary main users have the same permissions as main users
    
  2. Purpose
    - Allow organizations to have a backup main user when the primary is unavailable
    - Provides continuity of management when main user is on holiday or unavailable
    
  3. Rules
    - Only one main user and one secondary main user allowed per organization
    - Main user can nominate/remove secondary main user
    - Main user can only be removed if a secondary main user exists
*/

-- Add is_secondary_main_user column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'is_secondary_main_user'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN is_secondary_main_user boolean DEFAULT false;
  END IF;
END $$;

-- Create function to check for secondary main user before removing main user
CREATE OR REPLACE FUNCTION check_can_remove_main_user(org_id uuid, user_to_remove_id uuid)
RETURNS boolean AS $$
DECLARE
  has_secondary_main boolean;
BEGIN
  -- Check if there's a secondary main user in the organization
  SELECT EXISTS (
    SELECT 1 FROM organization_users
    WHERE organization_id = org_id
    AND is_secondary_main_user = true
    AND is_active = true
    AND id != user_to_remove_id
  ) INTO has_secondary_main;
  
  RETURN has_secondary_main;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to promote user to main user (transfer from another user)
CREATE OR REPLACE FUNCTION transfer_main_user(from_user_id uuid, to_user_id uuid)
RETURNS void AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Get organization_id
  SELECT organization_id INTO org_id
  FROM organization_users
  WHERE id = from_user_id;
  
  -- Remove main user status from old user
  UPDATE organization_users
  SET is_main_user = false
  WHERE id = from_user_id;
  
  -- Add main user status to new user
  UPDATE organization_users
  SET is_main_user = true, is_secondary_main_user = false
  WHERE id = to_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to toggle secondary main user status
CREATE OR REPLACE FUNCTION toggle_secondary_main_user(user_id_to_toggle uuid)
RETURNS void AS $$
DECLARE
  current_status boolean;
  org_id uuid;
BEGIN
  -- Get current status and organization_id
  SELECT is_secondary_main_user, organization_id 
  INTO current_status, org_id
  FROM organization_users
  WHERE id = user_id_to_toggle;
  
  -- Toggle the status
  UPDATE organization_users
  SET is_secondary_main_user = NOT current_status
  WHERE id = user_id_to_toggle;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;