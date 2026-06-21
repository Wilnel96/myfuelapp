# Garage Import Guide

This guide explains how to import real garage data into your MyFuelApp system.

## Step 1: Get the CSV Template

The file `garage_import_template.csv` contains:
- All required column headers
- 2 example rows showing the format
- Detailed instructions at the bottom

## Step 2: Ask ChatGPT to Complete It

Use this prompt with ChatGPT:

```
I need you to fill out a CSV file with garage/fuel station data for South Africa.

The CSV has these columns:
name,address,address_line_2,city,province,postal_code,latitude,longitude,email,fuel_brand,price_zone,available_fuel_types,fuel_prices_petrol_95,fuel_prices_petrol_93,fuel_prices_diesel_50ppm,fuel_prices_diesel_500ppm,other_offerings,contact_1_name,contact_1_surname,contact_1_email,contact_1_office_phone,contact_1_mobile_phone,contact_2_name,contact_2_surname,contact_2_email,contact_2_office_phone,contact_2_mobile_phone,vat_number,bank_name,account_holder,account_number,branch_code

Please provide at least 20-30 fuel stations across major South African cities (Johannesburg, Cape Town, Durban, Pretoria, Port Elizabeth, Bloemfontein).

IMPORTANT: Only the "name" field is required. All other fields are optional - fill in what you can and leave the rest empty.

Requirements (when providing data):
1. Use fuel brands: Shell, BP, Engen, Sasol, Total, Caltex
2. Include GPS coordinates if possible
3. Use realistic South African addresses
4. Mobile numbers format: 082 123 4567
5. Province (if known): Gauteng, Western Cape, KwaZulu-Natal, Eastern Cape, Free State, Limpopo, Mpumalanga, Northern Cape, North West
6. Price zone: "Inland" or "Coastal"
7. Available fuel types: Use pipe separator like "Petrol 95|Diesel 50ppm"
8. Fuel prices: Current realistic SA prices per liter (around R23-25)
9. Other offerings: Use pipe separator like "Car Wash|Convenience Store|ATM"
10. VAT numbers: 10 digits

Don't worry if you can't fill all fields - garages can update their information later.
```

## Step 3: Clean the CSV

After ChatGPT provides the data:
1. Copy the CSV content
2. Open `garage_import_template.csv`
3. **Delete the example rows** (keep only the header row)
4. Paste the ChatGPT-generated data below the headers
5. Remove the "INSTRUCTIONS" section at the bottom
6. Save the file

## Step 4: Import the Data

Run the import script:

```bash
node import_garages_from_csv.js
```

The script will:
- ✅ Read the CSV file
- ✅ Parse all garage data
- ✅ Check for duplicates
- ✅ Insert garages into the database
- ✅ Report success/errors

## Step 5: Update Default Passwords

**IMPORTANT:** All imported garages will have the default password: `TempPassword123!`

You should:
1. Notify each garage of their account
2. Provide them with the temporary password
3. Instruct them to change it on first login

## Alternative: Manual Import

If you prefer to add garages manually through the UI:
1. Log in as Management org user
2. Go to "Garage Management"
3. Click "Add New Garage"
4. Fill in all details
5. Save

## CSV Field Reference

### Required Fields
- `name` - Garage name (ONLY field required)

### Optional Fields
All other fields are optional! Import garages with minimal information and they can update their details later once operational.

#### Location Fields (Optional)
- `address` - Street address
- `address_line_2` - Additional address info
- `city` - City name
- `province` - SA province name
- `latitude` - GPS latitude (negative for South)
- `longitude` - GPS longitude (positive for East)
- `postal_code` - SA postal code

#### Fuel Information (Optional)
- `fuel_brand` - Shell, BP, Engen, Sasol, Total, Caltex
- `price_zone` - Inland or Coastal
- `available_fuel_types` - Pipe-separated: `Petrol 95|Diesel 50ppm`
- `fuel_prices_*` - Price per liter in Rands

#### Contact Information (Optional)
- `email` - Main email
- `contact_1_*` - Primary contact person
- `contact_2_*` - Secondary contact person

#### Banking Information (Optional)
- `bank_name` - Bank name
- `account_holder` - Account holder name
- `account_number` - Bank account number
- `branch_code` - Bank branch code

#### Additional (Optional)
- `other_offerings` - Pipe-separated services
- `vat_number` - 10-digit VAT number
- `password` - Custom password (defaults to TempPassword123!)

## Troubleshooting

### "Missing Supabase credentials"
Make sure your `.env` file has:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### "Authentication failed"
The script authenticates as the super admin user (willem@fleetfuel.com). If this fails, check the credentials in the script.

### "Garage already exists"
The script checks for duplicates by name. If a garage already exists, it will be skipped.

### "Error importing garage"
Check the error message. Common issues:
- Invalid province name
- Missing required fields
- Invalid data format

### CSV parsing errors
Make sure:
- No commas in text fields (or wrap in quotes)
- All rows have the same number of columns
- No empty lines in the middle of data

## Notes

- The import script authenticates as super admin to create garages
- Only the garage `name` is required - all other fields are optional
- Garages can update their information later once operational
- You can re-run the import script - it will skip duplicates
- Each garage gets its own organization record automatically
- Consider backing up your database before importing large datasets
