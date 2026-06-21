/*
  # Fix User Type as Optional Classification Field

  ## Overview
  This migration corrects the user_type field to be an optional supplementary classification
  rather than replacing the existing title/role system.

  ## Role Structure Clarification

  ### Management Organization (is_management_org = true)
  - Uses `profiles.role` with values: 'super_admin', 'admin', 'manager', 'user'
  - NO 'driver' role in management org

  ### Client Organizations (is_management_org = false)
  - Main account holder: `is_main_user = true` in organization_users
  - Secondary main user: `is_secondary_main_user = true` in organization_users
  - Other users: Classified by `title` field and granular permissions
  - **user_type** is OPTIONAL additional classification for reporting/analytics

  ## User Titles (Primary Classification)
  - 'Main User' - Primary account owner (is_main_user = true)
  - 'Secondary Main User' - Secondary owner (is_secondary_main_user = true)
  - 'Billing User' - Handles billing and invoices
  - 'Driver User' - Manages drivers
  - 'Vehicle User' - Can view/manage vehicles
  - 'User' - Standard access
  - Custom titles allowed

  ## User Types (Optional Supplementary Classification)
  - Used for reporting, analytics, and additional categorization
  - Does NOT replace or override title
  - Can be null or empty
  - Examples: 'billing_user', 'fleet_user', 'driver_user', 'vehicle_user', etc.

  ## Changes
  1. Make user_type nullable (optional)
  2. Remove CHECK constraint on user_type to allow custom values
  3. Update comments to clarify user_type is supplementary
  4. Keep all existing title/role logic intact
*/

-- Make user_type nullable and remove strict constraint
ALTER TABLE organization_users 
ALTER COLUMN user_type DROP NOT NULL,
ALTER COLUMN user_type DROP DEFAULT;

-- Remove the CHECK constraint to allow any value or null
ALTER TABLE organization_users DROP CONSTRAINT IF EXISTS organization_users_user_type_check;

-- Update comment to clarify purpose
COMMENT ON COLUMN organization_users.user_type IS 
'Optional supplementary classification for reporting and analytics purposes. 
Does NOT replace title field. Can be null or any custom value.
Examples: billing_user, fleet_user, driver_user, vehicle_user, finance_user, reports_user, standard_user';

COMMENT ON COLUMN organization_users.title IS 
'Primary classification of user: Main User, Secondary Main User, Billing User, Driver User, Vehicle User, User, etc. 
This is the main field used for user role identification.';

COMMENT ON COLUMN organization_users.is_main_user IS 
'Indicates if this user is the primary account holder for the organization. 
There must always be exactly one main user per client organization.';

COMMENT ON COLUMN organization_users.is_secondary_main_user IS 
'Indicates if this user is a secondary main user with full permissions. 
Optional, can have zero or one secondary main user per organization.';