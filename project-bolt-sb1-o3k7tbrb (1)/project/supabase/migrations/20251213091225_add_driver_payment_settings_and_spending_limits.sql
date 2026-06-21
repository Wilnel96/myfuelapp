/*
  # Driver Payment Settings and Spending Limits

  1. New Tables
    - `driver_payment_settings`
      - `id` (uuid, primary key)
      - `driver_id` (uuid, foreign key to drivers)
      - `organization_id` (uuid, foreign key to organizations)
      - `pin_hash` (text) - Bcrypt hashed 4-digit PIN
      - `pin_salt` (text) - Unique salt for PIN hashing
      - `is_pin_active` (boolean) - PIN is set and active
      - `failed_pin_attempts` (integer) - Count of failed attempts
      - `locked_until` (timestamptz) - Account locked until this time
      - `daily_spending_limit` (decimal) - Maximum daily spending in currency
      - `monthly_spending_limit` (decimal) - Maximum monthly spending in currency
      - `payment_enabled` (boolean) - Driver can make NFC payments
      - `require_pin_change` (boolean) - Force PIN change on next login
      - `pin_last_changed` (timestamptz) - When PIN was last updated
      - `last_payment_at` (timestamptz) - Last successful payment time
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `driver_spending_tracking`
      - `id` (uuid, primary key)
      - `driver_id` (uuid, foreign key to drivers)
      - `tracking_date` (date) - Date for tracking (unique per driver per day)
      - `daily_amount_spent` (decimal) - Amount spent today
      - `monthly_amount_spent` (decimal) - Amount spent this month
      - `transaction_count_daily` (integer) - Number of transactions today
      - `transaction_count_monthly` (integer) - Number of transactions this month
      - `last_updated` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Drivers can view their own payment settings (not PIN hash)
    - Organization main users can manage driver payment settings
    - Only Edge Functions can access PIN hashes
    - Spending tracking is read-only except by system functions

  3. Indexes
    - Index on driver_id for fast lookups
    - Index on organization_id
    - Index on tracking_date for date-based queries
    - Index on payment_enabled and is_pin_active
*/

-- Create driver_payment_settings table
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

-- Drivers can view their own payment settings (excluding PIN hash and salt)
CREATE POLICY "Drivers can view their own payment settings"
  ON driver_payment_settings FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
    OR
    -- Organization users can view settings for their organization's drivers
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- Management org users can view all
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Only main users can insert driver payment settings
CREATE POLICY "Organization main users can insert driver payment settings"
  ON driver_payment_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT ou.organization_id
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Main users and drivers themselves (for PIN changes) can update
CREATE POLICY "Drivers and main users can update payment settings"
  ON driver_payment_settings FOR UPDATE
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT ou.organization_id
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT ou.organization_id
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Only main users can delete
CREATE POLICY "Organization main users can delete driver payment settings"
  ON driver_payment_settings FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT ou.organization_id
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Create driver_spending_tracking table
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

-- Anyone in organization can view spending tracking
CREATE POLICY "Organization users can view driver spending tracking"
  ON driver_spending_tracking FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT d.id FROM drivers d
      WHERE d.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    -- Management org can view all
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Only system (through Edge Functions) can insert/update spending tracking
-- No direct INSERT/UPDATE/DELETE policies for users - this will be handled by functions

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
    5000.00, -- Default R5000 daily limit
    50000.00 -- Default R50000 monthly limit
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_driver_payment_settings_trigger
  AFTER INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION create_driver_payment_settings();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_payment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_driver_payment_settings_updated_at_trigger
  BEFORE UPDATE ON driver_payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_payment_settings_updated_at();

-- Function to increment spending (called by Edge Function after successful payment)
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
  
  -- Insert or update today's spending
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
  
  -- Update monthly totals for all records this month
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
CREATE OR REPLACE FUNCTION get_driver_current_spending(
  p_driver_id uuid
)
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
