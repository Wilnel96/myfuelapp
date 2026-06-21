/*
  # Fix Organizations Insert Policy - Proper Security (v2)
  
  ## Business Rules
  1. Clients CANNOT sign themselves up
  2. Only Management organization users can create new client organizations
  3. Super admins can create any organization
  4. Clients can UPDATE their own organization but NOT create new ones
  
  ## Changes
  1. Drop temporary debug policy
  2. Create proper INSERT policy for management org users only
  3. Ensure UPDATE policy allows clients to modify their own org
  
  ## Security
  - Clients cannot create organizations
  - Only management org users (is_management_org = true) can create clients
  - Super admins bypass all restrictions
*/

-- Drop the temporary debug policy
DROP POLICY IF EXISTS "organizations_insert_policy_temp_debug" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;

-- Create proper INSERT policy - only management org users can create client orgs
CREATE POLICY "organizations_insert_policy"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow super admins to create any organization
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'super_admin'
      )
    )
    OR
    -- Allow management org users to create client organizations only
    (
      organization_type = 'client' 
      AND is_management_org = false
      AND EXISTS (
        SELECT 1 
        FROM profiles p
        JOIN organizations o ON o.id = p.organization_id
        WHERE p.id = auth.uid()
          AND o.is_management_org = true
          AND o.organization_type = 'management'
      )
    )
  );

-- Ensure UPDATE policy exists and allows clients to modify their own org
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;

CREATE POLICY "organizations_update_policy"
  ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update any organization
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
    OR
    -- Management org users can update any client organization
    (
      organization_type = 'client'
      AND EXISTS (
        SELECT 1 
        FROM profiles p
        JOIN organizations o ON o.id = p.organization_id
        WHERE p.id = auth.uid()
          AND o.is_management_org = true
          AND o.organization_type = 'management'
      )
    )
    OR
    -- Users can update their own organization
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = organizations.id
    )
    OR
    -- Organization users can update their organization
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.user_id = auth.uid()
        AND organization_users.organization_id = organizations.id
        AND organization_users.can_edit_organization_info = true
    )
  )
  WITH CHECK (
    -- Super admins can update to any values
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
    OR
    -- Management org users can update client orgs to any values
    (
      organization_type = 'client'
      AND EXISTS (
        SELECT 1 
        FROM profiles p
        JOIN organizations o ON o.id = p.organization_id
        WHERE p.id = auth.uid()
          AND o.is_management_org = true
          AND o.organization_type = 'management'
      )
    )
    OR
    -- Regular users can update their org but cannot change critical fields
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.organization_id = organizations.id
      )
      AND organization_type = 'client'  -- Cannot change org type
      AND is_management_org = false      -- Cannot become management org
    )
    OR
    -- Organization users with permission can update but not change critical fields
    (
      EXISTS (
        SELECT 1 FROM organization_users
        WHERE organization_users.user_id = auth.uid()
          AND organization_users.organization_id = organizations.id
          AND organization_users.can_edit_organization_info = true
      )
      AND organization_type = 'client'  -- Cannot change org type
      AND is_management_org = false      -- Cannot become management org
    )
  );

-- Add helpful comments
COMMENT ON POLICY "organizations_insert_policy" ON organizations IS 
  'Only management organization users can create new client organizations. Super admins can create any organization. Clients cannot self-register.';

COMMENT ON POLICY "organizations_update_policy" ON organizations IS 
  'Super admins and management users can update any client organization. Clients can update their own organization but cannot change critical fields like organization_type or is_management_org.';
