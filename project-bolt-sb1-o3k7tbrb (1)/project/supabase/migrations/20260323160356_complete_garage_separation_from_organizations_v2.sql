/*
  # Complete Garage Separation from Organizations

  1. Current State
    - 102 garages in garages table
    - 50 garages linked to NULL-type organizations (have org data)
    - 52 garages linked to management organization (no org data of their own)
    - Garages table missing: phone_number, company_registration_number
    - organization_id is NOT NULL (should be nullable - garages are standalone)

  2. Goal
    - Garages should be completely separate from organizations
    - All garage data should be in garages table only
    - organization_id should be NULL for all garages
    - No garage records in organizations table

  3. Changes
    - Add phone_number and company_registration_number to garages
    - Copy organization data to garages table for the 50 garages that have it
    - Make organization_id nullable
    - Set all garage organization_ids to NULL
    - Delete the 50 garage organization records
    - Update create_garage function to not create organizations
*/

-- ============================================================================
-- STEP 1: Add missing fields to garages table
-- ============================================================================

ALTER TABLE garages 
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS company_registration_number text;

-- ============================================================================
-- STEP 2: Copy organization data to garages for the 50 that have org records
-- ============================================================================

UPDATE garages g
SET 
  phone_number = COALESCE(g.phone_number, o.phone_number),
  company_registration_number = COALESCE(g.company_registration_number, o.company_registration_number),
  vat_number = COALESCE(g.vat_number, o.vat_number),
  bank_name = COALESCE(g.bank_name, o.bank_name),
  account_holder = COALESCE(g.account_holder, o.bank_account_holder),
  account_number = COALESCE(g.account_number, o.bank_account_number),
  branch_code = COALESCE(g.branch_code, o.bank_branch_code)
FROM organizations o
WHERE g.organization_id = o.id
  AND o.organization_type IS NULL;

-- ============================================================================
-- STEP 3: Make organization_id nullable (garages are standalone)
-- ============================================================================

ALTER TABLE garages 
ALTER COLUMN organization_id DROP NOT NULL;

-- ============================================================================
-- STEP 4: Set all garage organization_ids to NULL
-- ============================================================================

UPDATE garages
SET organization_id = NULL;

-- ============================================================================
-- STEP 5: Delete garage organization records (the 50 with NULL type)
-- ============================================================================

DELETE FROM organizations
WHERE organization_type IS NULL;

-- ============================================================================
-- STEP 6: Update create_garage function to NOT create organizations
-- ============================================================================

CREATE OR REPLACE FUNCTION create_garage_with_organization(
  p_garage_data jsonb,
  p_org_name text DEFAULT NULL,
  p_org_vat_number text DEFAULT NULL,
  p_org_city text DEFAULT NULL,
  p_org_province text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_garage_id uuid;
  v_result jsonb;
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can create garages';
  END IF;

  -- Generate ID
  v_garage_id = gen_random_uuid();
  
  -- Insert garage WITHOUT creating an organization
  -- Garages are completely standalone in the garages table
  INSERT INTO garages (
    id,
    organization_id,
    name,
    address_line_1,
    address_line_2,
    city,
    province,
    postal_code,
    latitude,
    longitude,
    email_address,
    phone_number,
    fuel_brand,
    fuel_types,
    price_zone,
    fuel_prices,
    other_offerings,
    contact_persons,
    vat_number,
    company_registration_number,
    password,
    bank_name,
    account_holder,
    account_number,
    branch_code
  )
  VALUES (
    v_garage_id,
    NULL, -- Garages are standalone, no organization link
    p_garage_data->>'name',
    p_garage_data->>'address_line_1',
    p_garage_data->>'address_line_2',
    p_garage_data->>'city',
    p_garage_data->>'province',
    p_garage_data->>'postal_code',
    (p_garage_data->>'latitude')::numeric,
    (p_garage_data->>'longitude')::numeric,
    p_garage_data->>'email_address',
    p_garage_data->>'phone_number',
    p_garage_data->>'fuel_brand',
    CASE WHEN p_garage_data->'fuel_types' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(p_garage_data->'fuel_types'))
      ELSE NULL 
    END,
    p_garage_data->>'price_zone',
    p_garage_data->'fuel_prices',
    p_garage_data->'other_offerings',
    p_garage_data->'contact_persons',
    p_garage_data->>'vat_number',
    p_garage_data->>'company_registration_number',
    p_garage_data->>'password',
    p_garage_data->>'bank_name',
    p_garage_data->>'account_holder',
    p_garage_data->>'account_number',
    p_garage_data->>'branch_code'
  )
  RETURNING to_jsonb(garages.*) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION create_garage_with_organization IS 
'Creates a standalone garage record in the garages table. Note: Despite the legacy function name, this does NOT create an organization - garages are completely separate from organizations.';

COMMENT ON COLUMN garages.organization_id IS 
'Legacy field. Should always be NULL. Garages are standalone entities, completely separate from the organizations table.';
