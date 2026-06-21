/*
  # Create Public Garage Signup Function

  1. New Function
    - `public_garage_signup` - Allows anyone to register a new garage
    - Creates garage record with pending status for admin approval
    - Does not require authentication
    - Validates required fields

  2. Security
    - Function is SECURITY DEFINER to allow anonymous users to insert
    - Creates garages with 'pending' status requiring admin approval
    - Validates all required fields before insertion
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
  v_result jsonb;
BEGIN
  -- Validate required fields
  IF p_garage_data->>'name' IS NULL OR p_garage_data->>'name' = '' THEN
    RAISE EXCEPTION 'Garage name is required';
  END IF;

  IF p_garage_data->>'city' IS NULL OR p_garage_data->>'city' = '' THEN
    RAISE EXCEPTION 'City is required';
  END IF;

  IF p_garage_data->>'bank_name' IS NULL OR p_garage_data->>'bank_name' = '' THEN
    RAISE EXCEPTION 'Bank name is required';
  END IF;

  IF p_garage_data->>'account_holder' IS NULL OR p_garage_data->>'account_holder' = '' THEN
    RAISE EXCEPTION 'Account holder is required';
  END IF;

  IF p_garage_data->>'account_number' IS NULL OR p_garage_data->>'account_number' = '' THEN
    RAISE EXCEPTION 'Account number is required';
  END IF;

  IF p_garage_data->>'branch_code' IS NULL OR p_garage_data->>'branch_code' = '' THEN
    RAISE EXCEPTION 'Branch code is required';
  END IF;

  IF p_garage_data->'contact_persons' IS NULL OR jsonb_array_length(p_garage_data->'contact_persons') = 0 THEN
    RAISE EXCEPTION 'At least one contact person is required';
  END IF;

  -- Generate ID
  v_garage_id = gen_random_uuid();

  -- Insert garage with pending status
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
    contact_phone,
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
    NULL,
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
    p_garage_data->'contact_persons',
    p_garage_data->>'bank_name',
    p_garage_data->>'account_holder',
    p_garage_data->>'account_number',
    p_garage_data->>'branch_code',
    COALESCE(p_garage_data->>'vat_number', ''),
    COALESCE(p_garage_data->>'fuel_brand', ''),
    COALESCE(p_garage_data->>'price_zone', 'Inland'),
    'pending',
    now(),
    now()
  )
  RETURNING jsonb_build_object(
    'id', id,
    'name', name,
    'status', status,
    'created_at', created_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public_garage_signup TO anon;
GRANT EXECUTE ON FUNCTION public_garage_signup TO authenticated;

COMMENT ON FUNCTION public_garage_signup IS
'Allows public garage signup. Creates garage with pending status for admin approval.';
