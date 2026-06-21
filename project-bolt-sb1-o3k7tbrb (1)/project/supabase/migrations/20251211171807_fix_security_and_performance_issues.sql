/*
  # Fix Security and Performance Issues
  
  This migration addresses multiple security and performance concerns identified in the database audit:
  
  ## 1. Add Missing Indexes for Foreign Keys
  Adds indexes for foreign key columns to improve query performance:
  - custom_report_templates.user_id
  - driver_sessions.driver_id
  - drivers.user_id
  - eft_batch_items.garage_id
  - organizations.parent_org_id (already exists, verify)
  - profiles.organization_id (already exists, verify)
  - vehicle_transactions.driver_id, organization_id, vehicle_id
  
  ## 2. Drop Unused Indexes
  Removes indexes that are not being used to improve write performance:
  - idx_fuel_cards_assigned_to_user_id
  - idx_fuel_cards_assigned_to_vehicle_id
  - idx_vehicles_deleted_by
  - idx_spending_alerts_fuel_card_id
  - idx_garages_organization_id
  - idx_fuel_transactions_garage_id
  - idx_fuel_transactions_driver_id
  - idx_fuel_transactions_fuel_card_id
  - idx_organization_users_user_id
  - idx_drivers_deleted_by
  - idx_vehicle_transactions_related_transaction_id
  - idx_backup_logs_created_by
  
  ## 3. Consolidate Multiple Permissive Policies
  Combines redundant permissive policies into single, more efficient policies
  
  ## 4. Fix Function Search Paths
  Sets immutable search_path for security-sensitive functions
  
  ## Notes
  - Auth DB connection strategy and leaked password protection are dashboard settings
  - Security definer views were already addressed in migration 20251211165838
*/

-- =====================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

-- Index for custom_report_templates.user_id
CREATE INDEX IF NOT EXISTS idx_custom_report_templates_user_id 
  ON custom_report_templates(user_id);

-- Index for driver_sessions.driver_id
CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver_id 
  ON driver_sessions(driver_id);

-- Index for drivers.user_id
CREATE INDEX IF NOT EXISTS idx_drivers_user_id 
  ON drivers(user_id);

-- Index for eft_batch_items.garage_id
CREATE INDEX IF NOT EXISTS idx_eft_batch_items_garage_id 
  ON eft_batch_items(garage_id);

-- Index for organizations.parent_org_id (verify if exists)
CREATE INDEX IF NOT EXISTS idx_organizations_parent_org_id 
  ON organizations(parent_org_id);

-- Index for profiles.organization_id (verify if exists)
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id 
  ON profiles(organization_id);

-- Indexes for vehicle_transactions foreign keys
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_driver_id 
  ON vehicle_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_organization_id 
  ON vehicle_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_vehicle_id 
  ON vehicle_transactions(vehicle_id);

-- =====================================================
-- 2. DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_fuel_cards_assigned_to_user_id;
DROP INDEX IF EXISTS idx_fuel_cards_assigned_to_vehicle_id;
DROP INDEX IF EXISTS idx_vehicles_deleted_by;
DROP INDEX IF EXISTS idx_spending_alerts_fuel_card_id;
DROP INDEX IF EXISTS idx_garages_organization_id;
DROP INDEX IF EXISTS idx_fuel_transactions_garage_id;
DROP INDEX IF EXISTS idx_fuel_transactions_driver_id;
DROP INDEX IF EXISTS idx_fuel_transactions_fuel_card_id;
DROP INDEX IF EXISTS idx_organization_users_user_id;
DROP INDEX IF EXISTS idx_drivers_deleted_by;
DROP INDEX IF EXISTS idx_vehicle_transactions_related_transaction_id;
DROP INDEX IF EXISTS idx_backup_logs_created_by;

-- =====================================================
-- 3. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- Drop and recreate vehicles SELECT policies for anon (combine duplicates)
DROP POLICY IF EXISTS "Anonymous users can view active vehicles" ON vehicles;
DROP POLICY IF EXISTS "Anonymous users can view active vehicles for driver app" ON vehicles;

