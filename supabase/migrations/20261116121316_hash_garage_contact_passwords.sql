/*
  # Hash garage contact passwords

  1. Problem
     - garages.contact_persons stores contact login passwords in plaintext inside a
       JSON column that the anon role can read, so anyone with the public key could
       read garage portal credentials.

  2. Changes
     - Add a trigger that replaces any plaintext `password` in contact_persons with a
       bcrypt `password_hash` and strips the plaintext before the row is stored.
     - Backfill existing rows through the same logic.
     - Add verify_garage_contact_password(), SECURITY DEFINER and service-role only,
       so edge functions can authenticate a contact without reading the hash.
*/

CREATE OR REPLACE FUNCTION public.hash_garage_contact_passwords()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_contacts jsonb;
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_pwd text;
  v_old jsonb;
  v_existing text;
BEGIN
  v_contacts := NEW.contact_persons;
  IF v_contacts IS NULL OR jsonb_typeof(v_contacts) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_contacts)
  LOOP
    v_pwd := NULLIF(v_item->>'password', '');
    v_existing := NULLIF(v_item->>'password_hash', '');

    IF v_existing IS NULL AND TG_OP = 'UPDATE' AND OLD.contact_persons IS NOT NULL THEN
      SELECT o->>'password_hash' INTO v_existing
      FROM jsonb_array_elements(OLD.contact_persons) o
      WHERE lower(coalesce(o->>'email','')) = lower(coalesce(v_item->>'email',''))
        AND coalesce(o->>'email','') <> ''
      LIMIT 1;
      v_existing := NULLIF(v_existing, '');
    END IF;

    IF v_pwd IS NOT NULL THEN
      v_item := v_item || jsonb_build_object('password_hash', extensions.crypt(v_pwd, extensions.gen_salt('bf')));
    ELSIF v_existing IS NOT NULL THEN
      v_item := v_item || jsonb_build_object('password_hash', v_existing);
    END IF;

    v_item := v_item - 'password';
    v_result := v_result || jsonb_build_array(v_item);
  END LOOP;

  NEW.contact_persons := v_result;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garages_hash_contact_passwords ON garages;
CREATE TRIGGER garages_hash_contact_passwords
  BEFORE INSERT OR UPDATE ON garages
  FOR EACH ROW EXECUTE FUNCTION public.hash_garage_contact_passwords();

-- Backfill: re-save every row that still carries a plaintext password
UPDATE garages
SET contact_persons = contact_persons
WHERE contact_persons IS NOT NULL
  AND jsonb_typeof(contact_persons) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(contact_persons) c
    WHERE coalesce(c->>'password','') <> ''
  );

CREATE OR REPLACE FUNCTION public.verify_garage_contact_password(p_email text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_garage_id uuid;
BEGIN
  IF p_email IS NULL OR p_password IS NULL OR length(p_password) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT g.id INTO v_garage_id
  FROM garages g,
       LATERAL jsonb_array_elements(coalesce(g.contact_persons, '[]'::jsonb)) c
  WHERE g.status = 'active'
    AND lower(coalesce(c->>'email','')) = lower(p_email)
    AND coalesce(c->>'password_hash','') <> ''
    AND extensions.crypt(p_password, c->>'password_hash') = c->>'password_hash'
  LIMIT 1;

  RETURN v_garage_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_garage_contact_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_garage_contact_password(text, text) TO service_role;
