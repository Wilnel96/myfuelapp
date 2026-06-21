/*
  # Allow Users to View Their Own Organization Users Record

  1. Problem
    - Users cannot see their own organization_users record during login
    - The can_view_organization_users function is too restrictive
    - Login fails because the query returns no results

  2. Solution
    - Add a simple policy that allows users to view their own record
    - This is a basic security requirement for authentication flows

  3. Security
    - Users can only see records where user_id = auth.uid()
    - This is safe and necessary for login functionality
*/

-- Add policy to allow users to see their own organization_users record
CREATE POLICY "Users can view their own organization_users record"
  ON organization_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
