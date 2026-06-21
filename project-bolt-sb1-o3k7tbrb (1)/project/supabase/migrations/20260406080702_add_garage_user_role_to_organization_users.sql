/*
  # Add 'garage_user' role to organization_users table

  1. Problem
    - Garage users need to be stored in organization_users table with role='garage_user'
    - Current constraint only allows: 'main_user', 'secondary_main_user', 'user'
    - This prevents creating garage users

  2. Solution
    - Update the check constraint to include 'garage_user' role
    - This allows garage authentication to work properly

  3. Security
    - Garage users will be identified by role='garage_user' in organization_users
    - They will have access to garage portal through RLS policies
*/

-- Drop the existing constraint
ALTER TABLE organization_users DROP CONSTRAINT IF EXISTS organization_users_role_check;

-- Add new constraint with garage_user included
ALTER TABLE organization_users ADD CONSTRAINT organization_users_role_check 
  CHECK (role IN ('main_user', 'secondary_main_user', 'user', 'garage_user', 'vehicle_user'));

-- Add comment
COMMENT ON COLUMN organization_users.role IS 'User role within the organization. Options: main_user (primary account holder), secondary_main_user (secondary account holder), user (regular user), garage_user (garage portal user), vehicle_user (fleet manager)';