CREATE POLICY "Anonymous users can view active vehicles"
  ON vehicles FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

-- Drop and recreate vehicles SELECT policies for authenticated (combine duplicates)
DROP POLICY IF EXISTS "Super admins can view all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can view vehicles in their organization and child orgs" ON vehicles;

CREATE POLICY "Authenticated users can view vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view vehicles in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Drop and recreate drivers SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Super admins can view all drivers" ON drivers;
DROP POLICY IF EXISTS "Users can view drivers in their organization and child orgs" ON drivers;

CREATE POLICY "Authenticated users can view drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view drivers in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Drop and recreate organizations SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Super admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;

CREATE POLICY "Authenticated users can view organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view their own organization
    id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR
    -- Users can view child organizations
    parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Drop and recreate organizations UPDATE policies (combine duplicates)
DROP POLICY IF EXISTS "Super admins can update all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their organization" ON organizations;

CREATE POLICY "Authenticated users can update organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can update their own organization
    id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Drop and recreate garages SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Child orgs can view garages" ON garages;
DROP POLICY IF EXISTS "Parent org can manage garages" ON garages;
DROP POLICY IF EXISTS "Super admins can view all garages" ON garages;

CREATE POLICY "Authenticated users can view garages"
  ON garages FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- All authenticated users can view garages
    true
  );

-- Drop and recreate garages UPDATE policies (combine duplicates)
DROP POLICY IF EXISTS "Parent org can manage garages" ON garages;
DROP POLICY IF EXISTS "Users can update garages in their organization" ON garages;

CREATE POLICY "Authenticated users can update garages"
  ON garages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Drop and recreate fuel_transactions SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Admins and managers can manage transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Child orgs can view own transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Super admins can view all fuel transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Users can view transactions in their organization" ON fuel_transactions;

CREATE POLICY "Authenticated users can view fuel transactions"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view transactions in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Drop and recreate fuel_transactions INSERT policies (combine duplicates)
DROP POLICY IF EXISTS "Admins and managers can manage transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Child orgs can insert own transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON fuel_transactions;

CREATE POLICY "Authenticated users can insert fuel transactions"
  ON fuel_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can insert all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can insert transactions for their organization
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Drop and recreate organization_users SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Main users can view users in their organization" ON organization_users;
DROP POLICY IF EXISTS "Super admin can view all organization users" ON organization_users;

CREATE POLICY "Authenticated users can view organization users"
  ON organization_users FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Main users can view users in their organization
    (
      organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM organization_users ou
        WHERE ou.user_id = auth.uid()
          AND ou.organization_id = organization_users.organization_id
          AND ou.is_main_user = true
      )
    )
  );

-- Drop and recreate daily_eft_batches SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Super admins can view all eft batches" ON daily_eft_batches;
DROP POLICY IF EXISTS "System can manage EFT batches" ON daily_eft_batches;
DROP POLICY IF EXISTS "Users can view organization EFT batches" ON daily_eft_batches;

CREATE POLICY "Authenticated users can view eft batches"
  ON daily_eft_batches FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view their organization's batches
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Drop and recreate eft_batch_items SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Super admins can view all eft batch items" ON eft_batch_items;
DROP POLICY IF EXISTS "Users can view EFT batch items" ON eft_batch_items;

