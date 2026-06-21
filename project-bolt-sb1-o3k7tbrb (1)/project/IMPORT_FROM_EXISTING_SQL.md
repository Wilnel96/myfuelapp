# Import Garages from OSM-Style SQL

Your SQL file has INSERT statements in this format:

```sql
INSERT INTO garages (organization_id, name, address_line_1, ...)
VALUES ('00000000-0000-0000-0000-000000000000', 'Astron Energy', '', '', ...)
ON CONFLICT DO NOTHING;
```

This won't work directly with MyFuelApp. Here's how to convert and import it:

## Step-by-Step Instructions

### Step 1: Save Your SQL File

Save all your INSERT statements as a file named `osm_garages.sql` in the project folder.

### Step 2: Run the Conversion Script

```bash
node convert_osm_sql_to_correct_format.js osm_garages.sql
```

This will:
- Read your SQL file
- Convert each INSERT statement to the correct format
- Create a new file called `osm_garages_converted.sql`
- Show you progress and statistics

### Step 3: Import to Supabase

1. Open your **Supabase SQL Editor**
2. Open the generated file `osm_garages_converted.sql`
3. Copy all the contents
4. Paste into Supabase SQL Editor
5. Click **Run**

The script will:
- Check if each garage already exists (by name, city, and coordinates)
- Only insert garages that don't exist yet
- Link all garages to your Management organization
- Set default password as `garage123` (garages can change this later)

## What Gets Converted

The script extracts and converts:
- ✅ Garage name
- ✅ Address (line 1, line 2, city, province, postal code)
- ✅ Coordinates (latitude, longitude)
- ✅ Contact information (phone numbers from contact_persons JSON)
- ✅ Fuel types and brand
- ✅ Price zone
- ✅ VAT number

## Example Conversion

**Your format:**
```sql
INSERT INTO garages (organization_id, name, address_line_1, ...)
VALUES ('00000000-0000-0000-0000-000000000000', 'Shell', 'Main Road', ...)
```

**Converted format:**
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM garages
    WHERE name = 'Shell'
    AND city = 'Cape Town'
    AND latitude = -33.9025
  ) THEN
    INSERT INTO garages (
      organization_id,
      name,
      address_line_1,
      city,
      province,
      latitude,
      longitude,
      fuel_types,
      fuel_brand,
      price_zone,
      status,
      password
    ) VALUES (
      (SELECT id FROM organizations WHERE organization_type = 'management' LIMIT 1),
      'Shell',
      'Main Road',
      'Cape Town',
      'Western Cape',
      -33.9025,
      18.4187,
      ARRAY['Petrol 95','Diesel 50ppm']::text[],
      'Shell',
      'coastal',
      'active',
      'garage123'
    );
  END IF;
END $$;
```

## Troubleshooting

### Error: "Cannot find file"
- Make sure your SQL file is in the project folder
- Check the filename matches exactly

### Error: "Skipped X statements"
- Some statements might be missing required fields (name or city)
- Check the console output to see which ones were skipped

### Duplicates Not Being Skipped
- The script checks by name + city + coordinates
- If coordinates are slightly different, it might create duplicates
- You can manually adjust the duplicate check in the script if needed

## Need Help?

If the conversion doesn't work or you have questions, provide:
1. A sample of your SQL file (first 3-5 INSERT statements)
2. The error message you're seeing
3. The console output from the conversion script

