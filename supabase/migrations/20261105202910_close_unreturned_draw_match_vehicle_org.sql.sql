/*
# Close unreturned vehicle draw: match by vehicle organization

1. Modified Functions
- `close_unreturned_vehicle_draw(p_vehicle_id, p_odometer)` now checks that the vehicle belongs to the signed-in driver's organization, instead of requiring the previous draw to be recorded under that same organization.
- It then closes the most recent open draw on that vehicle, whichever organization recorded it. This matches the draw-blocking rule, which already ignores organization.

2. Security
- Still a SECURITY DEFINER function that requires a valid driver session.
- Still executable only by anon, authenticated and service_role (unchanged grants).

3. Notes
- If the vehicle does not belong to the driver's organization, the function raises an error instead of silently doing nothing.
- If there is no open draw, the function still returns NULL and the new draw proceeds.
*/

CREATE OR REPLACE FUNCTION public.close_unreturned_vehicle_draw(p_vehicle_id uuid, p_odometer integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := current_driver_org_id();
  v_draw vehicle_transactions%ROWTYPE;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Driver session is not valid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = p_vehicle_id AND v.organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'Vehicle does not belong to this organization';
  END IF;

  SELECT * INTO v_draw
  FROM vehicle_transactions vt
  WHERE vt.vehicle_id = p_vehicle_id
    AND vt.transaction_type = 'draw'
    AND NOT EXISTS (
      SELECT 1 FROM vehicle_transactions r
      WHERE r.related_transaction_id = vt.id
        AND r.transaction_type = 'return'
    )
  ORDER BY vt.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO vehicle_transactions (
    organization_id, vehicle_id, driver_id, transaction_type,
    odometer_reading, location, related_transaction_id
  ) VALUES (
    v_draw.organization_id, v_draw.vehicle_id, v_draw.driver_id, 'return',
    p_odometer, 'Auto-closed', v_draw.id
  );

  RETURN v_draw.id;
END;
$$;
