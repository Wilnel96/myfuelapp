/*
  # Fix Fuel Transactions Driver Foreign Key

  1. Changes
    - Make driver_id nullable temporarily
    - Drop the incorrect foreign key constraint that points driver_id to profiles.id
    - Add correct foreign key constraint that points driver_id to drivers.id
    - Set existing invalid driver_id values to NULL

  2. Security
    - Maintains referential integrity with correct driver table
    - Preserves existing transaction data
*/

-- First, make driver_id nullable
ALTER TABLE fuel_transactions 
  ALTER COLUMN driver_id DROP NOT NULL;

-- Drop the incorrect foreign key constraint
ALTER TABLE fuel_transactions 
  DROP CONSTRAINT IF EXISTS fuel_transactions_driver_id_fkey;

-- Set invalid driver_id values to NULL (those that reference profiles instead of drivers)
UPDATE fuel_transactions 
SET driver_id = NULL 
WHERE driver_id NOT IN (SELECT id FROM drivers);

-- Add the correct foreign key constraint pointing to drivers table
ALTER TABLE fuel_transactions
  ADD CONSTRAINT fuel_transactions_driver_id_fkey 
  FOREIGN KEY (driver_id) 
  REFERENCES drivers(id)
  ON DELETE SET NULL;