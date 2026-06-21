/*
  # Update Garage Signup to Create Authenticated Users

  1. Purpose
    - Replace plain text password storage with proper Supabase authentication
    - Create authenticated user account when garage signs up
    - Link garage user to garage through organization and organization_users

  2. Changes
    - Update public_garage_signup to return user creation details
    - Create organization for the garage
    - Prepare user_id slot for the authenticated user (created in frontend)
    - Remove plain text password from contact_persons

  3. Security
    - User authentication handled by Supabase (secure password hashing)
    - Each garage contact gets their own authenticated user account
    - Access controlled through RLS policies
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

-- Function to link authenticated user to garage after user is created
CREATE OR REPLACE FUNCTION link_garage_user_to_organization(
  p_organization_id uuid,
  p_user_id uuid,
  p_name text,
  p_surname text,
  p_mobile_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create organization_user record for the garage user
  INSERT INTO organization_users (
    organization_id,
    user_id,
    role,
    name,
    surname,
    title,
    mobile_phone,
    office_phone,
    is_active,
    is_main_user,
    can_manage_users,
    can_manage_vehicles,
    can_manage_drivers,
    can_view_reports,
    can_manage_fuel_cards,
    can_view_invoices
  ) VALUES (
    p_organization_id,
    p_user_id,
    'garage_user',
    p_name,
    p_surname,
    'Garage Administrator',
    p_mobile_phone,
    NULL,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Create profile for the user
  INSERT INTO profiles (
    id,
    role,
    name,
    surname
  ) VALUES (
    p_user_id,
    'garage_user',
    p_name,
    p_surname
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION link_garage_user_to_organization(uuid, uuid, text, text, text) TO authenticated;

COMMENT ON FUNCTION link_garage_user_to_organization IS
'Links an authenticated user to a garage organization after user account is created';
