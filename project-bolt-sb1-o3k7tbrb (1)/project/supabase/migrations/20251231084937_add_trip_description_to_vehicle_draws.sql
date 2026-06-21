/*
  # Add Trip Description to Vehicle Draws

  1. Changes
    - Add `trip_description` column to vehicle_transactions table for optional trip details
    - This allows drivers to describe the purpose of their trip when drawing a vehicle

  2. Notes
    - Field is optional (nullable)
    - Only applicable to 'draw' transaction types
*/

DO $$
BEGIN
  -- Add trip_description column to vehicle_transactions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_transactions' AND column_name = 'trip_description'
  ) THEN
    ALTER TABLE vehicle_transactions
    ADD COLUMN trip_description text;
  END IF;
END $$;

-- Add comment explaining the trip description field
COMMENT ON COLUMN vehicle_transactions.trip_description IS
'Optional description of the trip purpose provided by the driver when drawing a vehicle (e.g., "Delivery of parcels to Swellendam")';
