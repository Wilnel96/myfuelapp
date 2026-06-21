/*
  # Fix Calculate Statement Totals Function
  
  1. Changes
    - Update calculate_statement_totals function to properly filter invoices by garage_id
    - Use a JOIN with fuel_transactions table instead of relying on garage_name text matching
    - This fixes the issue where statements show no transactions even when transactions exist
  
  2. Why This Change
    - The fuel_transaction_invoices table stores garage_name as text
    - Text matching can fail due to exact match requirements
    - Joining through fuel_transactions table using garage_id is more reliable
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

  -- Get opening balance from previous statement
  SELECT COALESCE(closing_balance, 0)
  INTO v_opening_balance
  FROM garage_statements
  WHERE garage_id = v_statement.garage_id
    AND organization_id = v_statement.organization_id
    AND statement_date < v_statement.statement_date
  ORDER BY statement_date DESC
  LIMIT 1;

  -- Update statement totals
  UPDATE garage_statements
  SET
    opening_balance = v_opening_balance,
    total_invoices = v_total_invoices,
    total_payments = v_total_payments,
    closing_balance = v_opening_balance + v_total_invoices - v_total_payments
  WHERE id = p_statement_id;
END;
$$;
