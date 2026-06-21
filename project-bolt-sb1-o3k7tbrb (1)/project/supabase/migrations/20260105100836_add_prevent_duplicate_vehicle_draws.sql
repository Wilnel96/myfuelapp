/*
  # Prevent Duplicate Vehicle Draws
  
  1. Changes
    - Creates a function to check if a vehicle has unreturned draws
    - Adds a trigger to prevent drawing a vehicle that's already drawn out
    - Ensures data integrity by preventing multiple simultaneous draws of the same vehicle
  
  2. Security
    - Function uses SECURITY DEFINER to check draws across all users
    - Trigger automatically enforces the rule at database level
*/

-- Function to check if vehicle has unreturned draws
CREATE OR REPLACE FUNCTION check_vehicle_not_already_drawn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check for 'draw' transactions
  IF NEW.transaction_type = 'draw' THEN
    -- Check if this vehicle has any unreturned draws
    IF EXISTS (
      SELECT 1
      FROM vehicle_transactions vt
      WHERE vt.vehicle_id = NEW.vehicle_id
        AND vt.transaction_type = 'draw'
        AND vt.related_transaction_id IS NULL
        AND vt.id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Vehicle % is already drawn out and has not been returned. Please return the vehicle before drawing it again.', 
        (SELECT registration_number FROM vehicles WHERE id = NEW.vehicle_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce this rule
DROP TRIGGER IF EXISTS prevent_duplicate_vehicle_draws ON vehicle_transactions;
CREATE TRIGGER prevent_duplicate_vehicle_draws
  BEFORE INSERT ON vehicle_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_vehicle_not_already_drawn();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_vehicle_not_already_drawn() TO authenticated, anon;
