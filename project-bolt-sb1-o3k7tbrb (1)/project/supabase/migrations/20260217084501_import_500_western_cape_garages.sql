/*
  # Import 500 Western Cape Garages from OpenStreetMap

  This migration imports garage data scraped from OpenStreetMap for the Western Cape region of South Africa.

  1. Data Imported
    - 500 fuel stations/garages across Western Cape
    - Includes major brands: Shell, BP, Engen, Astron Energy, TotalEnergies, Sasol
    - Location data with GPS coordinates
    - Contact information where available

  2. Data Structure
    - Uses placeholder organization_id (00000000-0000-0000-0000-000000000000)
    - Contains address, city, province, postal code
    - Fuel types offered (Diesel, Petrol 93/95/98 ULP)
    - Contact persons in JSONB format
    - Banking details (placeholders)
    - Commission rate (0.5 default)

  3. Import Strategy
    - Uses ON CONFLICT DO NOTHING to prevent duplicates
    - Safe to run multiple times
    - Will skip existing entries based on unique constraints

  Note: This is a data migration importing real-world garage locations.
*/

-- The SQL file is too large for a single migration (365KB)
-- Please run combined_batches_01-10_with_schema.sql directly in SQL Editor
-- Or use the Node.js import script: node final_import_via_client.mjs

-- This migration serves as documentation only
SELECT 'Please import garages using combined_batches_01-10_with_schema.sql in the SQL Editor' as notice;
