/*
  # Add Oil Purchase Columns to Fuel Transaction Invoices

  1. Changes to fuel_transaction_invoices
    - Add `oil_quantity` (numeric) - Number of units purchased
    - Add `oil_unit_price` (numeric) - Price per unit/bottle
    - Add `oil_total_amount` (numeric) - Total cost of oil (quantity × unit_price)
    - Add `oil_type` (text) - Type of oil
    - Add `oil_brand` (text) - Brand of oil purchased

  2. Purpose
    - Store oil purchase information in fuel transaction invoices
    - Enable proper display of oil purchases in invoice views
    - Maintain historical record of all transaction components

  3. Notes
    - Oil fields are optional (nullable)
    - When oil is purchased, these fields store the oil data from fuel_transactions
    - This ensures invoice data is preserved even if transaction is modified
*/

-- Add oil purchase columns to fuel_transaction_invoices
ALTER TABLE fuel_transaction_invoices
  ADD COLUMN IF NOT EXISTS oil_quantity numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oil_unit_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oil_total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oil_type text,
  ADD COLUMN IF NOT EXISTS oil_brand text;

-- Add column comments for documentation
COMMENT ON COLUMN fuel_transaction_invoices.oil_quantity IS 'Number of units purchased (e.g., 4 bottles)';
COMMENT ON COLUMN fuel_transaction_invoices.oil_unit_price IS 'Price per unit/bottle';
COMMENT ON COLUMN fuel_transaction_invoices.oil_total_amount IS 'Total cost of oil: quantity × unit_price';
COMMENT ON COLUMN fuel_transaction_invoices.oil_type IS 'Type of oil purchased';
COMMENT ON COLUMN fuel_transaction_invoices.oil_brand IS 'Brand of oil purchased';
