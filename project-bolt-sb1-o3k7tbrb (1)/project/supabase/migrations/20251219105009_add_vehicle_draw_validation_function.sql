/*
  # Add Vehicle Draw Validation Function

  1. New Functions
    - `check_vehicle_drawn_by_driver(vehicle_id, driver_id)` - Returns true if the vehicle is currently drawn by the driver
    
  2. Purpose
    - Used to validate that a driver has drawn a vehicle before they can refuel it
    - Checks for an active draw (no related return transaction)
    
  3. Security
    - Function is SECURITY DEFINER to allow edge functions to call it
    - Only checks active draws (where related_transaction_id IS NULL)
*/

-- Function to check if a vehicle is currently drawn by a specific driver
CREATE OR REPLACE FUNCTION check_vehicle_drawn_by_driver(
  p_vehicle_id uuid,
  p_driver_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_active_draw boolean;
BEGIN
  -- Check if there's an active draw (no return transaction linked)
  SELECT EXISTS (
    SELECT 1
    FROM vehicle_transactions
    WHERE vehicle_id = p_vehicle_id
    AND driver_id = p_driver_id
    AND transaction_type = 'draw'
    AND related_transaction_id IS NULL
  ) INTO v_has_active_draw;
  
  RETURN v_has_active_draw;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION check_vehicle_drawn_by_driver(uuid, uuid) TO authenticated, anon, service_role;
