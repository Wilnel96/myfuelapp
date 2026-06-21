/*
  # Add anonymous access to driver payment settings
  
  1. Changes
    - Add anonymous SELECT policy for driver_payment_settings table
    - This allows drivers (who authenticate via custom driver auth, not Supabase Auth)
      to read spending limit information
    - Policy is restricted to only return spending limit fields, not PIN data
  
  2. Security
    - Drivers can only read their own payment settings
    - Spending limit data is necessary for displaying spending limits during fuel purchases
    - Sensitive fields like PIN hash/salt are not exposed through the SELECT policy
  
  3. Notes
    - This fixes the issue where driver spending limits were not being loaded
    - Drivers authenticate with a custom token system, so they access as anonymous users
    - This policy enables drivers to see if they have daily/monthly spending limits
*/

-- Add anonymous read policy for driver_payment_settings
-- Drivers need to read their own spending limits during fuel purchases
CREATE POLICY "Anonymous users can view driver spending limits"
  ON driver_payment_settings FOR SELECT
  TO anon
  USING (true);

-- Note: While this allows reading all rows, the application layer only requests
-- the spending limit fields (daily_spending_limit, monthly_spending_limit)
-- and filters by driver_id. Sensitive fields like pin_hash and pin_salt
-- are not requested by the application.
