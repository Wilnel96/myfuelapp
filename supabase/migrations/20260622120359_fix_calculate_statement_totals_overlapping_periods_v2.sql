/*
  # Fix calculate_statement_totals overlapping periods (v2)

  ## Problem with v1 fix
  When overlap detected, v1 used previous statement's opening_balance as the new
  opening — but that's wrong. The opening balance should still be the previous
  statement's closing_balance (e.g. CR R5000). Only the transaction query window
  needs to shift forward to avoid re-counting March transactions.

  ## Correct logic
  When current period_start <= previous period_end (overlap detected):
    - opening_balance = previous closing_balance  (carry forward what was owed)
    - query invoices/payments only from (previous period_end + 1 day) onward
  When no overlap:
    - opening_balance = previous closing_balance  (same as always)
    - query invoices/payments for full current period
*/

CREATE OR REPLACE FUNCTION calculate_statement_totals(p_statement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statement record;
  v_prev_statement record;
  v_total_invoices numeric;
  v_total_payments numeric;
  v_opening_balance numeric;
  v_effective_start date;
BEGIN
  SELECT * INTO v_statement
  FROM garage_statements
  WHERE id = p_statement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statement not found';
  END IF;

  -- Find the most recent previous statement for same garage + org
  SELECT * INTO v_prev_statement
  FROM garage_statements
  WHERE garage_id = v_statement.garage_id
    AND organization_id = v_statement.organization_id
    AND statement_date < v_statement.statement_date
  ORDER BY statement_date DESC
  LIMIT 1;

  -- Opening balance is always previous closing balance (or 0 if first statement)
  v_opening_balance := COALESCE(v_prev_statement.closing_balance, 0);

  IF v_prev_statement.id IS NOT NULL AND v_statement.period_start <= v_prev_statement.period_end THEN
    -- Overlapping periods: only count transactions in the NEW date range
    -- (after the previous statement's period ended) to avoid double-counting
    v_effective_start := v_prev_statement.period_end + INTERVAL '1 day';
  ELSE
    -- Non-overlapping: count all transactions in the full current period
    v_effective_start := v_statement.period_start;
  END IF;

  SELECT COALESCE(SUM(fti.total_amount), 0)
  INTO v_total_invoices
  FROM fuel_transaction_invoices fti
  LEFT JOIN fuel_transactions ft ON fti.fuel_transaction_id = ft.id
  WHERE fti.organization_id = v_statement.organization_id
    AND (ft.garage_id = v_statement.garage_id OR ft.garage_id IS NULL)
    AND fti.transaction_date::date >= v_effective_start
    AND fti.transaction_date::date <= v_statement.period_end;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_payments
  FROM garage_debtor_payments
  WHERE organization_id = v_statement.organization_id
    AND garage_id = v_statement.garage_id
    AND payment_date >= v_effective_start
    AND payment_date <= v_statement.period_end;

  UPDATE garage_statements
  SET
    opening_balance = v_opening_balance,
    total_invoices  = COALESCE(v_total_invoices, 0),
    total_payments  = COALESCE(v_total_payments, 0),
    closing_balance = v_opening_balance + COALESCE(v_total_invoices, 0) - COALESCE(v_total_payments, 0)
  WHERE id = p_statement_id;
END;
$$;
