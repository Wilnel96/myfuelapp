/*
  # Fix calculate_statement_totals for overlapping statement periods

  ## Problem
  When a statement's period_start overlaps with a previous statement's date range,
  the function double-counts transactions that are already reflected in the opening balance.

  Example:
  - Statement 1: 01/03–31/03, payments=6442.48, closing=-5000 (CR R5000)
  - Statement 2: 01/03–29/04, opening taken from Statement 1 closing=-5000 (correct),
    but then re-sums ALL payments from 01/03–29/04 including the March ones already
    reflected in the -5000 opening, causing double-count.

  ## Fix
  Detect period overlap with the previous statement. When overlap exists:
  - Use previous statement's opening_balance (not closing_balance) as the new opening
  - Query invoices/payments only from (previous period_end + 1 day) onward
  When no overlap: use existing behavior (previous closing as opening, full period queries).
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

  IF v_prev_statement.id IS NOT NULL AND v_statement.period_start <= v_prev_statement.period_end THEN
    -- Overlapping periods: opening = previous opening_balance; only count new date range
    v_opening_balance := COALESCE(v_prev_statement.opening_balance, 0);
    v_effective_start := v_prev_statement.period_end + INTERVAL '1 day';
  ELSE
    -- Non-overlapping: opening = previous closing_balance; count full current period
    v_opening_balance := COALESCE(v_prev_statement.closing_balance, 0);
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
