// Explicit column list for garage queries.
// The legacy `password` column is intentionally excluded: it is no longer
// readable by the application roles.
export const GARAGE_COLUMNS_STRING = [
  'id',
  'organization_id',
  'name',
  'address_line_1',
  'address_line_2',
  'city',
  'province',
  'postal_code',
  'country',
  'latitude',
  'longitude',
  'email_address',
  'contact_persons',
  'bank_name',
  'account_holder',
  'account_number',
  'branch_code',
  'commission_rate',
  'fuel_brand',
  'fuel_types',
  'price_zone',
  'status',
  'created_at',
  'updated_at',
  'fuel_prices',
  'other_offerings',
  'vat_number',
  'phone_number',
  'company_registration_number',
  'garage_capabilities',
  'client_org_id',
] as const;

export const GARAGE_COLUMNS = GARAGE_COLUMNS_STRING.join(', ');

