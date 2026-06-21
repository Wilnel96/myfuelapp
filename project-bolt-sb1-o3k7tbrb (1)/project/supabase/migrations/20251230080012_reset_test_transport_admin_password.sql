/*
  # Reset Test Transport Admin Password
  
  1. Changes
    - Reset password for admin@test-transport.co.za to "TestTransport2024!"
    - This is a one-time password reset for testing purposes
*/

-- Reset the password for Test Transport admin user
-- The password will be hashed automatically by Supabase Auth
-- Password: TestTransport2024!
UPDATE auth.users
SET 
  encrypted_password = crypt('TestTransport2024!', gen_salt('bf')),
  updated_at = now()
WHERE email = 'admin@test-transport.co.za';

-- Also update the password in organization_users table for reference
UPDATE organization_users
SET password = 'TestTransport2024!'
WHERE email = 'admin@test-transport.co.za';
