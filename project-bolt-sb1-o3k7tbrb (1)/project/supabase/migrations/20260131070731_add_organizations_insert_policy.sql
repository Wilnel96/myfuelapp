/*
  # Add Organizations Insert Policy

  ## Problem
  There is no INSERT policy on the organizations table, causing RLS violations when
  management organization users try to create new client organizations.

  ## Solution
  Create an INSERT policy that allows super_admin users to create new organizations.

  ## Changes
  - Add INSERT policy for organizations table
  - Allow super_admin role to insert new organizations
  - This enables management organization to create client organizations

  ## Security
  - Only users with super_admin role can create organizations
  - All other users will be denied INSERT operations
  - Maintains data isolation and security
*/

-- Create INSERT policy for organizations
CREATE POLICY "organizations_insert_policy" ON organizations
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);