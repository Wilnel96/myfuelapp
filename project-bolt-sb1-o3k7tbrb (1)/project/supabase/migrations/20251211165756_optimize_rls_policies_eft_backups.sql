/*
  # Optimize RLS Policies - EFT Batches and Backups
  
  This migration optimizes RLS policies for EFT batches, vehicle transactions,
  and backup logs tables.
  
  Tables optimized:
  - daily_eft_batches
  - eft_batch_items
  - vehicle_transactions
  - backup_logs
*/

-- =====================================================
-- DAILY_EFT_BATCHES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view organization EFT batches" ON daily_eft_batches;
DROP POLICY IF EXISTS "System can manage EFT batches" ON daily_eft_batches;
DROP POLICY IF EXISTS "Super admins can view all eft batches" ON daily_eft_batches;
DROP POLICY IF EXISTS "Super admins can insert eft batches" ON daily_eft_batches;
DROP POLICY IF EXISTS "Super admins can update eft batches" ON daily_eft_batches;

CREATE POLICY "Users can view organization EFT batches"
  ON daily_eft_batches FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "System can manage EFT batches"
  ON daily_eft_batches
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

CREATE POLICY "Super admins can view all eft batches"
  ON daily_eft_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

-- =====================================================
-- EFT_BATCH_ITEMS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view EFT batch items" ON eft_batch_items;
DROP POLICY IF EXISTS "Users can insert EFT batch items" ON eft_batch_items;
DROP POLICY IF EXISTS "Super admins can view all eft batch items" ON eft_batch_items;
DROP POLICY IF EXISTS "Super admins can insert eft batch items" ON eft_batch_items;

CREATE POLICY "Users can view EFT batch items"
  ON eft_batch_items FOR SELECT
  TO authenticated
  USING (
    batch_id IN (
      SELECT id FROM daily_eft_batches 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_users 
        WHERE user_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert EFT batch items"
  ON eft_batch_items FOR INSERT
  TO authenticated
  WITH CHECK (
    batch_id IN (
      SELECT id FROM daily_eft_batches 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_users 
        WHERE user_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "Super admins can view all eft batch items"
  ON eft_batch_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "Super admins can insert eft batch items"
  ON eft_batch_items FOR INSERT
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
-- VEHICLE_TRANSACTIONS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view their organization's vehicle transactions" ON vehicle_transactions;
DROP POLICY IF EXISTS "Users can create vehicle transactions for their organization" ON vehicle_transactions;
DROP POLICY IF EXISTS "Super admin can view all vehicle transactions" ON vehicle_transactions;

CREATE POLICY "Users can view their organization's vehicle transactions"
  ON vehicle_transactions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create vehicle transactions for their organization"
  ON vehicle_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Super admin can view all vehicle transactions"
  ON vehicle_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

-- =====================================================
-- BACKUP_LOGS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Super admins can view all backups" ON backup_logs;
DROP POLICY IF EXISTS "Super admins can create backups" ON backup_logs;
DROP POLICY IF EXISTS "Super admins can update backups" ON backup_logs;

CREATE POLICY "Super admins can view all backups"
  ON backup_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "Super admins can create backups"
  ON backup_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "Super admins can update backups"
  ON backup_logs FOR UPDATE
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
