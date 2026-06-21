# Garage CSV Import Guide

This guide explains how to import garages into MyFuelApp using CSV files.

## Quick Start

1. **Prepare your CSV file** using the template format (see `garages_import_template.csv`)
2. **Run the import script**:
   ```bash
   node import_garages.js your_garages.csv
   ```
3. **Copy the generated SQL** from the `your_garages_import.sql` file
4. **Paste and run** in Supabase SQL Editor

The script will generate a SQL file that you can run in Supabase to import all garages at once.

## CSV File Format

Your CSV file should have the following columns:

### Required Columns
- **name**: Garage name (required)
- **city**: City name (required)

### Optional Columns
- **email**: Contact email
- **phone_number**: Phone number (e.g., 0211234567)
- **street_address**: Street address
- **address_line_2**: Additional address info (suite, unit, etc.)
- **province**: Province (default: "Western Cape")
- **postal_code**: Postal/ZIP code
- **latitude**: Latitude coordinate (decimal format, e.g., -33.9249)
- **longitude**: Longitude coordinate (decimal format, e.g., 18.4241)
- **fuel_types_offered**: JSON array of fuel types (default: ["Petrol 95", "Diesel 50ppm"])
- **fuel_brand**: Brand name (Shell, BP, Engen, Sasol, Caltex, Total, Independent, etc.)
- **price_zone**: "coastal" or "inland" (default: "coastal")
- **other_offerings**: JSON array of services (e.g., ["Car Wash", "Convenience Store"])
- **vat_number**: VAT registration number
- **password**: Login password (default: "garage123")

## Example CSV

```csv
name,email,phone_number,street_address,city,province,postal_code,latitude,longitude,fuel_types_offered,fuel_brand,price_zone
Shell V&A Waterfront,shell.va@example.com,0214185000,Dock Road,Cape Town,Western Cape,8001,-33.9025,18.4187,"[""Petrol 95"",""Diesel 50ppm"",""Petrol 93""]",Shell,coastal
BP Claremont,bp.claremont@example.com,0216837000,Main Road,Cape Town,Western Cape,7708,-33.9817,18.4647,"[""Petrol 95"",""Diesel 50ppm""]",BP,coastal
```

## Getting Data from OpenStreetMap (via ChatGPT)

When asking ChatGPT to extract garage data from OpenStreetMap, use this prompt:

```
Please extract fuel stations/garages from OpenStreetMap for [AREA/REGION] and format them as a CSV file with these columns:

name,street_address,city,province,postal_code,latitude,longitude,fuel_brand

Requirements:
- Include only actual fuel stations/garages
- Use proper CSV formatting
- Include coordinates in decimal format
- If fuel_brand is unknown, use "Independent"
- If city is unknown, use the suburb/area name
- Include as many garages as possible

Please provide the data in CSV format that I can directly save and import.
```

## Advanced Usage

### Batch Processing
The script automatically processes garages in batches of 50 to avoid timeouts. You can modify the batch size in the script if needed.

### Fuel Types Format
Fuel types should be a JSON array. Valid options:
- "Petrol 93"
- "Petrol 95"
- "Diesel 50ppm"
- "Diesel 500ppm"

Example: `"[""Petrol 95"",""Diesel 50ppm""]"`

### Other Offerings Format
Services should be a JSON array. Common options:
- "Car Wash"
- "Convenience Store"
- "ATM"
- "Air Pump"
- "Repair Services"

Example: `"[""Car Wash"",""Convenience Store"",""ATM""]"`

### Fuel Prices (Optional)
You can include fuel prices as a JSON object:

```csv
name,city,fuel_prices
Example Garage,Cape Town,"{""Petrol 95"": 23.50, ""Diesel 50ppm"": 21.80}"
```

### Contacts (Optional)
You can include multiple contacts as a JSON array:

```csv
name,city,contacts
Example Garage,Cape Town,"[{""name"": ""John"", ""surname"": ""Doe"", ""email"": ""john@example.com"", ""phone_number"": ""0821234567""}]"
```

## Troubleshooting

### Common Issues

1. **"City is required" error**
   - Make sure every row has a value in the `city` column
   - If suburb/area is all you have, use that in the city field

2. **"Invalid fuel_types_offered" error**
   - Ensure JSON arrays use double quotes: `"[""Petrol 95""]"`
   - Don't use single quotes in CSV JSON fields

3. **Coordinate format errors**
   - Use decimal format: -33.9249 (not degrees/minutes/seconds)
   - Remove any degree symbols (°)
   - Western Cape latitudes are negative (around -33 to -34)
   - Western Cape longitudes are positive (around 18 to 23)

4. **"Duplicate garage" errors**
   - The script checks for existing garages by name
   - If a garage already exists, it will be skipped

## Examples

### Simple Import (Minimal Data)
```csv
name,city
Shell Bellville,Bellville
BP Paarl,Paarl
Engen Somerset West,Somerset West
```

### Full Import (Complete Data)
```csv
name,email,phone_number,street_address,city,province,postal_code,latitude,longitude,fuel_types_offered,fuel_brand,price_zone,other_offerings
Shell Bellville,shell.bellville@example.com,0219487000,Voortrekker Road,Bellville,Western Cape,7530,-33.8991,18.6292,"[""Petrol 95"",""Diesel 50ppm"",""Petrol 93""]",Shell,coastal,"[""Car Wash"",""Convenience Store""]"
BP Paarl,bp.paarl@example.com,0218729000,Main Street,Paarl,Western Cape,7646,-33.7340,18.9582,"[""Petrol 95"",""Diesel 50ppm""]",BP,inland,"[""Car Wash""]"
```

## Running the Import

```bash
# Import from specific file (generates SQL)
node import_garages.js my_garages.csv

# This creates: my_garages_import.sql

# Then run the SQL in Supabase SQL Editor or via psql
```

## What Happens During Import

1. CSV file is parsed and validated
2. SQL INSERT statements are generated for each garage
3. Duplicate checking is built-in (checks garage name)
4. A `.sql` file is created with all the INSERT statements
5. You run the SQL file in Supabase to import all garages at once
6. Safe to run multiple times - duplicates are automatically skipped

## Post-Import

After importing, garages can:
- Log in to the Garage Portal using their email and password
- Update their profile and contact information
- Set fuel prices
- View transactions from drivers
- Manage their local accounts

## Support

If you encounter issues:
1. Check the CSV format matches the template
2. Verify required columns (name, city) have values
3. Look at the error messages for specific issues
4. Check the template file: `garages_import_template.csv`
