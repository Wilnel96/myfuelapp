/*
  Migrate any payments that were recorded in the old garage_client_payments table
  into the correct garage_debtor_payments table, avoiding duplicates.
  
  Also recalculates all affected statements so their totals reflect the correct data.
*/

-- Insert any garage_client_payments records that don't already exist in garage_debtor_payments
-- (match on garage_id + organization_id + payment_date + amount + payment_method to detect dupes)
INSERT INTO garage_debtor_payments (
  garage_id,
  organization_id,
  payment_number,
  payment_date,
  amount,
  payment_method,
  reference,
  notes,
  created_at
)
SELECT
  gcp.garage_id,
  gcp.organization_id,
  -- Prefix old payment numbers to avoid collision
  'MIGRATED-' || gcp.payment_number,
  gcp.payment_date,
  gcp.amount,
  gcp.payment_method,
  COALESCE(gcp.reference, 'Migrated from legacy payment record'),
  gcp.notes,
  gcp.created_at
FROM garage_client_payments gcp
WHERE NOT EXISTS (
  SELECT 1 FROM garage_debtor_payments gdp
  WHERE gdp.garage_id = gcp.garage_id
    AND gdp.organization_id = gcp.organization_id
    AND gdp.payment_date = gcp.payment_date
    AND gdp.amount = gcp.amount
    AND gdp.payment_method = gcp.payment_method
);

-- Recalculate all affected statements so their stored totals are fresh
DO $$
DECLARE
  stmt_rec record;
BEGIN
  FOR stmt_rec IN
    SELECT DISTINCT gs.id
    FROM garage_statements gs
    JOIN garage_debtor_payments gdp
      ON gdp.garage_id = gs.garage_id
     AND gdp.organization_id = gs.organization_id
     AND gdp.payment_date >= gs.period_start
     AND gdp.payment_date <= gs.period_end
    WHERE gs.total_payments != (
      SELECT COALESCE(SUM(gdp2.amount), 0)
      FROM garage_debtor_payments gdp2
      WHERE gdp2.garage_id = gs.garage_id
        AND gdp2.organization_id = gs.organization_id
        AND gdp2.payment_date >= gs.period_start
        AND gdp2.payment_date <= gs.period_end
    )
  LOOP
    PERFORM calculate_statement_totals(stmt_rec.id);
  END LOOP;
END;
$$;
