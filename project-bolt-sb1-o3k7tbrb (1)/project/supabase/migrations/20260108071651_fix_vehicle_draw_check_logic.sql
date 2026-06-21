/*
  # Fix Vehicle Draw Check Logic
  
  1. Changes
    - Fixes the trigger function to properly check if a vehicle has unreturned draws
    - Previously checked if draw had related_transaction_id IS NULL (always true for draws)
    - Now properly checks if a return transaction exists for the draw
  
  2. Security
    - Maintains SECURITY DEFINER for cross-user checks
*/

-- Fix the function to properly check for unreturned draws
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
    -- A draw is unreturned if no return transaction references it
    IF EXISTS (
      SELECT 1
      FROM vehicle_transactions vt_draw
      WHERE vt_draw.vehicle_id = NEW.vehicle_id
        AND vt_draw.transaction_type = 'draw'
        AND vt_draw.id != NEW.id
        AND NOT EXISTS (
          SELECT 1
          FROM vehicle_transactions vt_return
          WHERE vt_return.related_transaction_id = vt_draw.id
            AND vt_return.transaction_type = 'return'
        )
    ) THEN
      RAISE EXCEPTION 'Vehicle % is already drawn out and has not been returned. Please return the vehicle before drawing it again.', 
        (SELECT registration_number FROM vehicles WHERE id = NEW.vehicle_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
