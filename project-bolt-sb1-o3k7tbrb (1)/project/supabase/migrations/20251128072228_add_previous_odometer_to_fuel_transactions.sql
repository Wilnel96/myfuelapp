/*
  # Add Previous Odometer Reading to Fuel Transactions

  1. Changes
    - Add `previous_odometer_reading` column to `fuel_transactions` table
    - This field stores the odometer reading from before the fuel transaction
    - Allows calculation of distance traveled and fuel efficiency metrics
  
  2. Notes
    - Column is nullable to support existing transactions without this data
    - Type is integer to match the existing odometer_reading column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'previous_odometer_reading'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN previous_odometer_reading integer;
  END IF;
END $$;
