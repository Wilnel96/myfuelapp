/*
  # Make City Field Required for Garages

  This migration makes the city field mandatory for all garages to ensure proper 
  search functionality by city.

  1. Changes
    - Update any existing garages with NULL city to have a default value
    - Alter the city column to be NOT NULL
    - This ensures all garages have a city specified for search purposes

  2. Data Safety
    - Before making the column NOT NULL, we update any existing NULL values
    - This prevents the migration from failing due to existing NULL values
*/

-- First, update any existing garages with NULL city to have a default value
UPDATE garages 
SET city = 'Unknown' 
WHERE city IS NULL;

-- Now make the city column NOT NULL
ALTER TABLE garages 
ALTER COLUMN city SET NOT NULL;