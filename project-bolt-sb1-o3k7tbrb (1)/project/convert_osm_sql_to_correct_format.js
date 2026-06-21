#!/usr/bin/env node

/**
 * Converts OSM-style SQL INSERT statements to the correct format for MyFuelApp database
 *
 * Usage:
 *   1. Save your SQL file as 'osm_garages.sql' in the project folder
 *   2. Run: node convert_osm_sql_to_correct_format.js osm_garages.sql
 *   3. Import the generated file into Supabase SQL Editor
 */

import { readFileSync, writeFileSync } from 'fs';

function convertSQL(inputFile) {
  console.log('📖 Reading SQL file...');
  const content = readFileSync(inputFile, 'utf-8');

  // Split into individual INSERT statements
  const statements = content.split(/INSERT INTO garages/i).filter(s => s.trim());

  const convertedStatements = [];
  let successCount = 0;
  let skipCount = 0;

  console.log(`Found ${statements.length} INSERT statements\n`);

  for (const stmt of statements) {
    try {
      const converted = convertStatement('INSERT INTO garages' + stmt);
      if (converted) {
        convertedStatements.push(converted);
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`Converted ${successCount} statements...`);
        }
      } else {
        skipCount++;
      }
    } catch (error) {
      console.warn(`⚠️  Skipped statement due to error: ${error.message}`);
      skipCount++;
    }
  }

  console.log(`\n✅ Successfully converted: ${successCount}`);
  console.log(`⚠️  Skipped: ${skipCount}`);

  // Generate output
  const outputFile = inputFile.replace('.sql', '_converted.sql');
  const output = `-- Converted Garage Import for MyFuelApp
-- Generated: ${new Date().toISOString()}
-- Total garages: ${successCount}

${convertedStatements.join('\n\n')}
`;

  writeFileSync(outputFile, output, 'utf-8');

  console.log(`\n📄 Output saved to: ${outputFile}`);
  console.log(`\n🚀 Next steps:`);
  console.log(`   1. Open Supabase SQL Editor`);
  console.log(`   2. Copy and paste the contents of ${outputFile}`);
  console.log(`   3. Run the SQL`);
}

function convertStatement(stmt) {
  // Extract VALUES content
  const valuesMatch = stmt.match(/VALUES\s*\((.*?)\)\s*(?:ON CONFLICT|;|$)/is);
  if (!valuesMatch) return null;

  const valuesStr = valuesMatch[1];
  const values = parseValues(valuesStr);

  if (!values.name || !values.city) {
    return null; // Skip if missing required fields
  }

  return generateSQL(values);
}

function parseValues(valuesStr) {
  const parts = [];
  let current = '';
  let inString = false;
  let inArray = false;
  let bracketDepth = 0;
  let escapeNext = false;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      current += char;
      continue;
    }

    if (char === "'" && !escapeNext) {
      inString = !inString;
      current += char;
    } else if (char === '{' && !inString) {
      inArray = true;
      bracketDepth++;
      current += char;
    } else if (char === '}' && !inString) {
      bracketDepth--;
      if (bracketDepth === 0) inArray = false;
      current += char;
    } else if (char === ',' && !inString && !inArray) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  // Clean and map values
  const cleanValue = (val) => {
    if (!val) return null;
    val = val.trim();
    if (val === 'NULL' || val === "''") return null;
    if (val.startsWith("'") && val.endsWith("'")) {
      return val.slice(1, -1).replace(/''/g, "'");
    }
    return val;
  };

  const cleanArray = (val) => {
    if (!val) return null;
    val = val.trim();
    if (val.includes('::text[]')) {
      val = val.replace('::text[]', '').trim();
    }
    return val;
  };

  return {
    name: cleanValue(parts[1]),
    address_line_1: cleanValue(parts[2]) || '',
    address_line_2: cleanValue(parts[3]) || '',
    city: cleanValue(parts[4]) || 'Unknown',
    province: cleanValue(parts[5]) || 'Western Cape',
    postal_code: cleanValue(parts[6]) || '',
    latitude: parts[8]?.trim(),
    longitude: parts[9]?.trim(),
    email_address: cleanValue(parts[10]),
    contact_persons: parts[11]?.trim() || '[]',
    fuel_brand: cleanValue(parts[18]) || 'Independent',
    fuel_types: cleanArray(parts[19]) || "'{}'",
    price_zone: cleanValue(parts[21]) || 'coastal',
    vat_number: cleanValue(parts[16]) || ''
  };
}

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

function generateSQL(values) {
  const name = escapeSql(values.name);
  const addressLine1 = values.address_line_1 ? `'${escapeSql(values.address_line_1)}'` : 'NULL';
  const addressLine2 = values.address_line_2 ? `'${escapeSql(values.address_line_2)}'` : 'NULL';
  const city = escapeSql(values.city);
  const province = escapeSql(values.province);
  const postalCode = values.postal_code ? `'${escapeSql(values.postal_code)}'` : 'NULL';
  const email = values.email_address ? `'${escapeSql(values.email_address)}'` : 'NULL';
  const fuelBrand = escapeSql(values.fuel_brand);
  const priceZone = escapeSql(values.price_zone);
  const vatNumber = values.vat_number ? `'${escapeSql(values.vat_number)}'` : 'NULL';

  return `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM garages
    WHERE name = '${name}'
    AND city = '${city}'
    ${values.latitude ? `AND latitude = ${values.latitude}` : ''}
  ) THEN
    INSERT INTO garages (
      organization_id,
      name,
      email_address,
      address_line_1,
      address_line_2,
      city,
      province,
      postal_code,
      latitude,
      longitude,
      fuel_types,
      fuel_brand,
      price_zone,
      other_offerings,
      vat_number,
      password,
      status,
      contact_persons
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      '${name}',
      ${email},
      ${addressLine1},
      ${addressLine2},
      '${city}',
      '${province}',
      ${postalCode},
      ${values.latitude || 'NULL'},
      ${values.longitude || 'NULL'},
      ${values.fuel_types}::text[],
      '${fuelBrand}',
      '${priceZone}',
      '{}'::jsonb,
      ${vatNumber},
      'garage123',
      'active',
      ${values.contact_persons}::jsonb
    );
  END IF;
END $$;`;
}

// Run
const inputFile = process.argv[2];

if (!inputFile) {
  console.error('❌ Error: No input file specified\n');
  console.error('Usage: node convert_osm_sql_to_correct_format.js <input.sql>\n');
  console.error('Example: node convert_osm_sql_to_correct_format.js osm_garages.sql');
  process.exit(1);
}

try {
  convertSQL(inputFile);
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
