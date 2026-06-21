/*
  # Add Anonymous SELECT Policy for Drivers

  1. Changes
    - Add policy to allow anonymous users (drivers using PIN auth) to SELECT from drivers table
    - This is required for vehicle_exceptions insert policy to validate driver_id
    - Limits access to active drivers only

  2. Security
    - Anonymous users can only view active drivers (status = 'active')
    - This allows PIN authentication and validation in WITH CHECK clauses
*/

-- Allow anonymous users to view active drivers
CREATE POLICY "Anonymous users can view active drivers"
  ON drivers
  FOR SELECT
  TO anon
  USING (status = 'active');
