/*
  # Add INSERT policy for organizations table

  1. Changes
    - Add policy to allow authenticated users to insert organizations during signup

  2. Security
    - Users can insert organizations (needed for signup flow)
    - Users can view their own organization
*/

-- Allow authenticated users to insert organizations
CREATE POLICY "Users can insert organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);
