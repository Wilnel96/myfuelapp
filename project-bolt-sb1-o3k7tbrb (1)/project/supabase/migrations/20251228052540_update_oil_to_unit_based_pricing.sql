/*
  # Update Oil Purchases to Unit-Based Pricing Model

  1. Changes to fuel_transactions
    - oil_quantity now represents NUMBER OF UNITS (e.g., 4 bottles), not liters
    - oil_unit_price represents PRICE PER UNIT (e.g., R65 per bottle)
    - oil_total_amount = oil_quantity × oil_unit_price (e.g., 4 × R65 = R260)

  2. Purpose
    - Simplify oil purchase entry for drivers
    - Driver enters number of units and price per unit
    - System automatically calculates total (no mental math required)
    - Example: 4 bottles of 0.5L engine oil at R65 each = R260 total

  3. Migration Steps
    - Update column comments to reflect new semantics
    - Update constraint to match new pricing model
*/

-- Update column comments to reflect unit-based pricing
COMMENT ON COLUMN fuel_transactions.oil_quantity IS 'Number of units purchased (e.g., 4 bottles), not liters';
COMMENT ON COLUMN fuel_transactions.oil_unit_price IS 'Price per unit/bottle (e.g., R65 per 0.5L bottle)';
COMMENT ON COLUMN fuel_transactions.oil_total_amount IS 'Total cost of oil: quantity × unit_price (e.g., 4 × R65 = R260)';
COMMENT ON COLUMN fuel_transactions.oil_type IS 'Type of oil: Engine oil, Brake fluid, Transmission oil, Coolant, or Other';
COMMENT ON COLUMN fuel_transactions.oil_brand IS 'Brand of oil purchased (e.g., Castrol, Mobil, Shell) - optional';

-- Drop the existing constraint
ALTER TABLE fuel_transactions
  DROP CONSTRAINT IF EXISTS check_oil_data_consistency;

-- Update the constraint to match unit-based pricing model
-- Total should equal quantity × unit_price
ALTER TABLE fuel_transactions
  ADD CONSTRAINT check_oil_data_consistency
  CHECK (
    (oil_quantity = 0 AND oil_unit_price = 0 AND oil_total_amount = 0)
    OR
    (oil_quantity > 0 AND oil_unit_price > 0 AND oil_total_amount > 0 AND oil_type IS NOT NULL
     AND oil_total_amount = oil_quantity * oil_unit_price)
  );
