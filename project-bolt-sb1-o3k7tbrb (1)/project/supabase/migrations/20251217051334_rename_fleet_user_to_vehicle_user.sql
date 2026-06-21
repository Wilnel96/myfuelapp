/*
  # Rename Fleet User to Vehicle User

  1. Changes
    - Update title constraint to replace 'Fleet User' with 'Vehicle User'
    - Update any existing 'Fleet User' records to 'Vehicle User'
    
  2. Valid Titles After Migration
    - Main User
    - Secondary Main User
    - Billing User
    - Driver User
    - Vehicle User (previously Fleet User)
    - User
*/

-- Update any existing 'Fleet User' records to 'Vehicle User'
UPDATE organization_users 
SET title = 'Vehicle User' 
WHERE title = 'Fleet User';

-- Drop the existing constraint
ALTER TABLE organization_users
DROP CONSTRAINT IF EXISTS organization_users_title_check;

-- Add the new constraint with 'Vehicle User' instead of 'Fleet User'
ALTER TABLE organization_users
ADD CONSTRAINT organization_users_title_check
CHECK (title IN ('Main User', 'Secondary Main User', 'Billing User', 'Driver User', 'Vehicle User', 'User'));