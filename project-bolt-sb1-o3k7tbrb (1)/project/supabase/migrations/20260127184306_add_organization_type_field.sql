/*
  # Add organization type field to distinguish between clients and garages

  1. Changes
    - Add organization_type field with values: 'client', 'garage', 'management'
    - Default to 'client' for backward compatibility
    - Set existing garage organizations to 'garage' type
    - Update is_management_org based on organization_type

  2. Security
    - No RLS changes needed
*/

-- Add organization_type column
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS organization_type text 
DEFAULT 'client' 
CHECK (organization_type IN ('client', 'garage', 'management'));

-- Set organization_type for existing garages (organizations that have a garage record)
UPDATE organizations o
SET organization_type = 'garage'
WHERE EXISTS (
  SELECT 1 FROM garages g 
  WHERE g.organization_id = o.id
);

-- Set organization_type for management org
UPDATE organizations
SET organization_type = 'management'
WHERE is_management_org = true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(organization_type);