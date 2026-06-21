/*
  # Rename Gallons to Liters

  1. Changes
    - Rename `gallons` column to `liters` in `fuel_transactions` table
    - Rename `price_per_gallon` column to `price_per_liter` in `fuel_transactions` table
    - Update all references to use liters instead of gallons
    
  2. Notes
    - South Africa uses the metric system (liters)
    - Existing data values remain the same (assumes data is already in liters)
    - Column data types remain unchanged (numeric)
*/

-- Rename gallons to liters
ALTER TABLE fuel_transactions 
RENAME COLUMN gallons TO liters;

-- Rename price_per_gallon to price_per_liter
ALTER TABLE fuel_transactions 
RENAME COLUMN price_per_gallon TO price_per_liter;