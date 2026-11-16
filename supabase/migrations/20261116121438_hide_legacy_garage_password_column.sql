/*
  # Hide the legacy garages.password column

  1. Problem
     - garages.password held a legacy plaintext portal password in 57 rows and was
       readable by every signed-in user. No application code reads it.

  2. Changes
     - Clear the stored values.
     - Replace the table-level SELECT grant for authenticated with a column-level
       grant that omits `password`.
*/

UPDATE garages SET password = NULL WHERE password IS NOT NULL;

REVOKE SELECT ON public.garages FROM authenticated;

GRANT SELECT (
  id, organization_id, name, address_line_1, address_line_2, city, province,
  postal_code, country, latitude, longitude, email_address, contact_persons,
  bank_name, account_holder, account_number, branch_code, commission_rate,
  fuel_brand, fuel_types, price_zone, status, created_at, updated_at,
  fuel_prices, other_offerings, vat_number, phone_number,
  company_registration_number, garage_capabilities, client_org_id
) ON public.garages TO authenticated;
