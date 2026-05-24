/*
  # Fix get_statement_invoices return type mismatch

  ## Problem
  The function declared odometer_reading as NUMERIC in its RETURNS TABLE,
  but the fuel_transaction_invoices table stores odometer_reading as INTEGER.
  PostgreSQL throws "structure of query does not match function result type"
  when the types differ.

  ## Fix
  Recreate the function casting odometer_reading::numeric to match the
  declared return type. All other columns are unchanged.
*/

CREATE OR REPLACE FUNCTION public.get_statement_invoices(
  p_garage_id uuid,
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE(
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
SET search_path TO 'public'
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
    fti.odometer_reading::numeric,
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
