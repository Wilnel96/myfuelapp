/*
  # Remove Garage Organization Foreign Key

  1. Change
    - Drop the foreign key constraint from garages.organization_id to organizations.id
    - Garages are now completely standalone entities
    - The organization_id column remains (for legacy/historical purposes) but should always be NULL

  2. Reason
    - All garages now have organization_id = NULL
    - Garages are managed independently in the garages table
    - No relationship to organizations table needed
*/

ALTER TABLE garages
DROP CONSTRAINT IF EXISTS garages_organization_id_fkey;

COMMENT ON COLUMN garages.organization_id IS 
'DEPRECATED: Legacy field from old architecture. Should always be NULL. Garages are now standalone entities, completely separate from the organizations table.';
