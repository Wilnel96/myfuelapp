/*
  # Allow anonymous reads on global_settings

  The client self-signup form needs to pre-populate the standard monthly fees
  (monthly_fee_per_vehicle, monthly_fee_per_driver) without a session.
  Adding a SELECT policy for the anon role so those values are readable publicly.
  Write access remains restricted to super_admins only.
*/

CREATE POLICY "Anyone can read global settings"
  ON global_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);
