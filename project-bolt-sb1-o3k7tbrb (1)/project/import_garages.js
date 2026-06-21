#!/usr/bin/env node

/**
 * Garage CSV Import Script
 *
 * This script imports garages from a CSV file into the MyFuelApp database.
 * It processes the CSV file and generates the appropriate SQL for batch insertion.
 *
 * Usage:
 *   node import_garages.js <csv_file>
 *
 * Example:
 *   node import_garages.js my_garages.csv
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { join } from 'path';

// Parse CSV file
function parseCSV(filePath) {
  console.log(`📖 Reading CSV file: ${filePath}`);
  const fileContent = readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: false, // Keep everything as strings for better control
    cast_date: false
  });
  console.log(`✅ Found ${records.length} records in CSV\n`);
  return records;
}

// Escape single quotes for SQL
function escapeSql(str) {
  if (!str || str === '' || str.toLowerCase() === 'null') return null;
  return str.replace(/'/g, "''");
}

// Parse JSON field from CSV
function parseJsonField(value, fieldName, defaultValue = []) {
  if (!value || value === '' || value.toLowerCase() === 'null') {
    return defaultValue;
  }

  try {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value;
  } catch (e) {
    console.warn(`⚠️  Warning: Could not parse ${fieldName}: ${value}`);
    return defaultValue;
  }
}

// Generate SQL INSERT statements with ON CONFLICT to avoid duplicates
function generateBatchSQL(records) {
  const sqlStatements = [];
  let validCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowNum = i + 1;

    // Required fields
    const name = record.name || record.garage_name;
    const city = record.city;

    if (!name || !city) {
      console.warn(`⚠️  Row ${rowNum}: Skipping - missing required fields (name or city)`);
      skippedCount++;
      continue;
    }

    // Optional fields with defaults
    const email = escapeSql(record.email);
    const phoneNumber = escapeSql(record.phone_number || record.phone);
    const streetAddress = escapeSql(record.street_address || record.address);
    const addressLine2 = escapeSql(record.address_line_2);
    const province = escapeSql(record.province) || 'Western Cape';
    const postalCode = escapeSql(record.postal_code || record.zip_code);

    // Coordinates
    const latitude = record.latitude && record.latitude !== '' ? parseFloat(record.latitude) : null;
    const longitude = record.longitude && record.longitude !== '' ? parseFloat(record.longitude) : null;

    // JSON fields
    const fuelTypes = parseJsonField(record.fuel_types_offered, 'fuel_types_offered', ['Petrol 95', 'Diesel 50ppm']);
    const otherOfferings = parseJsonField(record.other_offerings, 'other_offerings', []);

    // Other fields
    const fuelBrand = escapeSql(record.fuel_brand) || 'Independent';
    const priceZone = escapeSql(record.price_zone) || 'coastal';
    const vatNumber = escapeSql(record.vat_number);
    const password = escapeSql(record.password) || 'garage123';

    // Convert fuel types from jsonb array to text array
    const fuelTypesArray = fuelTypes.map(ft => `"${ft}"`).join(',');

    // Build SQL INSERT with check for existing garage
    const sql = `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM garages WHERE name = '${escapeSql(name)}') THEN
    INSERT INTO garages (
      organization_id, name, email_address, address_line_1, address_line_2,
      city, province, postal_code, latitude, longitude,
      fuel_types, fuel_brand, price_zone, other_offerings,
      vat_number, password, status
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      '${escapeSql(name)}',
      ${email ? `'${email}'` : 'NULL'},
      ${streetAddress ? `'${streetAddress}'` : 'NULL'},
      ${addressLine2 ? `'${addressLine2}'` : 'NULL'},
      '${escapeSql(city)}',
      '${province}',
      ${postalCode ? `'${postalCode}'` : 'NULL'},
      ${latitude !== null ? latitude : 'NULL'},
      ${longitude !== null ? longitude : 'NULL'},
      ARRAY[${fuelTypesArray}]::text[],
      '${fuelBrand}',
      '${priceZone}',
      '${JSON.stringify(otherOfferings)}'::jsonb,
      ${vatNumber ? `'${vatNumber}'` : 'NULL'},
      '${password}',
      'active'
    );
  END IF;
END $$;`;

    sqlStatements.push(sql);
    validCount++;
  }

  console.log(`✅ Generated SQL for ${validCount} garages`);
  if (skippedCount > 0) {
    console.log(`⚠️  Skipped ${skippedCount} invalid records\n`);
  }

  return sqlStatements.join('\n\n');
}

// Main execution
async function main() {
  const csvFilePath = process.argv[2];

  if (!csvFilePath) {
    console.error('❌ Error: No CSV file specified\n');
    console.log('Usage: node import_garages.js <csv_file>\n');
    console.log('Example: node import_garages.js my_garages.csv');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('🚗 MyFuelApp - Garage CSV Import Tool');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Parse CSV
    const records = parseCSV(csvFilePath);

    if (records.length === 0) {
      console.error('❌ Error: CSV file is empty or has no valid records');
      process.exit(1);
    }

    // Generate SQL
    console.log('🔨 Generating SQL statements...');
    const sql = generateBatchSQL(records);

    // Save to file
    const outputFile = csvFilePath.replace('.csv', '_import.sql');
    writeFileSync(outputFile, sql, 'utf-8');

    console.log('='.repeat(70));
    console.log('✅ SUCCESS! SQL import file generated');
    console.log('='.repeat(70));
    console.log('');
    console.log(`📄 SQL File: ${outputFile}`);
    console.log('');
    console.log('📋 Next Steps:');
    console.log('');
    console.log('Option 1 - Copy & paste in Supabase Dashboard:');
    console.log('  1. Open the Supabase Dashboard');
    console.log('  2. Go to SQL Editor');
    console.log(`  3. Open the file: ${outputFile}`);
    console.log('  4. Copy the SQL and paste it into the editor');
    console.log('  5. Click "Run" to import all garages');
    console.log('');
    console.log('Option 2 - Use command line (if you have psql):');
    console.log(`  psql "your-connection-string" -f ${outputFile}`);
    console.log('');
    console.log('💡 The SQL uses ON CONFLICT DO NOTHING, so running it multiple');
    console.log('   times is safe - duplicates will be automatically skipped.');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    if (error.code === 'ENOENT') {
      console.error(`File not found: ${csvFilePath}`);
      console.error('Please check the file path and try again.');
    }
    process.exit(1);
  }
}

// Run the script
main();
