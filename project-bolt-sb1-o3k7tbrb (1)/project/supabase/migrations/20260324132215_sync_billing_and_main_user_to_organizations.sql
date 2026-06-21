/*
  # Synchronize Billing User and Main User Information with Organizations Table

  1. Problem
    - When a client organization is created, main user and billing user info is captured
    - Main user info goes to organization_users table with is_main_user = true
    - Billing user info goes to BOTH:
      * organizations table (billing_contact_* fields)
      * organization_users table (if billing user is different person than main user)
    - BUT when users are updated in organization_users table via User Management,
      the organizations table billing_contact_* fields don't get updated
    - This causes discrepancy between what's shown in garage portal (organizations table)
      and what's shown in client portal user management (organization_users table)

  2. Solution
    - Create triggers to automatically sync changes:
      * When a user with title "Billing User" is updated → sync to organizations.billing_contact_*
      * When a user with is_main_user = true is updated → this already handled in ClientOrgInfo
      * Handle edge case where same person is both main user and billing user

  3. Changes
    - Create function to sync billing user info to organizations table
    - Create trigger on organization_users UPDATE
    - Sync existing billing users to organizations table (backfill)
*/

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS sync_billing_user_to_organization_trigger ON organization_users;
DROP FUNCTION IF EXISTS sync_billing_user_to_organization();

-- Create function to sync billing user information to organizations table
CREATE OR REPLACE FUNCTION sync_billing_user_to_organization()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only proceed if this is a billing user (title = 'Billing User')
  -- OR if it's a main user who might also be the billing contact
  IF NEW.title = 'Billing User' OR NEW.is_main_user = true THEN
    -- Check if this user is the billing contact (email matches)
    UPDATE organizations
    SET
      billing_contact_name = NEW.first_name,
      billing_contact_surname = NEW.surname,
      billing_contact_email = NEW.email,
      billing_contact_phone_mobile = NEW.phone_mobile,
      billing_contact_phone_office = NEW.phone_office
    WHERE id = NEW.organization_id
      AND billing_contact_email = NEW.email; -- Only update if email matches
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to automatically sync on UPDATE
CREATE TRIGGER sync_billing_user_to_organization_trigger
  AFTER UPDATE ON organization_users
  FOR EACH ROW
  WHEN (
    NEW.title = 'Billing User'
    OR NEW.is_main_user = true
  )
  EXECUTE FUNCTION sync_billing_user_to_organization();

-- Backfill: Sync existing billing users to organizations table
DO $$
DECLARE
  billing_user RECORD;
BEGIN
  -- Find all billing users and sync them
  FOR billing_user IN
    SELECT
      ou.organization_id,
      ou.first_name,
      ou.surname,
      ou.email,
      ou.phone_mobile,
      ou.phone_office
    FROM organization_users ou
    WHERE ou.title = 'Billing User'
      AND ou.is_active = true
  LOOP
    -- Update organizations table with billing user info
    UPDATE organizations
    SET
      billing_contact_name = billing_user.first_name,
      billing_contact_surname = billing_user.surname,
      billing_contact_email = billing_user.email,
      billing_contact_phone_mobile = billing_user.phone_mobile,
      billing_contact_phone_office = billing_user.phone_office
    WHERE id = billing_user.organization_id;

    RAISE NOTICE 'Synced billing user % % to organization %',
      billing_user.first_name,
      billing_user.surname,
      billing_user.organization_id;
  END LOOP;
END $$;

-- Also handle the case where main user is also the billing contact
-- (when they use the same email for both during organization creation)
DO $$
DECLARE
  main_user RECORD;
BEGIN
  -- Find main users whose email matches the billing contact email
  FOR main_user IN
    SELECT
      ou.organization_id,
      ou.first_name,
      ou.surname,
      ou.email,
      ou.phone_mobile,
      ou.phone_office,
      o.billing_contact_email
    FROM organization_users ou
    JOIN organizations o ON o.id = ou.organization_id
    WHERE ou.is_main_user = true
      AND ou.email = o.billing_contact_email
      AND ou.is_active = true
  LOOP
    -- Update organizations table to ensure billing contact is in sync
    UPDATE organizations
    SET
      billing_contact_name = main_user.first_name,
      billing_contact_surname = main_user.surname,
      billing_contact_phone_mobile = main_user.phone_mobile,
      billing_contact_phone_office = main_user.phone_office
    WHERE id = main_user.organization_id;

    RAISE NOTICE 'Synced main user (also billing contact) % % to organization %',
      main_user.first_name,
      main_user.surname,
      main_user.organization_id;
  END LOOP;
END $$;