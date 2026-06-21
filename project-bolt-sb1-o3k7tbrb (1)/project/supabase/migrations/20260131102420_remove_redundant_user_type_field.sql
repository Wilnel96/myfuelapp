/*
  # Remove Redundant user_type Field

  ## Overview
  The user_type field in organization_users is redundant because we already have:
  - title field for primary role classification
  - is_main_user and is_secondary_main_user boolean flags
  - Granular permission flags for exact capabilities
  
  For reporting and filtering, we can use the title field directly.

  ## Changes
  1. Drop user_type column from organization_users table
  2. Simplify the schema to use only title + flags + permissions
*/

-- Drop the user_type column entirely
ALTER TABLE organization_users DROP COLUMN IF EXISTS user_type;

-- Update comments to clarify the title field is the only classification needed
COMMENT ON COLUMN organization_users.title IS 
'Primary role classification: Main User, Secondary Main User, Billing User, Driver User, Vehicle User, User, etc. 
Use this field for all user role identification, reporting, and filtering.';

COMMENT ON COLUMN organization_users.is_main_user IS 
'Indicates if this user is the primary account holder for the organization. 
There must always be exactly one main user per client organization.';

COMMENT ON COLUMN organization_users.is_secondary_main_user IS 
'Indicates if this user is a secondary main user with full permissions. 
Optional, can have zero or one secondary main user per organization.';