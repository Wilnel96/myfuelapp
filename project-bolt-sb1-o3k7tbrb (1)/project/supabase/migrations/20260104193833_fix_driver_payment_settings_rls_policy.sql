/*
  # Fix Driver Payment Settings RLS Policy
  
  1. Changes
    - Drop the incorrect "Main users can manage driver payment settings" policy
    - Create a corrected policy that checks `is_main_user` OR `is_secondary_main_user` flags
    - The old policy was checking `title = 'Secondary Main User'` which doesn't exist
    - The correct check should be `is_secondary_main_user = true`
  
  2. Security
    - Maintains same security model: only main users and secondary main users can update
    - Super admins can still manage all settings
*/

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Main users can manage driver payment settings" ON driver_payment_settings;

-- Create the corrected policy with proper flag checks
CREATE POLICY "Main users can manage driver payment settings"
  ON driver_payment_settings FOR ALL
  TO authenticated
  USING (
    (
      -- User is in the same organization AND is a main or secondary main user
      organization_id IN (
        SELECT ou.organization_id 
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.is_active = true
        AND (ou.is_main_user = true OR ou.is_secondary_main_user = true)
      )
    )
    OR
    -- Super admin can manage all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    (
      organization_id IN (
        SELECT ou.organization_id 
        FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.is_active = true
        AND (ou.is_main_user = true OR ou.is_secondary_main_user = true)
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );
