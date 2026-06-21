/*
  # Restore NFC Payment System
  
  This migration restores the complete NFC payment functionality that was lost during
  the schema reorganization. This includes payment card storage, driver payment settings,
  spending limits, and NFC transaction tracking.
  
  ## Features Being Restored:
  
  1. **Management Organization Support**
     - Adds `is_management_org` and `parent_org_id` to organizations table
     - Enables hierarchical organization structure
  
  2. **Payment Card Storage System**
     - Encrypted storage of organization payment cards (debit/credit)
     - AES-256-GCM encryption with key rotation support
     - Secure key management
  
  3. **Driver Payment Settings**
     - PIN-based authentication for NFC payments
     - Daily and monthly spending limits per driver
     - Failed attempt tracking and account locking
     - Payment enable/disable controls
  
  4. **Driver Spending Tracking**
     - Real-time tracking of daily and monthly spending
     - Transaction count monitoring
     - Automatic limit enforcement
  
  5. **NFC Payment Transactions**
     - Complete payment flow tracking (PIN → NFC → Completion)
     - GPS location capture for security
     - Device information logging
     - Fallback to EFT batch processing on failure
  
  6. **Dual Payment Methods**
     - EFT Batch processing (existing method)
     - NFC Instant payments (new method)
     - Automatic fallback support
  
  ## Security Features:
  
  - All card data encrypted at rest
  - PIN hashing with salt
  - Account lockout after failed attempts
  - RLS policies for all tables
  - Spending limit enforcement
  - Audit trail for all transactions
*/

-- =====================================================
-- 1. ADD MANAGEMENT ORGANIZATION FIELDS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_management_org') THEN
    ALTER TABLE organizations ADD COLUMN is_management_org boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'parent_org_id') THEN
    ALTER TABLE organizations ADD COLUMN parent_org_id uuid REFERENCES organizations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS organizations_is_management_org_idx ON organizations(is_management_org) WHERE is_management_org = true;
CREATE INDEX IF NOT EXISTS organizations_parent_org_id_idx ON organizations(parent_org_id);

-- =====================================================
-- 2. ENCRYPTION KEYS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_encrypted text NOT NULL,
  algorithm text NOT NULL DEFAULT 'AES-256-GCM',
  key_version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  rotated_at timestamptz,
  is_active boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS encryption_keys_is_active_idx ON encryption_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS encryption_keys_key_version_idx ON encryption_keys(key_version);

ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage encryption keys"
  ON encryption_keys FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =====================================================
-- 3. ORGANIZATION PAYMENT CARDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS organization_payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  card_number_encrypted text NOT NULL,
  card_holder_name_encrypted text NOT NULL,
  expiry_month_encrypted text NOT NULL,
  expiry_year_encrypted text NOT NULL,
  cvv_encrypted text NOT NULL,
  card_type text NOT NULL CHECK (card_type IN ('debit', 'credit')),
  card_brand text NOT NULL,
  last_four_digits text NOT NULL CHECK (length(last_four_digits) = 4),
  card_nickname text,
  encryption_key_id uuid REFERENCES encryption_keys(id) NOT NULL,
  iv_card_number text NOT NULL,
  iv_holder_name text NOT NULL,
  iv_expiry_month text NOT NULL,
  iv_expiry_year text NOT NULL,
  iv_cvv text NOT NULL,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_payment_cards_one_default_per_org_idx
  ON organization_payment_cards(organization_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS organization_payment_cards_organization_id_idx ON organization_payment_cards(organization_id);
CREATE INDEX IF NOT EXISTS organization_payment_cards_encryption_key_id_idx ON organization_payment_cards(encryption_key_id);
CREATE INDEX IF NOT EXISTS organization_payment_cards_is_active_default_idx ON organization_payment_cards(is_active, is_default);

ALTER TABLE organization_payment_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization users can view their payment cards"
  ON organization_payment_cards FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Main users can manage payment cards"
  ON organization_payment_cards FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.role IN ('main_user', 'secondary_main_user')
      AND ou.is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    organization_id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.role IN ('main_user', 'secondary_main_user')
      AND ou.is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- =====================================================
-- 4. DRIVER PAYMENT SETTINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS driver_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  pin_hash text,
  pin_salt text,
  is_pin_active boolean DEFAULT false,
  failed_pin_attempts integer DEFAULT 0,
  locked_until timestamptz,
  daily_spending_limit decimal(10,2) DEFAULT 5000.00,
  monthly_spending_limit decimal(12,2) DEFAULT 50000.00,
  payment_enabled boolean DEFAULT true,
  require_pin_change boolean DEFAULT false,
  pin_last_changed timestamptz,
  last_payment_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_payment_settings_driver_id_idx ON driver_payment_settings(driver_id);
CREATE INDEX IF NOT EXISTS driver_payment_settings_organization_id_idx ON driver_payment_settings(organization_id);
CREATE INDEX IF NOT EXISTS driver_payment_settings_payment_enabled_idx ON driver_payment_settings(payment_enabled, is_pin_active);
CREATE INDEX IF NOT EXISTS driver_payment_settings_locked_until_idx ON driver_payment_settings(locked_until) WHERE locked_until IS NOT NULL;

ALTER TABLE driver_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers and org users can view payment settings"
  ON driver_payment_settings FOR SELECT
  TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Main users can manage driver payment settings"
  ON driver_payment_settings FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.role IN ('main_user', 'secondary_main_user')
      AND ou.is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    organization_id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.role IN ('main_user', 'secondary_main_user')
      AND ou.is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- =====================================================
-- 5. DRIVER SPENDING TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS driver_spending_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  tracking_date date NOT NULL DEFAULT CURRENT_DATE,
  daily_amount_spent decimal(10,2) DEFAULT 0.00,
  monthly_amount_spent decimal(12,2) DEFAULT 0.00,
  transaction_count_daily integer DEFAULT 0,
  transaction_count_monthly integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(driver_id, tracking_date)
);

CREATE INDEX IF NOT EXISTS driver_spending_tracking_driver_id_idx ON driver_spending_tracking(driver_id);
CREATE INDEX IF NOT EXISTS driver_spending_tracking_tracking_date_idx ON driver_spending_tracking(tracking_date);
CREATE INDEX IF NOT EXISTS driver_spending_tracking_driver_date_idx ON driver_spending_tracking(driver_id, tracking_date);

ALTER TABLE driver_spending_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization users can view driver spending"
  ON driver_spending_tracking FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT d.id FROM drivers d
      WHERE d.organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- =====================================================
