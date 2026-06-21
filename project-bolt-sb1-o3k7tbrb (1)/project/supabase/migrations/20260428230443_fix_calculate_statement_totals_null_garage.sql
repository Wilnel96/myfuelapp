/*
  # Fix calculate_statement_totals to include null-garage transactions

  1. Problem
     - The function uses INNER JOIN fuel_transactions ON ft.garage_id = v_statement.garage_id
     - Transactions with garage_id = NULL are excluded, causing statement totals to be
       understated (or zero) when some transactions were recorded without a garage link

  2. Fix
     - Change to LEFT JOIN and include rows where ft.garage_id IS NULL
     - This matches the same logic applied in the frontend loadStatementDetails fix
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

  -- Sum invoices whose linked transaction belongs to this garage, OR has no garage set
  SELECT COALESCE(SUM(fti.total_amount), 0)
  INTO v_total_invoices
  FROM fuel_transaction_invoices fti
  LEFT JOIN fuel_transactions ft ON fti.fuel_transaction_id = ft.id
  WHERE fti.organization_id = v_statement.organization_id
    AND (ft.garage_id = v_statement.garage_id OR ft.garage_id IS NULL)
    AND fti.transaction_date::date >= v_statement.period_start
    AND fti.transaction_date::date <= v_statement.period_end;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_payments
  FROM garage_client_payments
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
