/*
  # Remove Garage Organization Type

  1. Problem
    - Garages exist in organizations table with organization_type='garage'
    - This causes confusion as garages should be managed via the garages table
    - Garages need organization records for financial purposes (invoicing, accounts)
    - But they shouldn't appear as "organizations" in the business sense

  2. Solution
    - Change organization_type from 'garage' to NULL for garage organizations
    - This way garages still have organization records (for financial ops)
    - But they don't appear when querying for client/management organizations
    - The garages table remains the primary interface for garage management

  3. Changes
    - Update all garage-type organizations to have NULL organization_type
    - Update code/queries to filter out organizations where organization_type IS NULL
*/

-- Update all garage organizations to have NULL organization_type
UPDATE organizations
SET organization_type = NULL
WHERE organization_type = 'garage';

COMMENT ON COLUMN organizations.organization_type IS 
'Type of organization: ''client'', ''management'', or NULL for garages. Garages have organization records for financial purposes but are managed via the garages table.';
