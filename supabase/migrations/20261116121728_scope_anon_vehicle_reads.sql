/*
  # Scope vehicle reads for the driver app

  1. Problem
     - `anon_read_vehicles` was `USING (true)` and `vehicles_anon_active_select` only
       excluded deleted rows, so the public key exposed every organization's fleet.

  2. Changes
     - Remove the always-true policy and bind the anon read to the driver session's
       organization.
*/

DROP POLICY IF EXISTS anon_read_vehicles ON vehicles;
DROP POLICY IF EXISTS vehicles_anon_active_select ON vehicles;

CREATE POLICY vehicles_anon_active_select ON vehicles
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND organization_id = current_driver_org_id());
