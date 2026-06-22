-- Fix check_garage_account_limit to use statement balance instead of monthly fuel spend.
-- 
-- Correct formula:
--   available = (spending_limit - deposit) + credit_balance
-- where credit_balance = -(latest statement closing_balance)
--   positive closing_balance = org owes money (debit)
--   negative closing_balance = org is in credit
--
-- A transaction is blocked when:
--   current_debit_balance + transaction_amount > (spending_limit - deposit)
-- i.e. transaction_amount > available_credit

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
  v_monthly_limit  numeric;
  v_deposit        numeric;
  v_is_active      boolean;
  v_closing_bal    numeric;  -- positive = owes money (debit), negative = in credit
  v_effective_limit numeric;
  v_current_debt   numeric;
BEGIN
  -- Get garage account settings
  SELECT monthly_spend_limit, COALESCE(deposit_amount, 0), is_active
  INTO v_monthly_limit, v_deposit, v_is_active
  FROM organization_garage_accounts
  WHERE organization_id = p_organization_id
    AND garage_id = p_garage_id;

  -- No account found — allow (backward compatibility)
  IF v_is_active IS NULL THEN
    RETURN QUERY SELECT
      true,
      'No garage account limit configured'::text,
      NULL::numeric,
      0::numeric;
    RETURN;
  END IF;

  -- Account inactive
  IF NOT v_is_active THEN
    RETURN QUERY SELECT
      false,
      'Garage account is inactive'::text,
      v_monthly_limit,
      0::numeric;
    RETURN;
  END IF;

  -- No spending limit configured — allow
  IF v_monthly_limit IS NULL THEN
    RETURN QUERY SELECT
      true,
      'No spending limit configured'::text,
      NULL::numeric,
      0::numeric;
    RETURN;
  END IF;

  -- Get the closing balance from the most recent statement for this org+garage.
  -- closing_balance > 0 means they owe money (debit); < 0 means they are in credit.
  SELECT COALESCE(closing_balance, 0)
  INTO v_closing_bal
  FROM garage_statements
  WHERE organization_id = p_organization_id
    AND garage_id = p_garage_id
  ORDER BY statement_date DESC, created_at DESC
  LIMIT 1;

  IF v_closing_bal IS NULL THEN
    v_closing_bal := 0;
  END IF;

  -- Effective credit limit = spending_limit - deposit
  v_effective_limit := v_monthly_limit - v_deposit;

  -- Current debt exposure = closing_balance (positive = they already owe this much)
  -- Available = effective_limit - current_debt (negative closing = credit, increases available)
  v_current_debt := v_closing_bal;

  -- Block if adding this transaction would exceed the effective limit
  IF (v_current_debt + p_transaction_amount) > v_effective_limit THEN
    RETURN QUERY SELECT
      false,
      format(
        'Account limit exceeded. Limit: R%.2f, Deposit: R%.2f, Current balance: R%.2f, Available: R%.2f',
        v_monthly_limit,
        v_deposit,
        v_current_debt,
        GREATEST(v_effective_limit - v_current_debt, 0)
      )::text,
      v_monthly_limit,
      v_current_debt;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT
    true,
    'OK'::text,
    v_monthly_limit,
    v_current_debt;
END;
$$;

GRANT EXECUTE ON FUNCTION check_garage_account_limit(uuid, uuid, numeric) TO authenticated, anon;
