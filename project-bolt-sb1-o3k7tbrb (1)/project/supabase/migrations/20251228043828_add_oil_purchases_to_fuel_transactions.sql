/*
  # Add Oil Purchases to Fuel Transactions

  1. Changes to fuel_transactions
    - Add `oil_quantity` (numeric) - Number of liters of oil purchased
    - Add `oil_price_per_liter` (numeric) - Price per liter of oil
    - Add `oil_total_amount` (numeric) - Total cost of oil (quantity × price)
    - Add `oil_type` (text) - Type of oil (e.g., "5W-30", "10W-40", "15W-40")
    - Add `oil_brand` (text) - Brand of oil purchased

  2. Purpose
    - Enable tracking of oil purchases alongside fuel transactions
    - Support comprehensive invoicing including oil purchases
    - Maintain accurate records of all vehicle maintenance expenses

  3. Notes
    - Oil fields are optional (nullable)
    - When oil is purchased, all oil fields should be populated
    - Total transaction amount should include both fuel and oil
*/

-- Add oil purchase fields to fuel_transactions
ALTER TABLE fuel_transactions
  ADD COLUMN IF NOT EXISTS oil_quantity numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oil_price_per_liter numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oil_total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oil_type text,
  ADD COLUMN IF NOT EXISTS oil_brand text;

-- Add check constraint to ensure oil data is consistent
ALTER TABLE fuel_transactions
  ADD CONSTRAINT check_oil_data_consistency 
  CHECK (
    (oil_quantity = 0 AND oil_price_per_liter = 0 AND oil_total_amount = 0)
    OR 
    (oil_quantity > 0 AND oil_price_per_liter > 0 AND oil_total_amount > 0 AND oil_type IS NOT NULL)
  );

-- Add comment for documentation
COMMENT ON COLUMN fuel_transactions.oil_quantity IS 'Number of liters of oil purchased (0 if no oil)';
COMMENT ON COLUMN fuel_transactions.oil_price_per_liter IS 'Price per liter of oil';
COMMENT ON COLUMN fuel_transactions.oil_total_amount IS 'Total cost of oil purchased (quantity × price)';
COMMENT ON COLUMN fuel_transactions.oil_type IS 'Type/grade of oil (e.g., 5W-30, 10W-40)';
COMMENT ON COLUMN fuel_transactions.oil_brand IS 'Brand of oil purchased';
