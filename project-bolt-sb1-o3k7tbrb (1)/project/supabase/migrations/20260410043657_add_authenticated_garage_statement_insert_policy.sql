/*
  # Add RLS policy for authenticated garage users to insert statements

  1. Changes
    - Add INSERT policy for authenticated garage users to create statements for their own garage
    - Allows garage users who are logged in via Supabase Auth to create statements
    - Verifies the user is a garage_user and belongs to the garage they're creating statements for

  2. Security
    - Policy checks that the user has role='garage_user' in organization_users table
    - Policy verifies the organization_id matches the garage's organization_id
    - This ensures garage users can only create statements for their own garage
*/

-- Allow authenticated garage users to insert statements for their own garage
CREATE POLICY "Authenticated garage users can insert own statements"
  ON garage_statements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      INNER JOIN garages g ON g.organization_id = ou.organization_id
      WHERE ou.user_id = auth.uid()
      AND ou.role = 'garage_user'
      AND g.id = garage_statements.garage_id
      AND ou.is_active = true
    )
  );
