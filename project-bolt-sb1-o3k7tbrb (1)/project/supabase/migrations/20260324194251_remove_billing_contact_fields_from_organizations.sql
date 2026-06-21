/*
  # Remove Billing Contact Fields from Organizations Table

  1. Problem
    - Currently storing billing contact info in TWO places:
      * organizations table (billing_contact_* fields)
      * organization_users table (user with title "Billing User")
    - This creates unnecessary complexity and requires sync triggers
    - Main user info is stored ONLY in organization_users table
    - Billing user should work the same way

  2. Solution
    - Remove billing_contact_* fields from organizations table
    - Keep billing user info ONLY in organization_users table
    - Update queries to fetch billing user from organization_users where title = 'Billing User'
    - Remove the sync trigger since it's no longer needed

  3. Changes
    - Drop sync trigger and function
    - Drop billing_contact_* columns from organizations table
    - This simplifies the system and makes it consistent
*/

-- Drop the sync trigger and function (no longer needed)
DROP TRIGGER IF EXISTS sync_billing_user_to_organization_trigger ON organization_users;
DROP FUNCTION IF EXISTS sync_billing_user_to_organization();

-- Remove billing contact fields from organizations table
ALTER TABLE organizations
  DROP COLUMN IF EXISTS billing_contact_name,
  DROP COLUMN IF EXISTS billing_contact_surname,
  DROP COLUMN IF EXISTS billing_contact_email,
  DROP COLUMN IF EXISTS billing_contact_phone_mobile,
  DROP COLUMN IF EXISTS billing_contact_phone_office;

-- Note: Billing user information is now stored exclusively in organization_users table
-- To get billing contact info, query:
-- SELECT * FROM organization_users WHERE organization_id = ? AND title = 'Billing User'
