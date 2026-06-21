/*
  # Add UPDATE policy for garages table

  1. Changes
    - Add UPDATE policy to allow users to update garages in their organization
  
  2. Security
    - Users can only update garages that belong to their organization
    - Policy checks organization_id matches user's organization_id
*/

CREATE POLICY "Users can update garages in their organization"
  ON garages
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
