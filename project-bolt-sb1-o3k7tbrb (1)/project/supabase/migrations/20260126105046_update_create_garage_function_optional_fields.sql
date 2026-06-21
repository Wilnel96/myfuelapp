/*
  # Update create_garage_with_organization to handle optional fields

  1. Changes
    - Make bank fields optional in the function
    - Handle NULL values gracefully
    - Allow garages to be created with minimal information
*/

CREATE OR REPLACE FUNCTION create_garage_with_organization(
  p_garage_data jsonb,
  p_org_name text,
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
  v_org_id uuid;
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

  -- Generate IDs
  v_garage_id = gen_random_uuid();
  
  -- Create organization
  INSERT INTO organizations (name, vat_number, city, province)
  VALUES (p_org_name, p_org_vat_number, p_org_city, p_org_province)
  RETURNING id INTO v_org_id;

  -- Insert garage with explicit column mapping (all fields now optional except name and organization_id)
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
    fuel_brand,
    fuel_types,
    price_zone,
    fuel_prices,
    other_offerings,
    contact_persons,
    vat_number,
    password,
    bank_name,
    account_holder,
    account_number,
    branch_code
  )
  VALUES (
    v_garage_id,
    v_org_id,
    p_garage_data->>'name',
    p_garage_data->>'address_line_1',
    p_garage_data->>'address_line_2',
    p_garage_data->>'city',
    p_garage_data->>'province',
    p_garage_data->>'postal_code',
    CASE WHEN p_garage_data->>'latitude' IS NOT NULL THEN (p_garage_data->>'latitude')::numeric ELSE NULL END,
    CASE WHEN p_garage_data->>'longitude' IS NOT NULL THEN (p_garage_data->>'longitude')::numeric ELSE NULL END,
    p_garage_data->>'email_address',
    p_garage_data->>'fuel_brand',
    CASE WHEN p_garage_data->'fuel_types' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(p_garage_data->'fuel_types'))
      ELSE NULL 
    END,
    p_garage_data->>'price_zone',
    p_garage_data->'fuel_prices',
    CASE WHEN p_garage_data->'other_offerings' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(p_garage_data->'other_offerings'))
      ELSE NULL 
    END,
    p_garage_data->'contact_persons',
    p_garage_data->>'vat_number',
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