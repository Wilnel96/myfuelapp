import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read environment variables
const envPath = join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authenticate as super admin
async function authenticateAdmin() {
  console.log('Authenticating as super admin...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'willem@fleetfuel.com',
    password: 'FleetFuel2024!'
  });

  if (error) {
    console.error('Authentication failed:', error.message);
    process.exit(1);
  }

  console.log('✅ Authenticated successfully\n');
  return data;
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('INSTRUCTIONS'));

  // Parse header (can be comma or tab delimited)
  const firstLine = lines[0];
  const headerDelimiter = firstLine.includes(',') ? ',' : '\t';
  const headers = firstLine.split(headerDelimiter).map(h => h.trim());
  console.log(`Found ${headers.length} columns`);

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Auto-detect delimiter for each line (tab or comma)
    const lineDelimiter = line.includes('\t') ? '\t' : ',';
    const values = line.split(lineDelimiter).map(v => v.trim());

    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    } else {
      console.log(`Skipping line ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
    }
  }

  return rows;
}

function transformRow(row) {
  // Parse available fuel types
  const fuelTypes = row.available_fuel_types
    ? row.available_fuel_types.split('|').map(ft => ft.trim()).filter(Boolean)
    : [];

  // Parse fuel prices
  const fuelPrices = {};
  if (row.fuel_prices_petrol_95) fuelPrices.petrol_95 = parseFloat(row.fuel_prices_petrol_95);
  if (row.fuel_prices_petrol_93) fuelPrices.petrol_93 = parseFloat(row.fuel_prices_petrol_93);
  if (row.fuel_prices_diesel_50ppm) fuelPrices.diesel_50ppm = parseFloat(row.fuel_prices_diesel_50ppm);
  if (row.fuel_prices_diesel_500ppm) fuelPrices.diesel_500ppm = parseFloat(row.fuel_prices_diesel_500ppm);

  // Parse other offerings
  const otherOfferings = row.other_offerings
    ? row.other_offerings.split('|').map(o => o.trim()).filter(Boolean)
    : [];

  // Parse contacts
  const contacts = [];
  if (row.contact_1_name && row.contact_1_surname) {
    contacts.push({
      name: row.contact_1_name,
      surname: row.contact_1_surname,
      email: row.contact_1_email || null,
      office_phone: row.contact_1_office_phone || null,
      mobile_phone: row.contact_1_mobile_phone || null
    });
  }
  if (row.contact_2_name && row.contact_2_surname) {
    contacts.push({
      name: row.contact_2_name,
      surname: row.contact_2_surname,
      email: row.contact_2_email || null,
      office_phone: row.contact_2_office_phone || null,
      mobile_phone: row.contact_2_mobile_phone || null
    });
  }

  return {
    name: row.name,
    address_line_1: row.address || null,
    address_line_2: row.address_line_2 || null,
    city: row.city || null,
    province: row.province || null,
    postal_code: row.postal_code || null,
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    email_address: row.email || null,
    fuel_brand: row.fuel_brand || null,
    price_zone: row.price_zone || null,
    fuel_types: fuelTypes.length > 0 ? fuelTypes : null,
    fuel_prices: Object.keys(fuelPrices).length > 0 ? fuelPrices : null,
    other_offerings: otherOfferings.length > 0 ? otherOfferings : null,
    contact_persons: contacts.length > 0 ? contacts : null,
    vat_number: row.vat_number || null,
    password: row.password || 'TempPassword123!', // Default password if not provided
    // Bank details - all optional, garages can update later
    bank_name: row.bank_name || null,
    account_holder: row.account_holder || null,
    account_number: row.account_number || null,
    branch_code: row.branch_code || null
  };
}

async function importGarages() {
  try {
    // Authenticate first
    await authenticateAdmin();

    console.log('Reading CSV file...');
    const csvPath = join(__dirname, 'garage_import_template.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    console.log('Parsing CSV...');
    const rows = parseCSV(csvContent);
    console.log(`Found ${rows.length} garages to import\n`);

    if (rows.length === 0) {
      console.log('No garages to import. Please fill in the CSV template first.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      try {
        const garageData = transformRow(row);

        console.log(`Importing: ${garageData.name}...`);

        // Check if garage already exists (by name only, since city might be null)
        const { data: existing } = await supabase
          .from('garages')
          .select('id')
          .eq('name', garageData.name)
          .maybeSingle();

        if (existing) {
          console.log(`⚠️  Garage already exists: ${garageData.name}`);
          continue;
        }

        // Use database function to create garage with organization
        const { data, error } = await supabase.rpc('create_garage_with_organization', {
          p_garage_data: garageData,
          p_org_name: garageData.name,
          p_org_vat_number: garageData.vat_number,
          p_org_city: garageData.city,
          p_org_province: garageData.province
        });

        if (error) {
          console.error(`❌ Error importing ${garageData.name}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Successfully imported: ${garageData.name}`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error processing row:`, err.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Import complete!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (successCount > 0) {
      console.log('\n⚠️  IMPORTANT: All garages were created with default password: TempPassword123!');
      console.log('Garages should change their passwords on first login.');
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

importGarages();
