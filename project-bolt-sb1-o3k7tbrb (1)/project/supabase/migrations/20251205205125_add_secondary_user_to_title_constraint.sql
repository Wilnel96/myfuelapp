/*
  # Add 'Secondary User' to Title Constraint

  1. Changes
    - Drops the existing CHECK constraint on organization_users.title
    - Recreates the constraint to include 'Secondary User' as a valid title option
    - This allows the toggle_secondary_main_user function to properly update titles

  2. Valid Titles
    - Main User
    - Secondary User (NEW)
    - Billing User
    - Fleet User
    - Driver User
    - User
*/

-- Drop the existing constraint
ALTER TABLE organization_users 
DROP CONSTRAINT IF EXISTS organization_users_title_check;

-- Add the new constraint with 'Secondary User' included
ALTER TABLE organization_users 
ADD CONSTRAINT organization_users_title_check 
CHECK (title IN ('Main User', 'Secondary User', 'Billing User', 'Fleet User', 'Driver User', 'User'));
