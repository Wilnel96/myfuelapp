/*
  # Update Oil Purchases to Unit Pricing Model
  
  1. Changes to fuel_transactions
    - Rename `oil_price_per_liter` to `oil_unit_price`
    - Update oil_type to be one of: 'Engine oil', 'Brake fluid', 'Transmission oil', 'Coolant', 'Other'
    - oil_unit_price now represents the total price paid for the oil unit (not price per liter)
    - oil_total_amount will be the same as oil_unit_price (kept for consistency)
    - oil_quantity still represents liters purchased
  
  2. Purpose
    - Simplify oil purchase entry for drivers
    - Driver enters the total price they paid without calculating per-liter cost
    - Example: 0.5L engine oil costs R65, driver just enters R65 as unit price
  
  3. Migration Steps
    - Drop existing constraint
    - Rename column
    - Update constraint to match new pricing model
    - Add check constraint for valid oil types
*/

-- Drop the existing constraint
ALTER TABLE fuel_transactions
  DROP CONSTRAINT IF EXISTS check_oil_data_consistency;

-- Rename oil_price_per_liter to oil_unit_price
ALTER TABLE fuel_transactions
  RENAME COLUMN oil_price_per_liter TO oil_unit_price;

-- Update the constraint to match new pricing model
ALTER TABLE fuel_transactions
  ADD CONSTRAINT check_oil_data_consistency 
  CHECK (
    (oil_quantity = 0 AND oil_unit_price = 0 AND oil_total_amount = 0)
    OR 
    (oil_quantity > 0 AND oil_unit_price > 0 AND oil_total_amount > 0 AND oil_type IS NOT NULL)
  );

-- Add constraint for valid oil types
ALTER TABLE fuel_transactions
  ADD CONSTRAINT check_oil_type_valid
  CHECK (
    oil_type IS NULL 
    OR oil_type IN ('Engine oil', 'Brake fluid', 'Transmission oil', 'Coolant', 'Other')
  );

-- Update column comments
COMMENT ON COLUMN fuel_transactions.oil_unit_price IS 'Total price paid for the oil unit/container (not per liter)';
COMMENT ON COLUMN fuel_transactions.oil_total_amount IS 'Same as oil_unit_price - total cost of oil purchased';
COMMENT ON COLUMN fuel_transactions.oil_type IS 'Type of oil: Engine oil, Brake fluid, Transmission oil, Coolant, or Other';
