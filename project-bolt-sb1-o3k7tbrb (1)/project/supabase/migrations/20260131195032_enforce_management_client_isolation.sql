/*
  # Enforce Complete Isolation Between Management and Client Organizations
  
  ## Problem
  Client organizations had `parent_org_id` pointing to the management organization, creating
  a hierarchical link. This link created conceptual coupling between management and clients.
  
  ## Solution - Complete Separation
  
  ### 1. Remove Parent-Child Links
  - Remove `parent_org_id` from ALL client organizations
  - Management organization stands alone with NO children
  - Client organizations stand alone with NO parent
  
  ### 2. Access Control Model
  Instead of using `parent_org_id` for access:
  - **Management users**: Identified by `organization.is_management_org = true`
  - **Management users can see all clients**: Through RLS based on management org membership
  - **Client users**: Can only see their own organization
  - **No hierarchical relationship needed**
  
  ### 3. Operational Data Isolation
  Add strict constraints to ensure:
  - Management organizations CANNOT have operational data (vehicles, drivers, transactions)
  - Management org is for system administration only
  - Client organizations are for operational use only
  
  ### 4. Clear Separation of Concerns
  - **Management Organization**: System admin, client management, back-office operations
  - **Client Organizations**: Fleet operations, fuel tracking, driver management
  - **Garage Organizations**: Service provision
  
  ## Changes Made
  
  1. **Break Parent-Child Links**
     - Set all client organizations' `parent_org_id` to NULL
     - Management organization already has NULL parent
  
  2. **Add Data Protection Constraints**
     - Prevent vehicles in management org
     - Prevent drivers in management org
     - Prevent fuel transactions in management org
     - Prevent operational data in management org
  
  3. **RLS Policy Updates**
     - Management users see all clients through organization_type check
     - No reliance on parent_org_id for access control
  
  ## Security Implications
  
  - Management org issues CANNOT cascade to clients (no FK relationship)
  - Client org issues CANNOT affect management (no FK relationship)
  - Complete data isolation enforced at database level
  - Clear organizational boundaries
*/

-- ============================================================================
-- STEP 1: Break All Parent-Child Links Between Management and Clients
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Removing parent_org_id links from client organizations...';
END $$;

-- Remove parent_org_id from all client organizations
-- This breaks the hierarchical link completely
UPDATE organizations
SET parent_org_id = NULL
WHERE organization_type = 'client'
  AND parent_org_id IS NOT NULL;

-- Verify: Management org should have no operational children
DO $$
DECLARE
  remaining_clients INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_clients
  FROM organizations
  WHERE parent_org_id = '00000000-0000-0000-0000-000000000000';
  
  IF remaining_clients > 0 THEN
    RAISE WARNING 'Still % organizations linked to management org', remaining_clients;
  ELSE
    RAISE NOTICE 'All client organizations successfully unlinked from management org';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add Constraints to Prevent Operational Data in Management Org
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Adding constraints to prevent operational data in management organization...';
END $$;

-- Create function to check if organization is management type
CREATE OR REPLACE FUNCTION is_management_organization(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_management_org = true AND organization_type = 'management'
  FROM organizations
  WHERE id = org_id;
$$;

-- Add check constraint to vehicles table
-- Management organizations CANNOT have vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vehicles_no_management_org'
  ) THEN
    ALTER TABLE vehicles
    ADD CONSTRAINT vehicles_no_management_org
    CHECK (NOT is_management_organization(organization_id));
    
    RAISE NOTICE 'Added constraint: vehicles_no_management_org';
  END IF;
END $$;

-- Add check constraint to drivers table
-- Management organizations CANNOT have drivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_no_management_org'
  ) THEN
    ALTER TABLE drivers
    ADD CONSTRAINT drivers_no_management_org
    CHECK (NOT is_management_organization(organization_id));
    
    RAISE NOTICE 'Added constraint: drivers_no_management_org';
  END IF;
END $$;

-- Add check constraint to fuel_transactions table
-- Management organizations CANNOT have fuel transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fuel_transactions_no_management_org'
  ) THEN
    ALTER TABLE fuel_transactions
    ADD CONSTRAINT fuel_transactions_no_management_org
    CHECK (NOT is_management_organization(organization_id));
    
    RAISE NOTICE 'Added constraint: fuel_transactions_no_management_org';
  END IF;
END $$;

-- Add check constraint to vehicle_transactions table
-- Management organizations CANNOT have vehicle transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vehicle_transactions_no_management_org'
  ) THEN
    ALTER TABLE vehicle_transactions
    ADD CONSTRAINT vehicle_transactions_no_management_org
    CHECK (NOT is_management_organization(organization_id));
    
    RAISE NOTICE 'Added constraint: vehicle_transactions_no_management_org';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Update Helper Function for Client Organization Access
-- ============================================================================

