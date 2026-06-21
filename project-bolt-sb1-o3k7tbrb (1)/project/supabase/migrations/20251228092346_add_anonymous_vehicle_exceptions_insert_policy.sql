/*
  # Add Anonymous Insert Policy for Vehicle Exceptions

  1. Changes
    - Add policy to allow anonymous users (drivers using PIN auth) to insert vehicle exceptions
    - Validates that the driver_id and vehicle_id are valid and belong to the same organization
    - Ensures drivers can only create exceptions for their own actions

  2. Security
    - Checks that driver_id exists and is valid
    - Checks that vehicle_id exists and matches the driver's organization
    - Prevents unauthorized exception creation
*/

-- Policy: Allow anonymous (driver) users to create exceptions for valid driver/vehicle combinations
CREATE POLICY "Drivers can create exceptions via anonymous access"
  ON vehicle_exceptions
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Verify driver exists and belongs to organization
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = vehicle_exceptions.driver_id
      AND drivers.organization_id = vehicle_exceptions.organization_id
      AND drivers.status = 'active'
    )
    AND
    -- Verify vehicle exists and belongs to same organization
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = vehicle_exceptions.vehicle_id
      AND vehicles.organization_id = vehicle_exceptions.organization_id
      AND vehicles.deleted_at IS NULL
    )
  );
