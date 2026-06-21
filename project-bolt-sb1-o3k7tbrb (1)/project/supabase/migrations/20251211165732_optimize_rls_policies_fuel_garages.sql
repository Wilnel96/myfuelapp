/*
  # Optimize RLS Policies - Fuel Transactions and Garages
  
  This migration optimizes RLS policies for fuel transactions, garages,
  fuel cards, and spending alerts tables.
  
  Tables optimized:
  - fuel_transactions
  - garages
  - fuel_cards
  - spending_alerts
*/

-- =====================================================
-- FUEL_TRANSACTIONS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view transactions in their organization" ON fuel_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Admins and managers can manage transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Super admins can view all fuel transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Child orgs can view own transactions" ON fuel_transactions;
DROP POLICY IF EXISTS "Child orgs can insert own transactions" ON fuel_transactions;

CREATE POLICY "Users can view transactions in their organization"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own transactions"
  ON fuel_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins and managers can manage transactions"
  ON fuel_transactions
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  );

CREATE POLICY "Super admins can view all fuel transactions"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "Child orgs can view own transactions"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM organizations 
      WHERE parent_org_id IN (
        SELECT organization_id 
        FROM organization_users 
        WHERE user_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "Child orgs can insert own transactions"
  ON fuel_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT id FROM organizations 
      WHERE parent_org_id IN (
        SELECT organization_id 
        FROM organization_users 
        WHERE user_id = (select auth.uid())
      )
    )
  );

-- =====================================================
-- GARAGES TABLE
-- =====================================================

DROP POLICY IF EXISTS "Super admins can view all garages" ON garages;
DROP POLICY IF EXISTS "Parent org can manage garages" ON garages;
DROP POLICY IF EXISTS "Child orgs can view garages" ON garages;
DROP POLICY IF EXISTS "Users can update garages in their organization" ON garages;

CREATE POLICY "Super admins can view all garages"
  ON garages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = (select auth.uid())
        AND title = 'Main User'
        AND organization_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "Parent org can manage garages"
  ON garages
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  );

CREATE POLICY "Child orgs can view garages"
  ON garages FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT parent_org_id 
      FROM organizations 
      WHERE id IN (
        SELECT organization_id 
        FROM organization_users 
        WHERE user_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "Users can update garages in their organization"
  ON garages FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  );

-- =====================================================
-- FUEL_CARDS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Users can view fuel cards in their organization" ON fuel_cards;
DROP POLICY IF EXISTS "Admins can manage fuel cards" ON fuel_cards;

CREATE POLICY "Users can view fuel cards in their organization"
  ON fuel_cards FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Admins can manage fuel cards"
  ON fuel_cards
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = (select auth.uid())
        AND (is_main_user = true OR is_secondary_main_user = true)
    )
  );

-- =====================================================
-- SPENDING_ALERTS TABLE
-- =====================================================

DROP POLICY IF EXISTS "Admins and managers can view alerts" ON spending_alerts;
DROP POLICY IF EXISTS "Admins can manage alerts" ON spending_alerts;

CREATE POLICY "Admins and managers can view alerts"
  ON spending_alerts FOR SELECT
  TO authenticated
  USING (
    fuel_card_id IN (
      SELECT id FROM fuel_cards 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_users 
        WHERE user_id = (select auth.uid())
          AND (is_main_user = true OR is_secondary_main_user = true)
      )
    )
  );

CREATE POLICY "Admins can manage alerts"
  ON spending_alerts
  TO authenticated
  USING (
    fuel_card_id IN (
      SELECT id FROM fuel_cards 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_users 
        WHERE user_id = (select auth.uid())
          AND is_main_user = true
      )
    )
  )
  WITH CHECK (
    fuel_card_id IN (
      SELECT id FROM fuel_cards 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_users 
        WHERE user_id = (select auth.uid())
          AND is_main_user = true
      )
    )
  );