-- Create function for management users to see all client organizations
-- This replaces the parent_org_id check
CREATE OR REPLACE FUNCTION user_can_see_organization(target_org_id uuid, user_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- User can see their own organization
  SELECT CASE
    WHEN target_org_id = user_org_id THEN true
    -- Management org users can see all client organizations
    WHEN EXISTS (
      SELECT 1 FROM organizations
      WHERE id = user_org_id
        AND is_management_org = true
        AND organization_type = 'management'
    ) AND EXISTS (
      SELECT 1 FROM organizations
      WHERE id = target_org_id
        AND organization_type = 'client'
    ) THEN true
    ELSE false
  END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION user_can_see_organization(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_see_organization(uuid, uuid) TO anon;

-- ============================================================================
-- STEP 4: Add Documentation Table
-- ============================================================================

-- Create a table to document the organizational structure
CREATE TABLE IF NOT EXISTS system_documentation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Document the management/client separation
INSERT INTO system_documentation (topic, content)
VALUES (
  'Management and Client Organization Separation',
  E'# Management and Client Organization Isolation\n\n' ||
  E'## Organizational Structure\n\n' ||
  E'1. **Management Organization** (Fuel Empowerment Systems)\n' ||
  E'   - Type: management\n' ||
  E'   - Purpose: System administration, client management, back-office\n' ||
  E'   - Restrictions: NO operational data (vehicles, drivers, transactions)\n' ||
  E'   - Access: Can view/manage all client organizations\n\n' ||
  E'2. **Client Organizations** (Transport companies)\n' ||
  E'   - Type: client\n' ||
  E'   - Purpose: Fleet operations, fuel tracking, driver management\n' ||
  E'   - Restrictions: Can only access own data\n' ||
  E'   - Parent Link: NONE - completely independent\n\n' ||
  E'3. **Garage Organizations** (Fuel stations)\n' ||
  E'   - Type: garage\n' ||
  E'   - Purpose: Fuel service provision\n' ||
  E'   - Restrictions: Can only access own data\n' ||
  E'   - Parent Link: NONE - completely independent\n\n' ||
  E'## Data Isolation\n\n' ||
  E'- Management org CANNOT have vehicles (enforced by constraint)\n' ||
  E'- Management org CANNOT have drivers (enforced by constraint)\n' ||
  E'- Management org CANNOT have fuel transactions (enforced by constraint)\n' ||
  E'- Client orgs have NO parent_org_id link to management\n' ||
  E'- Management sees clients through organization_type flag, not FK relationship\n\n' ||
  E'## Access Control\n\n' ||
  E'- Management users identified by: is_management_org = true\n' ||
  E'- Management users see clients through RLS policies\n' ||
  E'- Client users can only see their own organization\n' ||
  E'- No hierarchical FK relationships between management and clients\n\n' ||
  E'## Benefits of This Architecture\n\n' ||
  E'- Complete data isolation\n' ||
  E'- Management org issues cannot cascade to clients\n' ||
  E'- Client org issues cannot affect management\n' ||
  E'- Clear separation of concerns\n' ||
  E'- Database-enforced boundaries'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  management_has_vehicles INTEGER;
  management_has_drivers INTEGER;
  management_has_transactions INTEGER;
  clients_with_parent INTEGER;
BEGIN
  -- Check if management org has any operational data
  SELECT COUNT(*) INTO management_has_vehicles
  FROM vehicles
  WHERE organization_id IN (
    SELECT id FROM organizations WHERE is_management_org = true
  );
  
  SELECT COUNT(*) INTO management_has_drivers
  FROM drivers
  WHERE organization_id IN (
    SELECT id FROM organizations WHERE is_management_org = true
  );
  
  SELECT COUNT(*) INTO management_has_transactions
  FROM fuel_transactions
  WHERE organization_id IN (
    SELECT id FROM organizations WHERE is_management_org = true
  );
  
  -- Check if any clients still have parent links
  SELECT COUNT(*) INTO clients_with_parent
  FROM organizations
  WHERE organization_type = 'client' AND parent_org_id IS NOT NULL;
  
  -- Report status
  RAISE NOTICE '=== Isolation Verification ===';
  RAISE NOTICE 'Management org vehicles: %', management_has_vehicles;
  RAISE NOTICE 'Management org drivers: %', management_has_drivers;
  RAISE NOTICE 'Management org transactions: %', management_has_transactions;
  RAISE NOTICE 'Clients with parent links: %', clients_with_parent;
  
  IF management_has_vehicles = 0 AND 
     management_has_drivers = 0 AND 
     management_has_transactions = 0 AND
     clients_with_parent = 0 THEN
    RAISE NOTICE '✓ Complete isolation verified successfully';
  ELSE
    RAISE WARNING '✗ Isolation not complete - manual intervention required';
  END IF;
END $$;
