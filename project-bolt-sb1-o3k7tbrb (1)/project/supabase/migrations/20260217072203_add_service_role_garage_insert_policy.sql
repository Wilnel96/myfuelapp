/*
  # Add Service Role INSERT Policy for Garage Import
  
  1. Purpose
    - Allows service_role to bulk import garages
    - Enables running garage import scripts with service role key
    
  2. Security
    - Only service_role can use this policy
    - Does not affect existing authenticated user policies
*/

-- Add policy to allow service_role to insert garages
CREATE POLICY "Service role can insert garages"
  ON garages
  FOR INSERT
  TO service_role
  WITH CHECK (true);
