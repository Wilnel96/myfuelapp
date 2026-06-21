/*
  # Rename "Secondary User" to "Secondary Main User"

  1. Changes
    - Updates all existing records with title 'Secondary User' to 'Secondary Main User'
    - Updates the check constraint to remove 'Secondary User' option

  2. Reason
    - Standardizing the naming convention to clarify that "Secondary Main User" has elevated permissions
    - Removing ambiguity between regular users and secondary main users

  3. Security
    - No RLS changes required
    - Maintains data integrity through check constraint
*/

-- Update any existing users with 'Secondary User' title to 'Secondary Main User'
UPDATE organization_users
SET title = 'Secondary Main User'
WHERE title = 'Secondary User';

-- Drop the old constraint
ALTER TABLE organization_users
DROP CONSTRAINT IF EXISTS organization_users_title_check;

-- Add the new constraint without 'Secondary User'
ALTER TABLE organization_users
ADD CONSTRAINT organization_users_title_check
CHECK (title IN ('Main User', 'Secondary Main User', 'Billing User', 'Fleet User', 'Driver User', 'User'));
