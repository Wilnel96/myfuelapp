/*
  # Fix Driver Mobile App Vehicle Access
  
  1. Changes
    - Add anon SELECT policy for vehicles table to allow driver mobile app to load vehicles
    - Add anon SELECT policy for garages table to allow driver mobile app to load garages
  
  2. Security
    - Anon users can only SELECT (read) vehicles and garages
    - No insert, update, or delete permissions for anon users
    - This is safe because drivers need to view vehicles to select them for fuel purchases
*/

-- Drop existing anon policies if they exist
DROP POLICY IF EXISTS "anon_read_vehicles" ON vehicles;
DROP POLICY IF EXISTS "anon_read_garages" ON garages;

-- Allow anonymous users to read vehicles (for driver mobile app)
CREATE POLICY "anon_read_vehicles"
  ON vehicles
  FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to read garages (for driver mobile app)
CREATE POLICY "anon_read_garages"
  ON garages
  FOR SELECT
  TO anon
  USING (true);
