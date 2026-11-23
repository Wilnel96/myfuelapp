/*
# Make bank details optional for garage signup

1. Purpose
  - Garages signing up through the public garage signup form are no longer
    required to provide banking details (bank name, account holder,
    account number, branch code).

2. Modified functions
  - `public_garage_signup(jsonb)`: removes the four validation checks that
    raised exceptions when bank_name, account_holder, account_number or
    branch_code were missing/empty. Those fields are now stored as empty
    strings when not supplied, matching how other optional fields
    (address_line_2, postal_code, vat_number) are handled. All other
    behaviour (organization creation, pending status, contact person
    handling, return shape) is unchanged.

3. Security
  - Function definition unchanged: still SECURITY DEFINER, search_path
    pinned to public. Execute grants are unchanged (anon + authenticated,
    re-granted for safety).
*/

CREATE OR REPLACE FUNCTION public_garage_signup(
  p_garage_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_garage_id uuid;
  v_organization_id uuid;
  v_contact_person jsonb;
  v_contact_email text;
  v_contact_name text;
  v_contact_surname text;
  v_contact_mobile text;
  v_result jsonb;
BEGIN
  -- Validate required fields
  IF p_garage_data->>'name' IS NULL OR p_garage_data->>'name' = '' THEN
    RAISE EXCEPTION 'Garage name is required';
  END IF;

  IF p_garage_data->>'city' IS NULL OR p_garage_data->>'city' = '' THEN
    RAISE EXCEPTION 'City is required';
  END IF;

  IF p_garage_data->'contact_persons' IS NULL OR jsonb_array_length(p_garage_data->'contact_persons') = 0 THEN
    RAISE EXCEPTION 'At least one contact person is required';
  END IF;

  -- Generate IDs
  v_garage_id := gen_random_uuid();
  v_organization_id := gen_random_uuid();

  -- Get first contact person details
  v_contact_person := p_garage_data->'contact_persons'->0;
  v_contact_email := v_contact_person->>'email';
  v_contact_name := v_contact_person->>'name';
  v_contact_surname := v_contact_person->>'surname';
  v_contact_mobile := v_contact_person->>'mobile_phone';

  -- Create organization for the garage
  INSERT INTO organizations (
    id,
    name,
    registration_number,
    organization_type,
    is_active,
    created_at
  ) VALUES (
    v_organization_id,
    p_garage_data->>'name',
    p_garage_data->>'vat_number',
    NULL,
    true,
    now()
  );

  -- Insert garage (status will be 'pending' until approved by admin)
  -- Bank details are optional: stored as empty strings when not supplied
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
    phone_number,
    email_address,
    contact_persons,
    bank_name,
    account_holder,
    account_number,
    branch_code,
    vat_number,
    fuel_brand,
    price_zone,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_garage_id,
    v_organization_id,
    p_garage_data->>'name',
    p_garage_data->>'address_line_1',
    COALESCE(p_garage_data->>'address_line_2', ''),
    p_garage_data->>'city',
    COALESCE(p_garage_data->>'province', ''),
    COALESCE(p_garage_data->>'postal_code', ''),
    CASE WHEN p_garage_data->>'latitude' IS NOT NULL AND p_garage_data->>'latitude' != ''
      THEN (p_garage_data->>'latitude')::numeric
      ELSE NULL
    END,
    CASE WHEN p_garage_data->>'longitude' IS NOT NULL AND p_garage_data->>'longitude' != ''
      THEN (p_garage_data->>'longitude')::numeric
      ELSE NULL
    END,
    COALESCE(p_garage_data->>'contact_phone', ''),
    COALESCE(p_garage_data->>'email_address', ''),
    jsonb_build_array(
      jsonb_build_object(
        'email', v_contact_email,
        'name', v_contact_name || ' ' || v_contact_surname,
        'mobile_phone', v_contact_mobile
      )
    ),
    COALESCE(p_garage_data->>'bank_name', ''),
    COALESCE(p_garage_data->>'account_holder', ''),
    COALESCE(p_garage_data->>'account_number', ''),
    COALESCE(p_garage_data->>'branch_code', ''),
    COALESCE(p_garage_data->>'vat_number', ''),
    COALESCE(p_garage_data->>'fuel_brand', ''),
    COALESCE(p_garage_data->>'price_zone', 'Inland'),
    'pending',
    now(),
    now()
  );

  -- Return signup details including email for user creation in frontend
  v_result := jsonb_build_object(
    'garage_id', v_garage_id,
    'organization_id', v_organization_id,
    'garage_name', p_garage_data->>'name',
    'status', 'pending',
    'contact_email', v_contact_email,
    'contact_name', v_contact_name,
    'contact_surname', v_contact_surname,
    'contact_mobile', v_contact_mobile,
    'created_at', now()
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public_garage_signup(jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public_garage_signup IS
'Allows public garage signup. Creates garage with pending status for admin approval. Bank details are optional.';
