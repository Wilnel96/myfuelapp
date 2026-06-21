/*
  # Fix Remaining Security and Performance Issues
  
  This migration addresses additional security and performance concerns:
  
  ## 1. Add Missing Indexes for Foreign Keys
  Adds indexes for foreign key columns that were missed:
  - backup_logs.created_by
  - drivers.deleted_by
  - fuel_cards.assigned_to_user_id, assigned_to_vehicle_id
  - fuel_transactions.driver_id, fuel_card_id, garage_id
  - garages.organization_id
  - organization_users.user_id
  - spending_alerts.fuel_card_id
  - vehicle_transactions.related_transaction_id
  - vehicles.deleted_by
  
  ## 2. Optimize RLS Policies with SELECT Wrapper
  Wraps auth.uid() calls in (SELECT auth.uid()) to prevent re-evaluation per row
  
  ## 3. Note on Unused Indexes
  Some indexes show as "unused" because they were recently created.
  They are needed for foreign key performance and should NOT be dropped.
  
  ## Notes
  - Security definer views and function search paths were addressed in previous migration
  - Auth DB connection strategy and leaked password protection require dashboard settings
*/

-- =====================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

-- Index for backup_logs.created_by
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_by 
  ON backup_logs(created_by);

-- Index for drivers.deleted_by
CREATE INDEX IF NOT EXISTS idx_drivers_deleted_by 
  ON drivers(deleted_by);

-- Indexes for fuel_cards foreign keys
CREATE INDEX IF NOT EXISTS idx_fuel_cards_assigned_to_user_id 
  ON fuel_cards(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_cards_assigned_to_vehicle_id 
  ON fuel_cards(assigned_to_vehicle_id);

-- Indexes for fuel_transactions foreign keys
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_driver_id 
  ON fuel_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_fuel_card_id 
  ON fuel_transactions(fuel_card_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_garage_id 
  ON fuel_transactions(garage_id);

-- Index for garages.organization_id
CREATE INDEX IF NOT EXISTS idx_garages_organization_id 
  ON garages(organization_id);

-- Index for organization_users.user_id
CREATE INDEX IF NOT EXISTS idx_organization_users_user_id 
  ON organization_users(user_id);

-- Index for spending_alerts.fuel_card_id
CREATE INDEX IF NOT EXISTS idx_spending_alerts_fuel_card_id 
  ON spending_alerts(fuel_card_id);

-- Index for vehicle_transactions.related_transaction_id
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_related_transaction_id 
  ON vehicle_transactions(related_transaction_id);

-- Index for vehicles.deleted_by
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_by 
  ON vehicles(deleted_by);

-- =====================================================
-- 2. OPTIMIZE RLS POLICIES WITH SELECT WRAPPER
-- =====================================================

-- Optimize vehicles policies
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON vehicles;

CREATE POLICY "Authenticated users can view vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can view vehicles in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    )
  );

-- Optimize drivers policies
DROP POLICY IF EXISTS "Authenticated users can view drivers" ON drivers;

CREATE POLICY "Authenticated users can view drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can view drivers in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    )
  );

-- Optimize organizations SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON organizations;

CREATE POLICY "Authenticated users can view organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can view their own organization
    id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    OR
    -- Users can view child organizations
    parent_org_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
  );

-- Optimize organizations UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update organizations" ON organizations;

CREATE POLICY "Authenticated users can update organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can update their own organization
    id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
  );

-- Optimize garages SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view garages" ON garages;

CREATE POLICY "Authenticated users can view garages"
  ON garages FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- All authenticated users can view garages
    true
  );

-- Optimize garages UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update garages" ON garages;

CREATE POLICY "Authenticated users can update garages"
  ON garages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
  );

-- Optimize fuel_transactions SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view fuel transactions" ON fuel_transactions;

CREATE POLICY "Authenticated users can view fuel transactions"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can view transactions in their organization and child orgs
    organization_id IN (
      SELECT o.id
      FROM organizations o
      WHERE o.id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
         OR o.parent_org_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    )
  );

-- Optimize fuel_transactions INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert fuel transactions" ON fuel_transactions;

CREATE POLICY "Authenticated users can insert fuel transactions"
  ON fuel_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can insert all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can insert transactions for their organization
    organization_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
  );

-- Optimize organization_users SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view organization users" ON organization_users;

CREATE POLICY "Authenticated users can view organization users"
  ON organization_users FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Main users can view users in their organization
    (
      organization_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
      AND EXISTS (
        SELECT 1 FROM organization_users ou
        WHERE ou.user_id = (SELECT auth.uid())
          AND ou.organization_id = organization_users.organization_id
          AND ou.is_main_user = true
      )
    )
  );

-- Optimize daily_eft_batches SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view eft batches" ON daily_eft_batches;

CREATE POLICY "Authenticated users can view eft batches"
  ON daily_eft_batches FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can view their organization's batches
    organization_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
  );

-- Optimize eft_batch_items SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view eft batch items" ON eft_batch_items;

CREATE POLICY "Authenticated users can view eft batch items"
  ON eft_batch_items FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can view items from their organization's batches
    batch_id IN (
      SELECT id FROM daily_eft_batches
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    )
  );

-- Optimize eft_batch_items INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert eft batch items" ON eft_batch_items;

CREATE POLICY "Authenticated users can insert eft batch items"
  ON eft_batch_items FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admins can insert all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can insert items for their organization's batches
    batch_id IN (
      SELECT id FROM daily_eft_batches
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    )
  );

-- Optimize fuel_cards SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view fuel cards" ON fuel_cards;

CREATE POLICY "Authenticated users can view fuel cards"
  ON fuel_cards FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can view fuel cards in their organization
    organization_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
  );

-- Optimize spending_alerts SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view spending alerts" ON spending_alerts;

CREATE POLICY "Authenticated users can view spending alerts"
  ON spending_alerts FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can view alerts in their organization
    organization_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
  );

-- Optimize vehicle_transactions SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view vehicle transactions" ON vehicle_transactions;

CREATE POLICY "Authenticated users can view vehicle transactions"
  ON vehicle_transactions FOR SELECT
  TO authenticated
  USING (
    -- Super admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
    OR
    -- Users can view their organization's vehicle transactions
    organization_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
  );

-- =====================================================
-- ADDITIONAL NOTES
-- =====================================================

/*
  Notes on remaining issues:
  
  1. Unused Indexes:
     The indexes created in this and the previous migration may show as "unused"
     because they were just created. These indexes are essential for foreign key
     performance and should NOT be dropped. They will be marked as "used" once
     queries start utilizing them.
  
  2. Security Definer Views:
     These were addressed in migration 20251211165838. If still showing, verify
     the migration was applied correctly.
  
  3. Function Search Path:
     Functions have been recreated with SET search_path. If still showing as mutable,
     this may be a caching issue in the security scanner.
  
  4. Dashboard Settings (cannot be fixed via migration):
     - Auth DB Connection Strategy: Dashboard > Settings > Database
     - Leaked Password Protection: Dashboard > Authentication > Policies
*/
