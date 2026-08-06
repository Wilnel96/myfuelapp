/*
# Fix calculate_statement_totals to compute true opening balance from history

## Problem
The previous version of `calculate_statement_totals` used the previous statement's
closing balance as the opening balance, and when periods overlapped, it only counted
transactions after the previous statement's period_end. This caused a disconnect:
`get_statement_invoices` showed ALL invoices in the period, but the totals only
counted invoices after the overlap cutoff, making closing balance = opening balance
even when invoices were listed on the statement.

## Fix
Rewrite `calculate_statement_totals` to:
1. Compute the opening balance as the TRUE balance at period_start:
   (all invoices before period_start) - (all payments before period_start)
2. Count ALL invoices and payments in the full period (period_start to period_end)
3. Remove the overlap logic entirely — each statement is a standalone view of its period

This makes the totals always match the invoices/payments shown by
`get_statement_invoices` and `get_statement_payments`.

## Security
- Function is SECURITY DEFINER, search_path safe.
- No changes to RLS or table structure.
*/

CREATE OR REPLACE FUNCTION public.calculate_statement_totals(p_statement_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statement record;
  v_total_invoices numeric;
  v_total_payments numeric;
  v_opening_balance numeric;
BEGIN
  SELECT * INTO v_statement
  FROM garage_statements
  WHERE id = p_statement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statement not found';
  END IF;

  -- Opening balance = all invoices before period_start - all payments before period_start
  -- This is the TRUE balance the client owes the garage at the start of the period,
  -- regardless of what previous statements exist or whether periods overlap.
  SELECT
    COALESCE(SUM(fti.total_amount), 0) - COALESCE(SUM(gdp.amount), 0)
  INTO v_opening_balance
  FROM (
    SELECT fti.total_amount
    FROM fuel_transaction_invoices fti
    LEFT JOIN fuel_transactions ft ON ft.id = fti.fuel_transaction_id
    WHERE fti.organization_id = v_statement.organization_id
      AND (ft.garage_id = v_statement.garage_id OR ft.garage_id IS NULL OR ft.id IS NULL)
      AND fti.transaction_date::date < v_statement.period_start
  ) fti
  FULL OUTER JOIN (
    SELECT gdp.amount
    FROM garage_debtor_payments gdp
    WHERE gdp.organization_id = v_statement.organization_id
      AND gdp.garage_id = v_statement.garage_id
      AND gdp.payment_date < v_statement.period_start
  ) gdp ON TRUE;

  -- Total invoices in the full period
  SELECT COALESCE(SUM(fti.total_amount), 0)
  INTO v_total_invoices
  FROM fuel_transaction_invoices fti
  LEFT JOIN fuel_transactions ft ON ft.id = fti.fuel_transaction_id
  WHERE fti.organization_id = v_statement.organization_id
    AND (ft.garage_id = v_statement.garage_id OR ft.garage_id IS NULL OR ft.id IS NULL)
    AND fti.transaction_date::date >= v_statement.period_start
    AND fti.transaction_date::date <= v_statement.period_end;

  -- Total payments in the full period
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_payments
  FROM garage_debtor_payments
  WHERE organization_id = v_statement.organization_id
    AND garage_id = v_statement.garage_id
    AND payment_date >= v_statement.period_start
    AND payment_date <= v_statement.period_end;

  UPDATE garage_statements
  SET
    opening_balance = COALESCE(v_opening_balance, 0),
    total_invoices  = COALESCE(v_total_invoices, 0),
    total_payments  = COALESCE(v_total_payments, 0),
    closing_balance = COALESCE(v_opening_balance, 0) + COALESCE(v_total_invoices, 0) - COALESCE(v_total_payments, 0)
  WHERE id = p_statement_id;
END;
$$ LANGUAGE plpgsql;

-- Recalculate all existing Shell Robertson statements so they reflect the fix
SELECT calculate_statement_totals(id) FROM garage_statements
WHERE garage_id = 'bf932c12-8ac3-4baf-9142-b794a0a021d7'
ORDER BY statement_date;