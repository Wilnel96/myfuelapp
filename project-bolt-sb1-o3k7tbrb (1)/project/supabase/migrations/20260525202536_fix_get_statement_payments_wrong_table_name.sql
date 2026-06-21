/*
  # Fix get_statement_payments using wrong table name

  ## Problem
  The function queries `garage_client_payments` which does not exist.
  The correct table is `garage_debtor_payments`.
  This caused the payment detail section on statement view to always be empty.
*/

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
    gdp.id,
    gdp.payment_number,
    gdp.payment_date,
    gdp.amount,
    gdp.payment_method,
    gdp.reference,
    gdp.notes
  FROM garage_debtor_payments gdp
  WHERE gdp.garage_id = p_garage_id
    AND gdp.organization_id = p_organization_id
    AND gdp.payment_date >= p_period_start
    AND gdp.payment_date <= p_period_end
  ORDER BY gdp.payment_date ASC;
END;
$$;
