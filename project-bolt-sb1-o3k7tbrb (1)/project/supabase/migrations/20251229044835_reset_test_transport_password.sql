/*
  # Reset Test Transport Admin Password

  1. Changes
    - Update password for Test Transport admin user
    - Password will be set to: TestTransport2024!

  2. Security
    - This is a one-time password reset for a test account
    - User can change password after logging in
*/

-- Note: This requires manual password reset through Supabase Auth Admin API
-- The password reset needs to be done through the Supabase dashboard or admin API
-- This migration serves as documentation of the intended action

-- Update the organization_users table password field for reference
UPDATE organization_users
SET password = 'TestTransport2024!'
WHERE email = 'admin@test-transport.co.za';

-- For actual auth password update, use Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Find user: admin@test-transport.co.za
-- 3. Click "..." menu > "Reset Password"
-- 4. Set password to: TestTransport2024!
