/*
  # Add INSERT policy for EFT batch items

  1. Changes
    - Add INSERT policy for eft_batch_items table to allow authenticated users to create batch items
    - Policy checks that the batch belongs to the user's organization
  
  2. Security
    - Users can only insert batch items for batches in their organization
*/

CREATE POLICY "Users can insert EFT batch items"
  ON eft_batch_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    batch_id IN (
      SELECT daily_eft_batches.id
      FROM daily_eft_batches
      WHERE daily_eft_batches.organization_id IN (
        SELECT profiles.organization_id
        FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );