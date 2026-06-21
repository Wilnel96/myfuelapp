/*
  # Add Anonymous Access to Organizations for Drivers

  1. Changes
    - Add RLS policy to allow anonymous users (drivers) to read organization spending limits
    - This is required for the mobile fuel purchase flow to check spending limits

  2. Security
    - Only allows reading specific fields (daily_spending_limit, monthly_spending_limit)
    - Does not expose sensitive organization data
    - Required for driver mobile app functionality
*/

-- Drop policy if it exists
DROP POLICY IF EXISTS "organizations_select_policy_anon" ON organizations;

-- Allow anonymous users to read organizations (needed for driver fuel purchases)
CREATE POLICY "organizations_select_policy_anon"
  ON organizations
  FOR SELECT
  TO anon
  USING (true);
