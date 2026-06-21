/*
  # Fix Garage Payment Insert Policy

  1. Problem
    - Authenticated garages cannot insert payments because the policy requires x-garage-password header
    - The header is not being sent from the frontend
    - This prevents garages from capturing payments through the portal

  2. Solution
    - Remove the password header requirement for INSERT operations
    - Allow garages to insert payments for their own garage_id based on their garage organization association
    - Keep anonymous INSERT policy for public garage interfaces

  3. Security
    - Garages can only insert payments for their own garage_id
    - Verified through organization_users table linking the authenticated user to the garage's organization
*/

-- Drop the old authenticated garage insert policy
DROP POLICY IF EXISTS "Garage can insert own payments" ON garage_client_payments;

-- Create new policy that allows garages to insert payments for their own garage
CREATE POLICY "Garage can insert own payments"
  ON garage_client_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be associated with the garage's organization as a garage user
    EXISTS (
      SELECT 1 
      FROM garages g
      JOIN organizations o ON g.id::uuid = o.id::uuid
      JOIN organization_users ou ON ou.organization_id = o.id
      WHERE g.id = garage_client_payments.garage_id
        AND ou.user_id = auth.uid()
        AND ou.is_active = true
    )
  );
