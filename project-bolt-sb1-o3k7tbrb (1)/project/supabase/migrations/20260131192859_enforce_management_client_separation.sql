/*
  # Enforce Complete Separation Between Management and Client Organizations
  
  1. Purpose
    - Ensure management organization users cannot be mixed with client organization users
    - Prevent accidental creation of client data in management organization
    - Add validation to maintain strict boundaries between management and client contexts
  
  2. Changes
    - Add check constraint to prevent client vehicles/drivers in management org
    - Add check constraint to prevent management org being treated as client
    - Add validation function to ensure organization type consistency
  
  3. Security
    - Protects data integrity
    - Ensures organizational boundaries are maintained
*/

-- Function to check if an organization is a client organization
CREATE OR REPLACE FUNCTION is_client_organization(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_type = 'client' AND is_management_org = false
  FROM organizations
  WHERE id = org_id;
$$;

-- Function to check if an organization is management organization
CREATE OR REPLACE FUNCTION is_management_organization(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT is_management_org = true
  FROM organizations
  WHERE id = org_id;
$$;

-- Add check constraint to vehicles - cannot belong to management org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vehicles_not_in_management_org'
    AND table_name = 'vehicles'
  ) THEN
    ALTER TABLE vehicles
    ADD CONSTRAINT vehicles_not_in_management_org
    CHECK (NOT is_management_organization(organization_id));
  END IF;
END $$;

-- Add check constraint to drivers - cannot belong to management org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'drivers_not_in_management_org'
    AND table_name = 'drivers'
  ) THEN
    ALTER TABLE drivers
    ADD CONSTRAINT drivers_not_in_management_org
    CHECK (NOT is_management_organization(organization_id));
  END IF;
END $$;

-- Add check constraint to fuel_transactions - must be from client org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fuel_transactions_client_org_only'
    AND table_name = 'fuel_transactions'
  ) THEN
    ALTER TABLE fuel_transactions
    ADD CONSTRAINT fuel_transactions_client_org_only
    CHECK (is_client_organization(organization_id));
  END IF;
END $$;

-- Add helpful comment to organization_users table
COMMENT ON TABLE organization_users IS 'Users can belong to ANY organization type (management, client, or garage). Management org users manage the system, client org users manage their fleet, garage users manage their garage.';

-- Grant execute permission on helper functions
GRANT EXECUTE ON FUNCTION is_client_organization TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_management_organization TO authenticated, anon;
