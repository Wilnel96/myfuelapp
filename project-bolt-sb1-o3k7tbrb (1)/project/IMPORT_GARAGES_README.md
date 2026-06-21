# Garage Import System - Quick Guide

## Overview

This system allows you to import hundreds or thousands of garages from a CSV file into MyFuelApp without any storage limitations.

## Your Current Database Status

- **Current size**: 16 MB (only 3% of your 500 MB limit)
- **Garages loaded**: 97 garages
- **Plenty of space available**: You can load thousands more garages!

## Why This System?

The previous issue wasn't database storage - you have plenty of room! The problem was:
- Large migration files being difficult to edit
- Request timeouts during bulk inserts
- Editor/IDE limitations

This new system solves all those issues by:
- Generating optimized SQL files
- Processing everything in one go
- Avoiding editor/IDE limitations
- Being completely safe to run multiple times

## How to Import Garages

### Step 1: Prepare Your CSV File

Create a CSV file with garage data. Minimum required columns:
- `name` (required)
- `city` (required)

See `garages_import_template.csv` for a complete example with all optional fields.

### Step 2: Run the Import Script

```bash
node import_garages.js your_file.csv
```

This will:
- Read your CSV file
- Validate all records
- Generate a SQL file (e.g., `your_file_import.sql`)
- Show you how many garages will be imported

### Step 3: Execute the SQL

**Option A: Supabase Dashboard (Recommended)**
1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Open the generated `.sql` file in a text editor
4. Copy all the SQL
5. Paste into Supabase SQL Editor
6. Click "Run" to import all garages

**Option B: Command Line (if you have psql)**
```bash
psql "your-connection-string" -f your_file_import.sql
```

## Getting Data from OpenStreetMap

Ask ChatGPT to extract garage data using this prompt:

```
Please extract fuel stations/garages from OpenStreetMap for [Western Cape, South Africa]
and format them as a CSV file with these columns:

name,street_address,city,province,latitude,longitude,fuel_brand

Requirements:
- Include only actual fuel stations/garages
- Use proper CSV formatting with header row
- Include coordinates in decimal format (e.g., -33.9249, 18.4241)
- If fuel_brand is unknown, use "Independent"
- If city is unknown, use the suburb/area name
- Province should be "Western Cape"
- Include as many garages as possible

Please provide the data in CSV format that I can directly save and import.
```

Then:
1. Save ChatGPT's response as `osm_garages.csv`
2. Run `node import_garages.js osm_garages.csv`
3. Execute the generated SQL in Supabase

## CSV Column Reference

### Required Columns
- **name**: Garage name (e.g., "Shell V&A Waterfront")
- **city**: City name (e.g., "Cape Town")

### Optional Columns
- **email**: Contact email
- **phone_number**: Phone (e.g., "0211234567")
- **street_address**: Street address
- **address_line_2**: Additional address info
- **province**: Province (default: "Western Cape")
- **postal_code**: Postal code
- **latitude**: Latitude in decimal format (e.g., -33.9249)
- **longitude**: Longitude in decimal format (e.g., 18.4241)
- **fuel_types_offered**: JSON array like `["Petrol 95","Diesel 50ppm"]`
- **fuel_brand**: Shell, BP, Engen, Sasol, Caltex, Total, or Independent
- **price_zone**: "coastal" or "inland" (default: "coastal")
- **other_offerings**: JSON array like `["Car Wash","ATM"]`
- **vat_number**: VAT registration number
- **password**: Login password (default: "garage123")

## Example CSV

```csv
name,city,street_address,latitude,longitude,fuel_brand,fuel_types_offered
Shell Bellville,Bellville,Voortrekker Road,-33.8991,18.6292,Shell,"[""Petrol 95"",""Diesel 50ppm""]"
BP Paarl,Paarl,Main Street,-33.7340,18.9582,BP,"[""Petrol 95"",""Diesel 50ppm""]"
Engen Somerset West,Somerset West,Main Road,-34.0778,18.8453,Engen,"[""Petrol 95"",""Diesel 50ppm""]"
```

## Safety Features

- **Duplicate prevention**: Garages with the same name are automatically skipped
- **Safe to re-run**: Running the same SQL file multiple times won't create duplicates
- **Validation**: Invalid records are skipped with warnings
- **No data loss**: Existing garages are never modified or deleted

## Troubleshooting

### "Missing required fields" warning
- Make sure every row has a `name` and `city`
- Check for empty cells in required columns

### "Could not parse JSON" warning
- Use proper JSON format with double quotes: `["value1","value2"]`
- Common fields: `fuel_types_offered` and `other_offerings`

### Coordinates not showing on map
- Use decimal format: -33.9249 (not degrees/minutes/seconds)
- Western Cape coordinates: latitude around -33 to -34, longitude around 18 to 23
- Remove any degree symbols (°)

### SQL execution errors
- Make sure you're running the SQL in the Supabase SQL Editor
- Check that the `.sql` file was generated successfully
- Look for any syntax errors in the output

## Performance Tips

- CSV files with 500-1000 garages process in seconds
- SQL execution in Supabase takes a few seconds for hundreds of garages
- No need to split large files - the system handles large batches efficiently

## What Happens After Import

Once imported, garages can:
- Log in to the Garage Portal using their email and password (default: "garage123")
- Update their profile information
- Add contact persons
- Set fuel prices
- View and manage transactions from drivers

## Need Help?

1. Check `garages_import_template.csv` for correct format
2. Review the generated `.sql` file for any issues
3. Look at the console output for specific error messages
4. See `GARAGE_CSV_IMPORT_GUIDE.md` for detailed documentation

## Files in This System

- `import_garages.js` - Main import script
- `garages_import_template.csv` - Template with examples
- `GARAGE_CSV_IMPORT_GUIDE.md` - Detailed documentation
- `IMPORT_GARAGES_README.md` - This quick guide
- `example_garages.csv` - Working example with 4 garages
- `example_garages_import.sql` - Generated SQL example
