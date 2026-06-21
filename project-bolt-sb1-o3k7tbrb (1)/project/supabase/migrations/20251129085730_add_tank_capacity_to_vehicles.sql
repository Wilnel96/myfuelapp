/*
  # Add Tank Capacity to Vehicles

  1. Changes
    - Add `tank_capacity` column to `vehicles` table
    - Column stores fuel tank capacity in gallons (numeric type)
    - Defaults to NULL (can be filled in later for existing vehicles)
    - Allows tracking of vehicle tank capacity for fuel management

  2. Notes
    - Existing vehicles will have NULL tank_capacity until updated
    - New vehicles can optionally specify tank capacity when created
*/

-- Add tank_capacity column to vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'tank_capacity'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN tank_capacity numeric(10, 2);
  END IF;
END $$;