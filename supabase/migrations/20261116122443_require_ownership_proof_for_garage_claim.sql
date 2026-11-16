/*
  # Require proof of ownership when claiming a garage account

  1. Problem
     - link_garage_user_to_organization let any signed-in user attach themselves as
       garage administrator of any garage organization that had no members yet.

  2. Changes
     - Besides having no existing members, the garage must still be `pending` and the
       caller's verified email must match the garage's own email address or one of its
       listed contact persons.
*/

CREATE OR REPLACE FUNCTION public.link_garage_user_to_organization(
  p_organization_id uuid,
  p_user_id uuid,
  p_name text,
  p_surname text,
  p_mobile_phone text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_platform_operator() THEN
    IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;

    IF EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.organization_id = p_organization_id AND ou.user_id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;

    v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

    IF NOT EXISTS (
      SELECT 1
      FROM garages g
      WHERE g.organization_id = p_organization_id
        AND g.status = 'pending'
        AND v_email <> ''
        AND (
          lower(coalesce(g.email_address, '')) = v_email
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(coalesce(g.contact_persons, '[]'::jsonb)) c
            WHERE lower(coalesce(c->>'email', '')) = v_email
          )
        )
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  UPDATE organizations SET organization_type = 'garage' WHERE id = p_organization_id;

  INSERT INTO organization_users (organization_id, user_id, role, first_name, surname, title, phone_mobile, phone_office, is_main_user, is_active)
  VALUES (p_organization_id, p_user_id, 'garage_user', p_name, p_surname, 'Garage Administrator', p_mobile_phone, NULL, true, true)
  ON CONFLICT (user_id, organization_id) DO UPDATE
  SET first_name = p_name, surname = p_surname, role = 'garage_user', is_active = true;

  INSERT INTO profiles (id, role, full_name, organization_id)
  VALUES (p_user_id, 'garage_user', p_name || ' ' || p_surname, p_organization_id)
  ON CONFLICT (id) DO UPDATE SET role = 'garage_user', organization_id = p_organization_id;
END;
$function$;
