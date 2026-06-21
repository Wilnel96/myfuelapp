/*
  # Fix Shell Robertson organization_type

  Shell Robertson was imported with organization_type = NULL, causing it to be
  excluded from invoice generation (which filters for organization_type = 'client').
  
  This also sets is_garage_managed = false explicitly since it is a direct client.
*/

UPDATE organizations
SET organization_type = 'client'
WHERE id = '72443dcd-f70b-4a8b-8104-a96bac959458'
  AND organization_type IS NULL
  AND is_management_org = false;
