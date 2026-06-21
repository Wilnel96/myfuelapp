/*
  # Add Invoice Integrity Monitoring System

  1. New Functions
    - `check_fuel_transaction_invoice_integrity()` - Returns fuel transactions without invoices
    - `get_invoice_integrity_stats()` - Returns statistics about invoice generation

  2. New Views
    - `invoice_integrity_check` - View showing all transactions missing invoices

  3. Purpose
    - Enable monitoring of invoice generation failures
    - Provide quick visibility into missing invoices
    - Support automated integrity checks
*/

-- Function to get all fuel transactions without invoices
CREATE OR REPLACE FUNCTION check_fuel_transaction_invoice_integrity()
RETURNS TABLE (
  transaction_id uuid,
  transaction_date timestamptz,
  organization_id uuid,
  organization_name text,
  vehicle_id uuid,
  registration_number text,
  garage_id uuid,
  garage_name text,
  total_amount numeric,
  hours_since_transaction numeric
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ft.id,
    ft.transaction_date,
    ft.organization_id,
    o.name as organization_name,
    ft.vehicle_id,
    v.registration_number,
    ft.garage_id,
    g.name as garage_name,
    ft.total_amount,
    EXTRACT(EPOCH FROM (NOW() - ft.transaction_date)) / 3600 as hours_since_transaction
  FROM fuel_transactions ft
  LEFT JOIN organizations o ON ft.organization_id = o.id
  LEFT JOIN vehicles v ON ft.vehicle_id = v.id
  LEFT JOIN garages g ON ft.garage_id = g.id
  WHERE ft.invoice_id IS NULL
  ORDER BY ft.transaction_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get invoice integrity statistics
CREATE OR REPLACE FUNCTION get_invoice_integrity_stats()
RETURNS TABLE (
  total_transactions bigint,
  transactions_with_invoices bigint,
  transactions_without_invoices bigint,
  invoice_success_rate numeric,
  oldest_missing_invoice_date timestamptz,
  newest_missing_invoice_date timestamptz
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_transactions,
    COUNT(invoice_id)::bigint as transactions_with_invoices,
    (COUNT(*) - COUNT(invoice_id))::bigint as transactions_without_invoices,
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(invoice_id)::numeric / COUNT(*)::numeric) * 100, 2)
    END as invoice_success_rate,
    MIN(CASE WHEN invoice_id IS NULL THEN transaction_date END) as oldest_missing_invoice_date,
    MAX(CASE WHEN invoice_id IS NULL THEN transaction_date END) as newest_missing_invoice_date
  FROM fuel_transactions;
END;
$$ LANGUAGE plpgsql;

-- Create view for easy monitoring
CREATE OR REPLACE VIEW invoice_integrity_check AS
SELECT 
  ft.id as transaction_id,
  ft.transaction_date,
  ft.created_at,
  o.name as organization_name,
  v.registration_number,
  g.name as garage_name,
  ft.total_amount,
  EXTRACT(EPOCH FROM (NOW() - ft.transaction_date)) / 3600 as hours_since_transaction,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - ft.transaction_date)) / 3600 < 1 THEN 'Recent'
    WHEN EXTRACT(EPOCH FROM (NOW() - ft.transaction_date)) / 3600 < 24 THEN 'Warning'
    ELSE 'Critical'
  END as urgency
FROM fuel_transactions ft
LEFT JOIN organizations o ON ft.organization_id = o.id
LEFT JOIN vehicles v ON ft.vehicle_id = v.id
LEFT JOIN garages g ON ft.garage_id = g.id
WHERE ft.invoice_id IS NULL
ORDER BY ft.transaction_date DESC;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION check_fuel_transaction_invoice_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION get_invoice_integrity_stats() TO authenticated;
GRANT SELECT ON invoice_integrity_check TO authenticated;

-- Add indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_invoice_check 
ON fuel_transactions(invoice_id, transaction_date) 
WHERE invoice_id IS NULL;
