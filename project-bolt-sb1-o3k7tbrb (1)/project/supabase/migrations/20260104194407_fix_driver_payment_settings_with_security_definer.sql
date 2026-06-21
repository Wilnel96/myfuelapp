/*
  # Fix Driver Payment Settings RLS with Security Definer Function
  
  1. Problem
    - RLS policy on driver_payment_settings tries to query organization_users
    - organization_users also has RLS enabled, creating a circular dependency
    - This prevents the policy from working correctly
  
  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS
    - Function checks if user is main/secondary main user for an organization
    - Use this function in the RLS policy
  
  3. Security
    - Function is carefully designed to only check permissions
    - No data leakage possible
    - Super admins still have full access
*/

-- Create a security definer function to check if user can manage driver payment settings
CREATE OR REPLACE FUNCTION public.can_manage_driver_payment_settings(p_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  -- Check if user is super admin
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is main or secondary main user in the organization
  RETURN EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND is_active = true
    AND (is_main_user = true OR is_secondary_main_user = true)
  );
END;
$$;

-- Drop the old policy
DROP POLICY IF EXISTS "Main users can manage driver payment settings" ON driver_payment_settings;

-- Create new policy using the security definer function
CREATE POLICY "Main users can manage driver payment settings"
  ON driver_payment_settings FOR ALL
  TO authenticated
  USING (can_manage_driver_payment_settings(organization_id))
  WITH CHECK (can_manage_driver_payment_settings(organization_id));