CREATE POLICY "Authenticated users can view eft batch items"
  ON eft_batch_items FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view items from their organization's batches
    batch_id IN (
      SELECT id FROM daily_eft_batches
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Drop and recreate eft_batch_items INSERT policies (combine duplicates)
DROP POLICY IF EXISTS "Super admins can insert eft batch items" ON eft_batch_items;
DROP POLICY IF EXISTS "Users can insert EFT batch items" ON eft_batch_items;

CREATE POLICY "Authenticated users can insert eft batch items"
  ON eft_batch_items FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can insert all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can insert items for their organization's batches
    batch_id IN (
      SELECT id FROM daily_eft_batches
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Drop and recreate fuel_cards SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Admins can manage fuel cards" ON fuel_cards;
DROP POLICY IF EXISTS "Users can view fuel cards in their organization" ON fuel_cards;

CREATE POLICY "Authenticated users can view fuel cards"
  ON fuel_cards FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view fuel cards in their organization
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Drop and recreate spending_alerts SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Admins and managers can view alerts" ON spending_alerts;
DROP POLICY IF EXISTS "Admins can manage alerts" ON spending_alerts;

CREATE POLICY "Authenticated users can view spending alerts"
  ON spending_alerts FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view alerts in their organization
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Drop and recreate vehicle_transactions SELECT policies (combine duplicates)
DROP POLICY IF EXISTS "Super admin can view all vehicle transactions" ON vehicle_transactions;
DROP POLICY IF EXISTS "Users can view their organization's vehicle transactions" ON vehicle_transactions;

CREATE POLICY "Authenticated users can view vehicle transactions"
  ON vehicle_transactions FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Users can view their organization's vehicle transactions
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- =====================================================
-- 4. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Drop and recreate get_garage_primary_contact function with fixed search_path
DROP FUNCTION IF EXISTS get_garage_primary_contact(uuid);

CREATE FUNCTION get_garage_primary_contact(p_garage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  primary_contact jsonb;
BEGIN
  SELECT jsonb_build_object(
    'name', gc.name,
    'surname', gc.surname,
    'email', gc.email,
    'phone', gc.phone,
    'mobile_phone', gc.mobile_phone
  )
  INTO primary_contact
  FROM garage_contacts gc
  WHERE gc.garage_id = p_garage_id
    AND gc.is_primary = true
  LIMIT 1;
  
  RETURN primary_contact;
END;
$$;

-- Drop and recreate transfer_main_user function with fixed search_path
DROP FUNCTION IF EXISTS transfer_main_user(uuid, uuid, uuid);

CREATE FUNCTION transfer_main_user(
  org_id uuid,
  current_main_user_id uuid,
  new_main_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Remove main user status from current main user
  UPDATE organization_users
  SET 
    is_main_user = false,
    title = 'User'
  WHERE user_id = current_main_user_id
    AND organization_id = org_id;
  
  -- Grant main user status to new main user
  UPDATE organization_users
  SET 
    is_main_user = true,
    title = 'Main User'
  WHERE user_id = new_main_user_id
    AND organization_id = org_id;
END;
$$;

-- Drop and recreate remove_secondary_main_user_with_role function with fixed search_path
DROP FUNCTION IF EXISTS remove_secondary_main_user_with_role(uuid, uuid);

CREATE FUNCTION remove_secondary_main_user_with_role(
  org_id uuid,
  user_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Remove secondary main user status and set role to user
  UPDATE organization_users
  SET 
    is_secondary_main_user = false,
    title = 'User'
  WHERE user_id = user_id_param
    AND organization_id = org_id;
END;
$$;

-- Drop and recreate toggle_secondary_main_user function with fixed search_path
DROP FUNCTION IF EXISTS toggle_secondary_main_user(uuid, uuid, boolean);

CREATE FUNCTION toggle_secondary_main_user(
  org_id uuid,
  user_id_param uuid,
  make_secondary_main boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF make_secondary_main THEN
    -- Grant secondary main user status
    UPDATE organization_users
    SET 
      is_secondary_main_user = true,
      title = 'Secondary Main User'
    WHERE user_id = user_id_param
      AND organization_id = org_id;
  ELSE
    -- Remove secondary main user status
    UPDATE organization_users
    SET 
      is_secondary_main_user = false,
      title = 'User'
    WHERE user_id = user_id_param
      AND organization_id = org_id;
  END IF;
END;
$$;

-- =====================================================
-- ADDITIONAL NOTES
-- =====================================================

/*
  The following issues require dashboard/configuration changes and cannot be fixed via migration:
  
  1. Auth DB Connection Strategy:
     - Go to Dashboard > Settings > Database
     - Change "Auth Pooler" connection mode to use percentage-based allocation
  
  2. Leaked Password Protection:
     - Go to Dashboard > Authentication > Policies
     - Enable "Leaked Password Protection" to check passwords against HaveIBeenPwned.org
  
  These settings should be enabled for production deployments.
*/