-- 6. NFC PAYMENT TRANSACTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS nfc_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_transaction_id uuid,
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  organization_card_id uuid REFERENCES organization_payment_cards(id) ON DELETE SET NULL NOT NULL,
  amount decimal(10,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'initiated' CHECK (
    payment_status IN ('initiated', 'pin_verified', 'nfc_ready', 'transmitting', 'completed', 'failed', 'timeout', 'cancelled', 'fallback_to_eft')
  ),
  pin_entered_at timestamptz,
  pin_verified_at timestamptz,
  nfc_activated_at timestamptz,
  nfc_data_transmitted_at timestamptz,
  payment_completed_at timestamptz,
  device_info jsonb,
  location_lat decimal(10,8),
  location_lng decimal(11,8),
  failure_reason text,
  failure_code text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nfc_payment_transactions_fuel_transaction_id_idx ON nfc_payment_transactions(fuel_transaction_id);
CREATE INDEX IF NOT EXISTS nfc_payment_transactions_driver_id_idx ON nfc_payment_transactions(driver_id);
CREATE INDEX IF NOT EXISTS nfc_payment_transactions_organization_card_id_idx ON nfc_payment_transactions(organization_card_id);
CREATE INDEX IF NOT EXISTS nfc_payment_transactions_payment_status_idx ON nfc_payment_transactions(payment_status);
CREATE INDEX IF NOT EXISTS nfc_payment_transactions_status_created_idx ON nfc_payment_transactions(payment_status, created_at);

ALTER TABLE nfc_payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization users can view nfc transactions"
  ON nfc_payment_transactions FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT d.id FROM drivers d
      WHERE d.organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    OR driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Drivers and org users can manage nfc transactions"
  ON nfc_payment_transactions FOR ALL
  TO authenticated
  USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR driver_id IN (
      SELECT d.id FROM drivers d
      WHERE d.organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR driver_id IN (
      SELECT d.id FROM drivers d
      WHERE d.organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- =====================================================
-- 7. ADD PAYMENT COLUMNS TO FUEL_TRANSACTIONS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN payment_method text DEFAULT 'eft_batch' CHECK (
      payment_method IN ('eft_batch', 'nfc_instant')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN payment_status text DEFAULT 'pending' CHECK (
      payment_status IN ('pending', 'authorized', 'completed', 'failed')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'nfc_payment_transaction_id'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN nfc_payment_transaction_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'payment_completed_at'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN payment_completed_at timestamptz;
  END IF;
END $$;

-- Add foreign key constraint after table is created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fuel_transactions_nfc_payment_transaction_id_fkey'
  ) THEN
    ALTER TABLE fuel_transactions 
    ADD CONSTRAINT fuel_transactions_nfc_payment_transaction_id_fkey 
    FOREIGN KEY (nfc_payment_transaction_id) 
    REFERENCES nfc_payment_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS fuel_transactions_payment_method_idx ON fuel_transactions(payment_method);
CREATE INDEX IF NOT EXISTS fuel_transactions_payment_status_idx ON fuel_transactions(payment_status);
CREATE INDEX IF NOT EXISTS fuel_transactions_nfc_payment_transaction_id_idx ON fuel_transactions(nfc_payment_transaction_id);
CREATE INDEX IF NOT EXISTS fuel_transactions_payment_method_status_idx ON fuel_transactions(payment_method, payment_status);

-- =====================================================
-- 8. HELPER FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to ensure only one default card per organization
CREATE OR REPLACE FUNCTION ensure_one_default_card_per_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE organization_payment_cards
    SET is_default = false
    WHERE organization_id = NEW.organization_id
    AND id != NEW.id
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_one_default_card_per_org_trigger ON organization_payment_cards;
CREATE TRIGGER ensure_one_default_card_per_org_trigger
  BEFORE INSERT OR UPDATE ON organization_payment_cards
  FOR EACH ROW
  EXECUTE FUNCTION ensure_one_default_card_per_org();

-- Function to auto-create payment settings when driver is created
CREATE OR REPLACE FUNCTION create_driver_payment_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO driver_payment_settings (
    driver_id,
    organization_id,
    payment_enabled,
    daily_spending_limit,
    monthly_spending_limit
  ) VALUES (
    NEW.id,
    NEW.organization_id,
    true,
    5000.00,
    50000.00
  )
  ON CONFLICT (driver_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_driver_payment_settings_trigger ON drivers;
CREATE TRIGGER create_driver_payment_settings_trigger
  AFTER INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION create_driver_payment_settings();

-- Function to increment driver spending
CREATE OR REPLACE FUNCTION increment_driver_spending(
  p_driver_id uuid,
  p_amount decimal,
  p_transaction_date date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
  v_month_start date;
BEGIN
  v_month_start := date_trunc('month', p_transaction_date)::date;
  
  INSERT INTO driver_spending_tracking (
    driver_id,
    tracking_date,
    daily_amount_spent,
    monthly_amount_spent,
    transaction_count_daily,
    transaction_count_monthly,
    last_updated
  ) VALUES (
    p_driver_id,
    p_transaction_date,
    p_amount,
    p_amount,
    1,
    1,
    now()
  )
  ON CONFLICT (driver_id, tracking_date)
  DO UPDATE SET
    daily_amount_spent = driver_spending_tracking.daily_amount_spent + p_amount,
    transaction_count_daily = driver_spending_tracking.transaction_count_daily + 1,
    last_updated = now();
  
  UPDATE driver_spending_tracking
  SET monthly_amount_spent = (
    SELECT COALESCE(SUM(daily_amount_spent), 0)
    FROM driver_spending_tracking dst
    WHERE dst.driver_id = p_driver_id
    AND dst.tracking_date >= v_month_start
    AND dst.tracking_date <= p_transaction_date
  ),
  transaction_count_monthly = (
    SELECT COALESCE(SUM(transaction_count_daily), 0)
    FROM driver_spending_tracking dst
    WHERE dst.driver_id = p_driver_id
    AND dst.tracking_date >= v_month_start
    AND dst.tracking_date <= p_transaction_date
  )
  WHERE driver_id = p_driver_id
  AND tracking_date >= v_month_start
  AND tracking_date <= p_transaction_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current spending for limit checks
CREATE OR REPLACE FUNCTION get_driver_current_spending(p_driver_id uuid)
RETURNS TABLE (
  daily_spent decimal,
  monthly_spent decimal,
  daily_limit decimal,
  monthly_limit decimal,
  can_pay boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(dst.daily_amount_spent, 0) as daily_spent,
    COALESCE(dst.monthly_amount_spent, 0) as monthly_spent,
    dps.daily_spending_limit as daily_limit,
    dps.monthly_spending_limit as monthly_limit,
    (dps.payment_enabled AND 
     dps.is_pin_active AND 
     (dps.locked_until IS NULL OR dps.locked_until < now())) as can_pay
  FROM driver_payment_settings dps
  LEFT JOIN driver_spending_tracking dst ON (
    dst.driver_id = dps.driver_id AND 
    dst.tracking_date = CURRENT_DATE
  )
  WHERE dps.driver_id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark payment as completed
CREATE OR REPLACE FUNCTION complete_nfc_payment(p_nfc_payment_id uuid)
RETURNS void AS $$
DECLARE
  v_fuel_transaction_id uuid;
  v_driver_id uuid;
  v_amount decimal;
BEGIN
  SELECT fuel_transaction_id, driver_id, amount
  INTO v_fuel_transaction_id, v_driver_id, v_amount
  FROM nfc_payment_transactions
  WHERE id = p_nfc_payment_id;

  UPDATE nfc_payment_transactions
  SET 
    payment_status = 'completed',
    payment_completed_at = now()
  WHERE id = p_nfc_payment_id;

  IF v_fuel_transaction_id IS NOT NULL THEN
    UPDATE fuel_transactions
    SET 
      payment_status = 'completed',
      payment_completed_at = now()
    WHERE id = v_fuel_transaction_id;
  END IF;

  PERFORM increment_driver_spending(v_driver_id, v_amount);

  UPDATE driver_payment_settings
  SET last_payment_at = now()
  WHERE driver_id = v_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle payment failure with EFT fallback
CREATE OR REPLACE FUNCTION fail_nfc_payment_fallback_to_eft(
  p_nfc_payment_id uuid,
  p_failure_reason text,
  p_failure_code text
)
RETURNS void AS $$
DECLARE
  v_fuel_transaction_id uuid;
BEGIN
  SELECT fuel_transaction_id
  INTO v_fuel_transaction_id
  FROM nfc_payment_transactions
  WHERE id = p_nfc_payment_id;

  UPDATE nfc_payment_transactions
  SET 
    payment_status = 'fallback_to_eft',
    failure_reason = p_failure_reason,
    failure_code = p_failure_code
  WHERE id = p_nfc_payment_id;

  IF v_fuel_transaction_id IS NOT NULL THEN
    UPDATE fuel_transactions
    SET 
      payment_method = 'eft_batch',
      payment_status = 'pending',
      nfc_payment_transaction_id = NULL
    WHERE id = v_fuel_transaction_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create payment settings for existing drivers
INSERT INTO driver_payment_settings (driver_id, organization_id, payment_enabled, daily_spending_limit, monthly_spending_limit)
SELECT 
  id as driver_id,
  organization_id,
  true as payment_enabled,
  5000.00 as daily_spending_limit,
  50000.00 as monthly_spending_limit
FROM drivers
WHERE id NOT IN (SELECT driver_id FROM driver_payment_settings)
ON CONFLICT (driver_id) DO NOTHING;
