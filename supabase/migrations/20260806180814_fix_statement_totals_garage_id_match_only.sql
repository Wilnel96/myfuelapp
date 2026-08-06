/*
# Fix calculate_statement_totals: match invoices by garage_id only (not NULL fallback)

## Problem
The previous fix still used `ft.garage_id IS NULL OR ft.id IS NULL` as a fallback
condition, which incorrectly counted invoices from other garages (or invoices with
no garage set on the fuel transaction) toward the current garage's statement.

## Fix
Only count invoices where `ft.garage_id = p_garage_id`. If the fuel_transaction
has no garage_id or doesn't exist, the invoice is NOT counted for this garage.

This matches the actual garage the fuel was purchased from. The `get_statement_invoices`
function should be updated similarly for consistency.

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
  v_prior_invoices numeric;
  v_prior_payments numeric;
BEGIN
  SELECT * INTO v_statement
  FROM garage_statements
  WHERE id = p_statement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statement not found';
  END IF;

  -- Prior invoices (before period_start) for this garage + org
  SELECT COALESCE(SUM(fti.total_amount), 0)
  INTO v_prior_invoices
  FROM fuel_transaction_invoices fti
  JOIN fuel_transactions ft ON ft.id = fti.fuel_transaction_id
  WHERE fti.organization_id = v_statement.organization_id
    AND ft.garage_id = v_statement.garage_id
    AND fti.transaction_date::date < v_statement.period_start;

  -- Prior payments (before period_start) for this garage + org
  SELECT COALESCE(SUM(amount), 0)
  INTO v_prior_payments
  FROM garage_debtor_payments
  WHERE organization_id = v_statement.organization_id
    AND garage_id = v_statement.garage_id
    AND payment_date < v_statement.period_start;

  -- Opening balance = prior invoices - prior payments (true balance at period start)
  v_opening_balance := v_prior_invoices - v_prior_payments;

  -- Total invoices in the full period (period_start to period_end)
  SELECT COALESCE(SUM(fti.total_amount), 0)
  INTO v_total_invoices
  FROM fuel_transaction_invoices fti
  JOIN fuel_transactions ft ON ft.id = fti.fuel_transaction_id
  WHERE fti.organization_id = v_statement.organization_id
    AND ft.garage_id = v_statement.garage_id
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

-- Also fix get_statement_invoices to match by garage_id only (not NULL fallback)
CREATE OR REPLACE FUNCTION public.get_statement_invoices(
  p_garage_id uuid,
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE(
  id uuid, invoice_number text, invoice_date timestamptz, transaction_date timestamptz,
  vehicle_registration text, driver_name text, fuel_type text, liters numeric,
  price_per_liter numeric, total_amount numeric, odometer_reading numeric,
  oil_type text, oil_quantity numeric, oil_unit_price numeric, oil_total_amount numeric,
  oil_brand text, fuel_transaction_id uuid, organization_id uuid, client_name text,
  client_address text, garage_vat_number text, payment_option text,
  client_vat_number text, card_last_four_digits text
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fti.id,
    fti.invoice_number,
    fti.invoice_date,
    fti.transaction_date,
    fti.vehicle_registration,
    fti.driver_name,
    fti.fuel_type,
    fti.liters,
    fti.price_per_liter,
    fti.total_amount,
    fti.odometer_reading::numeric,
    fti.oil_type,
    fti.oil_quantity,
    fti.oil_unit_price,
    fti.oil_total_amount,
    fti.oil_brand,
    fti.fuel_transaction_id,
    fti.organization_id,
    fti.client_name,
    fti.client_address,
    fti.garage_vat_number,
    fti.payment_option,
    fti.client_vat_number,
    fti.card_last_four_digits
  FROM fuel_transaction_invoices fti
  JOIN fuel_transactions ft ON ft.id = fti.fuel_transaction_id
  WHERE fti.organization_id = p_organization_id
    AND ft.garage_id = p_garage_id
    AND fti.transaction_date >= p_period_start::timestamptz
    AND fti.transaction_date < (p_period_end + INTERVAL '1 day')::timestamptz
  ORDER BY fti.transaction_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Recalculate all Shell Robertson statements
SELECT calculate_statement_totals(id) FROM garage_statements
WHERE garage_id = 'bf932c12-8ac3-4baf-9142-b794a0a021d7'
ORDER BY statement_date;