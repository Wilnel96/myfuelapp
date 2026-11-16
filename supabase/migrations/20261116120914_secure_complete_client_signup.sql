-- Security fix (F8): complete_client_signup is SECURITY DEFINER and executable by
-- every authenticated user, but took the subject user id from its argument and
-- never compared it to the caller. Any signed-in user could therefore rewrite
-- another company's details. Bind the argument to the caller's own identity
-- (service_role keeps working because auth.uid() is null there).

CREATE OR REPLACE FUNCTION public.complete_client_signup(
  p_user_id uuid,
  p_registration_number text DEFAULT NULL::text,
  p_vat_number text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_phone_number text DEFAULT NULL::text,
  p_address_line_1 text DEFAULT NULL::text,
  p_address_line_2 text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_province text DEFAULT NULL::text,
  p_postal_code text DEFAULT NULL::text,
  p_payment_option text DEFAULT NULL::text,
  p_mobile_phone text DEFAULT NULL::text,
  p_id_number text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_org_id uuid;
BEGIN
IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
  RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
END IF;

SELECT organization_id INTO v_org_id FROM profiles WHERE id = p_user_id;

IF v_org_id IS NULL THEN
RETURN jsonb_build_object('success', false, 'error', 'No organization found for user');
END IF;

UPDATE organizations SET
company_registration_number = COALESCE(NULLIF(p_registration_number, ''), company_registration_number),
vat_number                  = COALESCE(NULLIF(p_vat_number, ''), vat_number),
phone_number                = COALESCE(NULLIF(p_phone_number, ''), phone_number),
address_line_1              = COALESCE(NULLIF(p_address_line_1, ''), address_line_1),
address_line_2              = COALESCE(NULLIF(p_address_line_2, ''), address_line_2),
city                        = COALESCE(NULLIF(p_city, ''), city),
province                    = COALESCE(NULLIF(p_province, ''), province),
postal_code                 = COALESCE(NULLIF(p_postal_code, ''), postal_code),
payment_option              = COALESCE(NULLIF(p_payment_option, ''), payment_option),
organization_type           = 'client',
is_management_org           = false
WHERE id = v_org_id;

UPDATE organization_users SET
email        = COALESCE(NULLIF(p_email, ''), email),
phone_mobile = COALESCE(NULLIF(p_mobile_phone, ''), phone_mobile),
id_number    = COALESCE(NULLIF(p_id_number, ''), id_number)
WHERE user_id = p_user_id AND organization_id = v_org_id;

RETURN jsonb_build_object('success', true, 'organization_id', v_org_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_client_signup(
  p_user_id uuid,
  p_registration_number text DEFAULT NULL::text,
  p_vat_number text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_phone_number text DEFAULT NULL::text,
  p_address_line_1 text DEFAULT NULL::text,
  p_address_line_2 text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_province text DEFAULT NULL::text,
  p_postal_code text DEFAULT NULL::text,
  p_payment_option text DEFAULT NULL::text,
  p_mobile_phone text DEFAULT NULL::text,
  p_id_number text DEFAULT NULL::text,
  p_account_type text DEFAULT 'company'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_org_id uuid;
BEGIN
IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
  RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
END IF;

SELECT organization_id INTO v_org_id FROM profiles WHERE id = p_user_id;

IF v_org_id IS NULL THEN
RETURN jsonb_build_object('success', false, 'error', 'No organization found for user');
END IF;

UPDATE organizations SET
company_registration_number = COALESCE(NULLIF(p_registration_number, ''), company_registration_number),
vat_number                  = COALESCE(NULLIF(p_vat_number, ''), vat_number),
phone_number                = COALESCE(NULLIF(p_phone_number, ''), phone_number),
address_line_1              = COALESCE(NULLIF(p_address_line_1, ''), address_line_1),
address_line_2              = COALESCE(NULLIF(p_address_line_2, ''), address_line_2),
city                        = COALESCE(NULLIF(p_city, ''), city),
province                    = COALESCE(NULLIF(p_province, ''), province),
postal_code                 = COALESCE(NULLIF(p_postal_code, ''), postal_code),
payment_option              = COALESCE(NULLIF(p_payment_option, ''), payment_option),
account_type                = COALESCE(NULLIF(p_account_type, ''), 'company'),
organization_type           = 'client',
is_management_org           = false
WHERE id = v_org_id;

UPDATE organization_users SET
email        = COALESCE(NULLIF(p_email, ''), email),
phone_mobile = COALESCE(NULLIF(p_mobile_phone, ''), phone_mobile),
id_number    = COALESCE(NULLIF(p_id_number, ''), id_number)
WHERE user_id = p_user_id AND organization_id = v_org_id;

RETURN jsonb_build_object('success', true, 'organization_id', v_org_id);
END;
$function$;
