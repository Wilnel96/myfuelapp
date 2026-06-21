/*
  # Add Spending Limit Enforcement and Concurrency Controls
  
  1. Purpose
    - Enforce spending limits at database level for 50,000 concurrent drivers
    - Add transaction locking to prevent race conditions
    - Add functions to check spending limits before transactions
    - Ensure data integrity under high load
  
  2. Features
    - Check daily/monthly spending limits for organizations
    - Check driver individual spending limits
    - Check garage account limits
    - Advisory locks to prevent duplicate concurrent transactions
    - Automatic spending calculation functions
*/

-- =====================================================
-- SPENDING LIMIT CHECK FUNCTIONS
-- =====================================================

-- Function to check organization spending limits
CREATE OR REPLACE FUNCTION check_organization_spending_limit(
  p_organization_id uuid,
  p_transaction_amount numeric
) RETURNS TABLE (
  allowed boolean,
  reason text,
  daily_limit numeric,
  daily_spent numeric,
  monthly_limit numeric,
  monthly_spent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_daily_limit numeric;
  v_org_monthly_limit numeric;
  v_daily_spent numeric;
  v_monthly_spent numeric;
BEGIN
  -- Get organization limits
  SELECT 
    daily_spending_limit,
    monthly_spending_limit
  INTO v_org_daily_limit, v_org_monthly_limit
  FROM organizations
  WHERE id = p_organization_id;
  
  -- Calculate today's spending
  SELECT COALESCE(SUM(total_amount + oil_total_amount), 0)
  INTO v_daily_spent
  FROM fuel_transactions
  WHERE organization_id = p_organization_id
    AND transaction_date >= CURRENT_DATE
    AND transaction_date < CURRENT_DATE + INTERVAL '1 day';
  
  -- Calculate this month's spending
  SELECT COALESCE(SUM(total_amount + oil_total_amount), 0)
  INTO v_monthly_spent
  FROM fuel_transactions
  WHERE organization_id = p_organization_id
    AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
  
  -- Check daily limit
  IF v_org_daily_limit IS NOT NULL THEN
    IF (v_daily_spent + p_transaction_amount) > v_org_daily_limit THEN
      RETURN QUERY SELECT 
        false,
        'Daily spending limit exceeded'::text,
        v_org_daily_limit,
        v_daily_spent,
        v_org_monthly_limit,
        v_monthly_spent;
      RETURN;
    END IF;
  END IF;
  
  -- Check monthly limit
  IF v_org_monthly_limit IS NOT NULL THEN
    IF (v_monthly_spent + p_transaction_amount) > v_org_monthly_limit THEN
      RETURN QUERY SELECT 
        false,
        'Monthly spending limit exceeded'::text,
        v_org_daily_limit,
        v_daily_spent,
        v_org_monthly_limit,
        v_monthly_spent;
      RETURN;
    END IF;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT 
    true,
    'OK'::text,
    v_org_daily_limit,
    v_daily_spent,
    v_org_monthly_limit,
    v_monthly_spent;
END;
$$;

-- Function to check driver spending limits
CREATE OR REPLACE FUNCTION check_driver_spending_limit(
  p_driver_id uuid,
  p_transaction_amount numeric
) RETURNS TABLE (
  allowed boolean,
  reason text,
  daily_limit numeric,
  daily_spent numeric,
  monthly_limit numeric,
  monthly_spent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily_limit numeric;
  v_monthly_limit numeric;
  v_daily_spent numeric;
  v_monthly_spent numeric;
BEGIN
  -- Get driver limits (if driver_payment_settings table exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'driver_payment_settings'
  ) THEN
    EXECUTE '
      SELECT daily_spending_limit, monthly_spending_limit
      FROM driver_payment_settings
      WHERE driver_id = $1
    ' INTO v_daily_limit, v_monthly_limit
    USING p_driver_id;
  END IF;
  
  -- Calculate today's spending for this driver
  SELECT COALESCE(SUM(total_amount + oil_total_amount), 0)
  INTO v_daily_spent
  FROM fuel_transactions
  WHERE driver_id = p_driver_id
    AND transaction_date >= CURRENT_DATE
    AND transaction_date < CURRENT_DATE + INTERVAL '1 day';
  
  -- Calculate this month's spending for this driver
  SELECT COALESCE(SUM(total_amount + oil_total_amount), 0)
  INTO v_monthly_spent
  FROM fuel_transactions
  WHERE driver_id = p_driver_id
    AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
  
  -- Check daily limit
  IF v_daily_limit IS NOT NULL THEN
    IF (v_daily_spent + p_transaction_amount) > v_daily_limit THEN
      RETURN QUERY SELECT 
        false,
        'Driver daily spending limit exceeded'::text,
        v_daily_limit,
        v_daily_spent,
        v_monthly_limit,
        v_monthly_spent;
      RETURN;
    END IF;
  END IF;
  
  -- Check monthly limit
  IF v_monthly_limit IS NOT NULL THEN
    IF (v_monthly_spent + p_transaction_amount) > v_monthly_limit THEN
      RETURN QUERY SELECT 
        false,
        'Driver monthly spending limit exceeded'::text,
        v_daily_limit,
        v_daily_spent,
        v_monthly_limit,
        v_monthly_spent;
      RETURN;
    END IF;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT 
    true,
    'OK'::text,
    v_daily_limit,
    v_daily_spent,
    v_monthly_limit,
    v_monthly_spent;
END;
$$;

-- Function to check garage account limits
CREATE OR REPLACE FUNCTION check_garage_account_limit(
  p_organization_id uuid,
  p_garage_id uuid,
  p_transaction_amount numeric
) RETURNS TABLE (
  allowed boolean,
  reason text,
  monthly_limit numeric,
  monthly_spent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_limit numeric;
  v_monthly_spent numeric;
  v_is_active boolean;
BEGIN
  -- Get garage account settings
  SELECT monthly_spend_limit, is_active
  INTO v_monthly_limit, v_is_active
  FROM organization_garage_accounts
  WHERE organization_id = p_organization_id
    AND garage_id = p_garage_id;
  
  -- If no account found, return allowed (for backward compatibility)
  IF v_is_active IS NULL THEN
    RETURN QUERY SELECT 
      true,
      'No garage account limit configured'::text,
      NULL::numeric,
      0::numeric;
    RETURN;
  END IF;
  
  -- Check if account is active
  IF NOT v_is_active THEN
    RETURN QUERY SELECT 
      false,
      'Garage account is inactive'::text,
      v_monthly_limit,
      0::numeric;
    RETURN;
  END IF;
  
  -- Calculate this month's spending at this garage
  SELECT COALESCE(SUM(total_amount + oil_total_amount), 0)
  INTO v_monthly_spent
  FROM fuel_transactions
  WHERE organization_id = p_organization_id
    AND garage_id = p_garage_id
    AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
  
  -- Check monthly limit
  IF v_monthly_limit IS NOT NULL THEN
    IF (v_monthly_spent + p_transaction_amount) > v_monthly_limit THEN
      RETURN QUERY SELECT 
        false,
        'Garage account monthly limit exceeded'::text,
        v_monthly_limit,
        v_monthly_spent;
      RETURN;
    END IF;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT 
    true,
    'OK'::text,
    v_monthly_limit,
    v_monthly_spent;
END;
$$;

-- =====================================================
-- CONCURRENCY CONTROL - PREVENT DUPLICATE TRANSACTIONS
-- =====================================================

-- Function to acquire advisory lock for transaction creation
CREATE OR REPLACE FUNCTION acquire_transaction_lock(
  p_driver_id uuid,
  p_vehicle_id uuid
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key bigint;
BEGIN
  -- Create a unique lock key from driver_id and vehicle_id
  -- Use first 4 bytes of each UUID's hash
  v_lock_key := (
    ('x' || substring(md5(p_driver_id::text) from 1 for 8))::bit(32)::bigint << 32
  ) | (
    ('x' || substring(md5(p_vehicle_id::text) from 1 for 8))::bit(32)::bigint
  );
  
  -- Try to acquire lock (non-blocking, transaction-scoped)
  RETURN pg_try_advisory_xact_lock(v_lock_key);
END;
$$;

-- =====================================================
-- PERFORMANCE INDEXES FOR SPENDING CALCULATIONS
-- =====================================================

-- Composite index for organization daily/monthly spending lookups
CREATE INDEX IF NOT EXISTS idx_fuel_trans_org_date_totals
  ON fuel_transactions(organization_id, transaction_date, total_amount, oil_total_amount);

-- Composite index for driver daily/monthly spending lookups
CREATE INDEX IF NOT EXISTS idx_fuel_trans_driver_date_totals
  ON fuel_transactions(driver_id, transaction_date, total_amount, oil_total_amount)
  WHERE driver_id IS NOT NULL;

-- Composite index for garage account spending lookups
CREATE INDEX IF NOT EXISTS idx_fuel_trans_garage_org_date_totals
  ON fuel_transactions(garage_id, organization_id, transaction_date, total_amount, oil_total_amount);

-- =====================================================
-- UPDATE STATISTICS
-- =====================================================

ANALYZE fuel_transactions;
ANALYZE organizations;
ANALYZE organization_garage_accounts;