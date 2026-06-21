/*
  # Fix calculate_statement_totals using wrong payments table

  ## Problem
  The function queries `garage_client_payments` which does not exist.
  The correct table is `garage_debtor_payments`.
  This caused payments to never appear on statements (always totalled as 0).
*/

CREATE OR REPLACE FUNCTION calculate_statement_totals(p_statement_id uuid)
RETURNS void
LANGUAGE plpgsql
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

  SELECT COALESCE(SUM(fti.total_amount), 0)
  INTO v_total_invoices
  FROM fuel_transaction_invoices fti
  LEFT JOIN fuel_transactions ft ON fti.fuel_transaction_id = ft.id
  WHERE fti.organization_id = v_statement.organization_id
    AND (ft.garage_id = v_statement.garage_id OR ft.garage_id IS NULL)
    AND fti.transaction_date::date >= v_statement.period_start
    AND fti.transaction_date::date <= v_statement.period_end;

  -- Fixed: was querying non-existent table garage_client_payments
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_payments
  FROM garage_debtor_payments
  WHERE organization_id = v_statement.organization_id
    AND garage_id = v_statement.garage_id
    AND payment_date >= v_statement.period_start
    AND payment_date <= v_statement.period_end;

  SELECT COALESCE(closing_balance, 0)
  INTO v_opening_balance
  FROM garage_statements
  WHERE garage_id = v_statement.garage_id
    AND organization_id = v_statement.organization_id
    AND statement_date < v_statement.statement_date
  ORDER BY statement_date DESC
  LIMIT 1;

  IF v_opening_balance IS NULL THEN
    v_opening_balance := 0;
  END IF;

  UPDATE garage_statements
  SET
    opening_balance = COALESCE(v_opening_balance, 0),
    total_invoices  = COALESCE(v_total_invoices, 0),
    total_payments  = COALESCE(v_total_payments, 0),
    closing_balance = COALESCE(v_opening_balance, 0) + COALESCE(v_total_invoices, 0) - COALESCE(v_total_payments, 0)
  WHERE id = p_statement_id;
END;
$$;
