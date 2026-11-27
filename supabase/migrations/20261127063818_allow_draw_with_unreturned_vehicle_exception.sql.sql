/*
  # Allow drawing a vehicle with an unreturned previous draw (log exception + email)

  1. Behaviour change
    - Previously the trigger `check_vehicle_not_already_drawn` BLOCKED any draw
      when the vehicle had a draw with no matching return. The driver UI offers a
      "continue anyway" path that closes the previous draw and logs a
      "not_returned_by_previous_driver" exception, but the trigger made it
      impossible to reach for a second driver.

  2. Modified function
    - `check_vehicle_not_already_drawn()` no longer raises. The duplicate-draw
      prevention remains the frontend responsibility (per-driver checks) plus
      the application flow that closes the previous draw before inserting.

  3. Security
    - No grant or policy changes. Trigger still runs as definer.
*/

CREATE OR REPLACE FUNCTION public.check_vehicle_not_already_drawn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;