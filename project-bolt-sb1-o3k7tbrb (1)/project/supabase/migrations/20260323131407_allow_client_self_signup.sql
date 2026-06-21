/*
  # Allow Client Self-Signup

  This migration enables self-service signup for client organizations.

  ## Changes

  1. **Organizations Table**
     - Update INSERT policy to allow authenticated users to create client organizations
     - Users can only create non-management organizations

  2. **Organization Users Table**
     - Allow authenticated users to insert themselves as organization users

  3. **Profiles Table**
     - Allow authenticated users to update their own profile during signup

  ## Security

  - Users can only create client organizations (not management orgs)
  - Users can only update their own profile
  - Users can only add themselves to organizations
  - All existing RLS policies for other operations remain unchanged
*/

-- ============================================================================
-- ALLOW AUTHENTICATED USERS TO CREATE CLIENT ORGANIZATIONS
-- ============================================================================

DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;

CREATE POLICY "organizations_insert_policy"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (
    -- Super admins can create any organization
    (EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    ))
    OR
    -- Any authenticated user can create a client organization during signup
    (
      is_management_org = false
      AND organization_type = 'client'
    )
  );

-- ============================================================================
-- ALLOW AUTHENTICATED USERS TO UPDATE THEIR OWN PROFILE DURING SIGNUP
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- ALLOW AUTHENTICATED USERS TO ADD THEMSELVES TO ORGANIZATIONS
-- ============================================================================

DROP POLICY IF EXISTS "organization_users_insert_policy" ON public.organization_users;

CREATE POLICY "organization_users_insert_policy"
  ON public.organization_users FOR INSERT TO authenticated
  WITH CHECK (
    -- Super admins can add any user
    (EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    ))
    OR
    -- Main users can add users to their organization
    (EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.is_main_user = true
      AND ou.can_manage_users = true
    ))
    OR
    -- Users can add themselves during signup
    (user_id = auth.uid())
  );

COMMENT ON POLICY "organizations_insert_policy" ON public.organizations IS
'Allows super admins to create any organization, and authenticated users to create client organizations during self-signup';

COMMENT ON POLICY "Users can update own profile" ON public.profiles IS
'Allows users to update their own profile information including organization assignment during signup';

COMMENT ON POLICY "organization_users_insert_policy" ON public.organization_users IS
'Allows super admins to add any user, main users with permissions to add users to their org, and users to add themselves during signup';
