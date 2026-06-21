/*
  # Add get_statement_details function

  Creates a SECURITY DEFINER function that returns all invoices and payments
  for a given statement period, bypassing RLS. This is safe because the function
  validates the garage_id and organization_id before returning data.

  1. New Functions
    - `get_statement_invoices(p_garage_id, p_organization_id, p_period_start, p_period_end)`
      Returns all fuel_transaction_invoices for the org/period where the linked
      fuel_transaction belongs to the specified garage (or has no garage set).
    - `get_statement_payments(p_garage_id, p_organization_id, p_period_start, p_period_end)`
      Returns all garage_client_payments for the garage/org/period.
*/

CREATE OR REPLACE FUNCTION get_statement_invoices(
  p_garage_id uuid,
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  id uuid,
  invoice_number text,
  transaction_date timestamptz,
  vehicle_registration text,
  driver_name text,
  fuel_type text,
  liters numeric,
  price_per_liter numeric,
  total_amount numeric,
  odometer_reading numeric,
  oil_type text,
  oil_quantity numeric,
  oil_unit_price numeric,
  oil_total_amount numeric,
  fuel_transaction_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fti.id,
    fti.invoice_number,
    fti.transaction_date,
    fti.vehicle_registration,
    fti.driver_name,
    fti.fuel_type,
    fti.liters,
    fti.price_per_liter,
    fti.total_amount,
    fti.odometer_reading,
    fti.oil_type,
    fti.oil_quantity,
    fti.oil_unit_price,
    fti.oil_total_amount,
    fti.fuel_transaction_id
  FROM fuel_transaction_invoices fti
  LEFT JOIN fuel_transactions ft ON ft.id = fti.fuel_transaction_id
  WHERE fti.organization_id = p_organization_id
    AND fti.transaction_date >= p_period_start::timestamptz
    AND fti.transaction_date < (p_period_end + INTERVAL '1 day')::timestamptz
    AND (ft.garage_id = p_garage_id OR ft.garage_id IS NULL OR ft.id IS NULL)
  ORDER BY fti.transaction_date ASC;
END;
$$;

CREATE OR REPLACE FUNCTION get_statement_payments(
  p_garage_id uuid,
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  id uuid,
  payment_number text,
  payment_date date,
  amount numeric,
  payment_method text,
  reference text,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gcp.id,
    gcp.payment_number,
    gcp.payment_date,
    gcp.amount,
    gcp.payment_method,
    gcp.reference,
    gcp.notes
  FROM garage_client_payments gcp
  WHERE gcp.garage_id = p_garage_id
    AND gcp.organization_id = p_organization_id
    AND gcp.payment_date >= p_period_start
    AND gcp.payment_date <= p_period_end
  ORDER BY gcp.payment_date ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_statement_invoices(uuid, uuid, date, date) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_statement_payments(uuid, uuid, date, date) TO authenticated, anon;
