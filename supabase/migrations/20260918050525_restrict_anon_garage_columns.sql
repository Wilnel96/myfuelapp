-- F2: the anonymous garage directory exposed garage portal password hashes and bank details.
-- Keep the directory rows readable (drivers need every garage) but remove the secret columns.

REVOKE SELECT ON public.garages FROM anon;

GRANT SELECT (
  id,
  organization_id,
  name,
  address_line_1,
  address_line_2,
  city,
  province,
  postal_code,
  country,
  latitude,
  longitude,
  email_address,
  phone_number,
  contact_persons,
  commission_rate,
  fuel_brand,
  fuel_types,
  fuel_prices,
  other_offerings,
  garage_capabilities,
  price_zone,
  vat_number,
  status,
  created_at,
  updated_at
) ON public.garages TO anon;
