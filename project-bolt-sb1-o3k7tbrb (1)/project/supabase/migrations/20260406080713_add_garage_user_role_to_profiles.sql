/*
  # Add 'garage_user' role to profiles table

  1. Problem
    - Garage users need to be stored in profiles table with role='garage_user'
    - Current constraint only allows: 'super_admin', 'admin', 'manager', 'user'
    - This prevents creating garage user profiles

  2. Solution
    - Update the check constraint to include 'garage_user' role
    - This allows garage user profiles to be created

  3. Security
    - Garage users will be identified by role='garage_user' in profiles
    - They will be routed to garage portal based on this role
*/

-- Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with garage_user included
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'manager', 'user', 'garage_user', 'client_user', 'vehicle_user'));

-- Add comment
COMMENT ON COLUMN profiles.role IS 'User role in the system. Options: super_admin (MyFuelApp admin), admin (organization admin), manager (organization manager), user (regular user), garage_user (garage portal user), client_user (client organization user), vehicle_user (fleet manager)';
