const fs = require('fs');
const { records } = require('./totalenergies_records.cjs');

const email = (value) => value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value.toLowerCase() : null;
const phone = (value) => value && /^\d{7,15}$/.test(value) ? value : null;
const contactFor = (row) => {
  const contacts = [{
    name: row.first || null,
    surname: row.surname || null,
    email: email(row.email),
    mobile_phone: phone(row.mobile),
    office_phone: phone(row.office)
  }];
  if (row.manager) contacts.push({ name: row.manager, surname: null, email: null, mobile_phone: phone(row.managerMobile), office_phone: null });
  return contacts;
};
const data = records.map((row) => ({
  name: row.name,
  address_line_1: row.address1 || null,
  address_line_2: row.address2 || null,
  city: row.city || null,
  postal_code: row.postal || null,
  province: row.province || null,
  email_address: email(row.email),
  phone_number: phone(row.office) || phone(row.mobile),
  contact_persons: contactFor(row),
  latitude: row.latitude ?? null,
  longitude: row.longitude ?? null
}));
const json = JSON.stringify(data).replace(/\$\$/g, '\\u0024\\u0024');
const sql = `/* TotalEnergies spreadsheet import: pending garage records with blank unknown fields. */
CREATE TEMP TABLE totalenergies_import_data (
  name text NOT NULL,
  address_line_1 text,
  address_line_2 text,
  city text,
  postal_code text,
  province text,
  email_address text,
  phone_number text,
  contact_persons jsonb,
  latitude numeric,
  longitude numeric
) ON COMMIT DROP;

INSERT INTO totalenergies_import_data
SELECT * FROM jsonb_to_recordset($json$${json}$json$::jsonb)
AS rows(name text, address_line_1 text, address_line_2 text, city text, postal_code text, province text, email_address text, phone_number text, contact_persons jsonb, latitude numeric, longitude numeric);

INSERT INTO public.organizations (name, organization_type, is_management_org, status)
SELECT d.name, 'garage', false, 'active'
FROM totalenergies_import_data d
WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE lower(o.name) = lower(d.name));

INSERT INTO public.garages (
  organization_id, name, address_line_1, address_line_2, city, province, postal_code,
  latitude, longitude, email_address, contact_persons, phone_number,
  fuel_types, fuel_brand, price_zone, other_offerings, status
)
SELECT o.id, d.name, d.address_line_1, d.address_line_2, d.city, d.province, d.postal_code,
  d.latitude, d.longitude, d.email_address, d.contact_persons, d.phone_number,
  NULL, NULL, NULL, NULL, 'pending'
FROM totalenergies_import_data d
JOIN public.organizations o ON lower(o.name) = lower(d.name)
WHERE NOT EXISTS (SELECT 1 FROM public.garages g WHERE lower(g.name) = lower(d.name));

SELECT count(*) AS imported_pending_garages
FROM public.garages g
JOIN totalenergies_import_data d ON lower(g.name) = lower(d.name)
WHERE g.status = 'pending';`;
fs.writeFileSync('totalenergies_import.sql', sql);
console.log(`Prepared ${records.length} spreadsheet rows with ${records.filter((row) => email(row.email)).length} valid email addresses.`);