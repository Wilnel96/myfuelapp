DROP FUNCTION IF EXISTS public.get_statement_invoices(uuid, uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_statement_invoices(
  p_garage_id uuid,
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE(
  id uuid,
  invoice_number text,
  invoice_date timestamptz,
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
  oil_brand text,
  fuel_transaction_id uuid,
  organization_id uuid,
  client_name text,
  client_address text,
  garage_vat_number text
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
    fti.garage_vat_number
  FROM fuel_transaction_invoices fti
  LEFT JOIN fuel_transactions ft ON ft.id = fti.fuel_transaction_id
  WHERE fti.organization_id = p_organization_id
    AND fti.transaction_date >= p_period_start::timestamptz
    AND fti.transaction_date < (p_period_end + INTERVAL '1 day')::timestamptz
    AND (ft.garage_id = p_garage_id OR ft.garage_id IS NULL OR ft.id IS NULL)
  ORDER BY fti.transaction_date ASC;
END;
$$;
