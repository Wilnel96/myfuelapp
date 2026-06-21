/*
  # Add Anonymous Garage Update Policy
  
  This migration adds an UPDATE policy for anonymous users to the garages table.
  This is required because the garage portal uses a custom authentication system
  (checking contact_persons JSONB field) rather than Supabase Auth.
  
  ## Changes
  
  1. Add UPDATE policy for anonymous users on garages table
     - Allows anonymous users to update active garages
     - This enables the garage portal to save fuel prices and other information
     - Security is handled at the application layer via GarageAuth component
  
  ## Security Notes
  
  - Only active garages can be updated
  - Application-level authentication via GarageAuth ensures only authorized contacts can access the portal
  - The policy allows updates to all fields since the garage portal is already restricted
*/

-- Add UPDATE policy for anonymous users on garages table
CREATE POLICY "garages_update_anonymous" ON garages
  FOR UPDATE TO anon
  USING (status = 'active')
  WITH CHECK (status = 'active');