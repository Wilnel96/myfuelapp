-- Reset password for TotalEnergies Route 62 garage user (totalr62@gmail.com)
-- Temporary password: TotalR62!2024
UPDATE auth.users
SET
  encrypted_password = crypt('TotalR62!2024', gen_salt('bf')),
  updated_at = now()
WHERE email = 'totalr62@gmail.com';