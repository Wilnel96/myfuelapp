/*
# Close unreturned vehicle draw for a driver session

1. Purpose
- When a new driver draws a vehicle that the previous driver never returned, the
  previous draw must be closed with a Return Vehicle before the new draw is saved.
- Driver sessions use the anonymous database role, whose insert policy only allows
  rows for the signed-in driver. The return belongs to the previous driver, so the
  insert was rejected. This function performs the close with elevated rights after
  validating the caller's driver session.

2. New function
- `close_unreturned_vehicle_draw(p_vehicle_id uuid, p_odometer integer) RETURNS uuid`
  - Requires a valid driver session (resolved from the x-driver-token header).
  - Finds the latest draw of the vehicle in the caller's organization that has no
    return. If none exists, returns NULL and changes nothing.
  - Inserts a return transaction for the previous driver linked to that draw, with
    location "Auto-closed" and the supplied odometer.
  - Returns the id of the draw that was closed.

3. Security
- SECURITY DEFINER with a fixed search_path.
- Organization is taken from the driver session, never from the client.
- EXECUTE is revoked from PUBLIC and granted only to anon (driver sessions),
  authenticated, and service_role.

4. Notes
- Idempotent: safe to re-apply (CREATE OR REPLACE and re-grants).
- No existing data is modified.
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

  SELECT * INTO v_draw
  FROM vehicle_transactions vt
  WHERE vt.vehicle_id = p_vehicle_id
    AND vt.organization_id = v_org
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

REVOKE EXECUTE ON FUNCTION public.close_unreturned_vehicle_draw(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_unreturned_vehicle_draw(uuid, integer) TO anon, authenticated, service_role;
