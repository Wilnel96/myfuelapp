/*
  # Allow Garages to View Client Organization Users

  1. Changes
    - Update `belongs_to_organization` function to allow garages to view organization_users for their client organizations
    - Garages can view contact information for organizations that have accounts at their garage (via organization_garage_accounts)
  
  2. Security
    - Maintains existing security for regular users
    - Only allows garages to see users from organizations with active or inactive accounts at their garage
*/

-- Update the belongs_to_organization function to include garage access
CREATE OR REPLACE FUNCTION belongs_to_organization(org_id uuid)
RETURNS boolean AS $$
DECLARE
  result boolean;
  user_org_id uuid;
  user_org_type text;
BEGIN
  -- Check if user is super admin
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Get the user's organization ID and type
  SELECT organization_id INTO user_org_id
  FROM profiles
  WHERE id = auth.uid();

  IF user_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user belongs to the organization via profiles
  IF user_org_id = org_id THEN
    RETURN true;
  END IF;

  -- Check if user's organization is a garage and has a relationship with the target organization
  SELECT organization_type INTO user_org_type
  FROM organizations
  WHERE id = user_org_id;

  IF user_org_type = 'garage' THEN
    -- Check if this garage has an account relationship with the target organization
    SELECT EXISTS (
      SELECT 1
      FROM organization_garage_accounts
      WHERE garage_id = user_org_id
        AND organization_id = org_id
    ) INTO result;
    
    RETURN COALESCE(result, false);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
