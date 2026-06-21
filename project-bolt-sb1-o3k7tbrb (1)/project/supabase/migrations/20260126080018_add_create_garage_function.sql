/*
  # Add function to create garages with organizations

  1. New Function
    - `create_garage_with_organization` - Creates both organization and garage in one transaction
    - Uses SECURITY DEFINER to bypass RLS restrictions
    - Returns the created garage with its organization_id

  2. Security
    - Function runs with elevated privileges
    - Only accessible to authenticated super admin users
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
  v_garage jsonb;
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can create garages';
  END IF;

  -- Create organization
  INSERT INTO organizations (name, vat_number, city, province)
  VALUES (p_org_name, p_org_vat_number, p_org_city, p_org_province)
  RETURNING id INTO v_org_id;

  -- Add organization_id to garage data
  p_garage_data = jsonb_set(p_garage_data, '{organization_id}', to_jsonb(v_org_id));

  -- Insert garage
  INSERT INTO garages
  SELECT * FROM jsonb_populate_record(null::garages, p_garage_data)
  RETURNING to_jsonb(garages.*) INTO v_garage;

  RETURN v_garage;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_garage_with_organization TO authenticated;