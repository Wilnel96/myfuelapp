/*
  # Fix Calculate Statement Totals - Handle Null Opening Balance
  
  1. Changes
    - Update calculate_statement_totals to handle null opening balance
    - Default to 0 if no opening balance is found
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
  -- Get statement details
  SELECT * INTO v_statement
  FROM garage_statements
  WHERE id = p_statement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statement not found';
  END IF;

  -- Calculate total invoices in period
  -- Use JOIN with fuel_transactions to filter by garage_id instead of garage_name
  SELECT COALESCE(SUM(fti.total_amount), 0)
  INTO v_total_invoices
  FROM fuel_transaction_invoices fti
  INNER JOIN fuel_transactions ft ON fti.fuel_transaction_id = ft.id
  WHERE fti.organization_id = v_statement.organization_id
    AND ft.garage_id = v_statement.garage_id
    AND fti.transaction_date::date >= v_statement.period_start
    AND fti.transaction_date::date <= v_statement.period_end;

  -- Calculate total payments in period
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_payments
  FROM garage_client_payments
  WHERE organization_id = v_statement.organization_id
    AND garage_id = v_statement.garage_id
    AND payment_date >= v_statement.period_start
    AND payment_date <= v_statement.period_end;

  -- Get opening balance from previous statement or default to 0
  SELECT COALESCE(closing_balance, 0)
  INTO v_opening_balance
  FROM garage_statements
  WHERE garage_id = v_statement.garage_id
    AND organization_id = v_statement.organization_id
    AND statement_date < v_statement.statement_date
  ORDER BY statement_date DESC
  LIMIT 1;

  -- If no previous statement found, default to 0
  IF v_opening_balance IS NULL THEN
    v_opening_balance := 0;
  END IF;

  -- Update statement totals
  UPDATE garage_statements
  SET
    opening_balance = COALESCE(v_opening_balance, 0),
    total_invoices = COALESCE(v_total_invoices, 0),
    total_payments = COALESCE(v_total_payments, 0),
    closing_balance = COALESCE(v_opening_balance, 0) + COALESCE(v_total_invoices, 0) - COALESCE(v_total_payments, 0)
  WHERE id = p_statement_id;
END;
$$;
