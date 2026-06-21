/*
  # Reset Shell Robertson Password

  1. Changes
    - Reset password for shell.robertson@test.com to Test1234!
    - Use auth.users table direct update

  2. Security
    - This is a one-time administrative action
    - Password will be hashed by Supabase
*/

-- Reset password using Supabase's crypt function
UPDATE auth.users
SET 
  encrypted_password = crypt('Test1234!', gen_salt('bf')),
  updated_at = now()
WHERE email = 'shell.robertson@test.com';
