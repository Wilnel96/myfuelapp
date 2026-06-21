/*
  # Fix Vehicle Draw Check to Allow Multiple Refuels
  
  1. Changes
    - Update `check_vehicle_drawn_by_driver` function to properly check if vehicle is currently drawn
    - A vehicle is considered drawn if there's a draw transaction WITHOUT a corresponding return transaction
    - This allows drivers to refuel multiple times during a long haul while the vehicle is still drawn
    
  2. Logic
    - Find the most recent draw transaction for the vehicle and driver
    - Check if there's NO return transaction that references this draw
    - If no return exists, the vehicle is still drawn and refueling is allowed
    
  3. Security
    - Function remains SECURITY DEFINER for edge function access
    - Proper permission grants maintained
*/

-- Updated function to check if a vehicle is currently drawn by a specific driver
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
  v_latest_draw_id uuid;
  v_has_return boolean;
BEGIN
  -- Find the most recent draw transaction for this vehicle and driver
  SELECT id INTO v_latest_draw_id
  FROM vehicle_transactions
  WHERE vehicle_id = p_vehicle_id
  AND driver_id = p_driver_id
  AND transaction_type = 'draw'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no draw found, return false
  IF v_latest_draw_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if there's a return transaction that references this draw
  SELECT EXISTS (
    SELECT 1
    FROM vehicle_transactions
    WHERE related_transaction_id = v_latest_draw_id
    AND transaction_type = 'return'
  ) INTO v_has_return;
  
  -- Vehicle is drawn if there's no return transaction
  RETURN NOT v_has_return;
END;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION check_vehicle_drawn_by_driver(uuid, uuid) TO authenticated, anon, service_role;
