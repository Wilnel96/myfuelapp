/*
  # Add 'Garage Administrator' title to organization_users

  1. Problem
    - Garage users need title='Garage Administrator'
    - Current constraint only allows specific titles
    - This prevents setting proper garage user titles

  2. Solution
    - Update the check constraint to include 'Garage Administrator'
*/

-- Drop the existing constraint
ALTER TABLE organization_users DROP CONSTRAINT IF EXISTS organization_users_title_check;

-- Add new constraint with Garage Administrator included
ALTER TABLE organization_users ADD CONSTRAINT organization_users_title_check 
  CHECK (title IN ('Main User', 'Secondary Main User', 'Billing User', 'Driver User', 'Vehicle User', 'User', 'Garage Administrator'));
