/*
  # Optimize RLS Policies - Core Tables
  
  This migration wraps all auth.uid() calls with (select auth.uid()) to prevent 
  re-evaluation per row, significantly improving query performance at scale.
  
  Tables optimized:
  - profiles
  - organizations  
  - organization_users
  - custom_report_templates
*/

-- =====================================================
-- PROFILES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- =====================================================
-- ORGANIZATIONS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Users can update their organization" ON organizations;
DROP POLICY IF EXISTS "Super admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can update all organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can insert organizations" ON organizations;

CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = (select auth.uid())
    )
  );

CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  );

CREATE POLICY "Super admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "Super admins can update all organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "Super admins can insert organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

-- =====================================================
-- ORGANIZATION_USERS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Super admin can view all organization users" ON organization_users;
DROP POLICY IF EXISTS "Main users can view users in their organization" ON organization_users;

CREATE POLICY "Super admin can view all organization users"
  ON organization_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = (select auth.uid())
        AND ou.title = 'Main User'
        AND ou.organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "Main users can view users in their organization"
  ON organization_users FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  );

-- =====================================================
-- CUSTOM_REPORT_TEMPLATES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view own organization templates" ON custom_report_templates;
DROP POLICY IF EXISTS "Users can create templates for own organization" ON custom_report_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON custom_report_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON custom_report_templates;

CREATE POLICY "Users can view own organization templates"
  ON custom_report_templates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create templates for own organization"
  ON custom_report_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own templates"
  ON custom_report_templates FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own templates"
  ON custom_report_templates FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
