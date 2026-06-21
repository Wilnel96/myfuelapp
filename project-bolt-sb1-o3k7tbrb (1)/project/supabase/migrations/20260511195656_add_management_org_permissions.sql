/*
  # Add Management Organization Back Office Permission Columns

  ## Summary
  Adds granular permission columns to organization_users specifically for management org users
  to control access to Back Office features. These are only relevant for users in the management
  organization — client org user management is unaffected.

  ## New Columns on organization_users
  - `can_access_back_office` - Whether the user can enter the Back Office at all
  - `can_view_org_info` - Can view Management Organization Info
  - `can_edit_org_info` - Can edit Management Organization Info
  - `can_view_client_settings` - Can view Client Standard Financial Settings
  - `can_edit_client_settings` - Can edit Client Standard Financial Settings
  - `can_view_invoice_management` - Can view Invoice Management
  - `can_edit_invoice_management` - Can edit/action Invoice Management
  - `can_view_fuel_price_update` - Can view Fuel Price Update
  - `can_edit_fuel_price_update` - Can perform Fuel Price Update

  ## Notes
  - Main User and Secondary Main User always have full access regardless of these flags
  - All columns default to false (deny-by-default)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_users' AND column_name = 'can_access_back_office') THEN
    ALTER TABLE organization_users ADD COLUMN can_access_back_office boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_users' AND column_name = 'can_view_org_info') THEN
    ALTER TABLE organization_users ADD COLUMN can_view_org_info boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_users' AND column_name = 'can_edit_org_info') THEN
    ALTER TABLE organization_users ADD COLUMN can_edit_org_info boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_users' AND column_name = 'can_view_client_settings') THEN
    ALTER TABLE organization_users ADD COLUMN can_view_client_settings boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_users' AND column_name = 'can_edit_client_settings') THEN
    ALTER TABLE organization_users ADD COLUMN can_edit_client_settings boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_users' AND column_name = 'can_view_invoice_management') THEN
    ALTER TABLE organization_users ADD COLUMN can_view_invoice_management boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_users' AND column_name = 'can_edit_invoice_management') THEN
    ALTER TABLE organization_users ADD COLUMN can_edit_invoice_management boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_users' AND column_name = 'can_view_fuel_price_update') THEN
    ALTER TABLE organization_users ADD COLUMN can_view_fuel_price_update boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_users' AND column_name = 'can_edit_fuel_price_update') THEN
    ALTER TABLE organization_users ADD COLUMN can_edit_fuel_price_update boolean NOT NULL DEFAULT false;
  END IF;
END $$;
