/*
  # Allow Anonymous Read Access for Drivers

  1. Changes
    - Add policy to allow anonymous users to SELECT vehicles (needed for driver mobile app)
    - Add policy to allow anonymous users to SELECT garages (needed for driver mobile app)
    - Add policy to allow anonymous users to INSERT fuel_transactions (needed for driver mobile app)

  2. Security Notes
    - This is a temporary solution for MVP
    - In production, drivers should use proper authentication tokens
    - Consider implementing JWT-based auth for drivers in the future

  3. Important
    - Only SELECT is allowed for vehicles and garages
    - Only INSERT is allowed for fuel_transactions
    - No UPDATE or DELETE permissions for anonymous users
*/

-- Allow anonymous users to view all active vehicles
CREATE POLICY "Anonymous users can view active vehicles"
  ON vehicles
  FOR SELECT
  TO anon
  USING (status = 'active');

-- Allow anonymous users to view all active garages
CREATE POLICY "Anonymous users can view active garages"
  ON garages
  FOR SELECT
  TO anon
  USING (status = 'active');

-- Allow anonymous users to insert fuel transactions
CREATE POLICY "Anonymous users can insert fuel transactions"
  ON fuel_transactions
  FOR INSERT
  TO anon
  WITH CHECK (true);