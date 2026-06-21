/*
  # Standardize Address Column Names

  1. Issue
    - organizations table uses: address_line1, address_line2 (no underscores)
    - garages table uses: address_line_1, address_line_2 (with underscores)
    - drivers table uses: address_line_1, address_line_2 (with underscores)
    - Inconsistent naming makes queries confusing and error-prone

  2. Change
    - Rename organizations.address_line1 to address_line_1
    - Rename organizations.address_line2 to address_line_2
    - This matches the naming convention used in garages and drivers tables

  3. Impact
    - All tables now use consistent address_line_1 and address_line_2 naming
    - Frontend code that references organizations address fields will need updating
*/

-- Rename address columns in organizations table to match garages/drivers convention
ALTER TABLE organizations 
RENAME COLUMN address_line1 TO address_line_1;

ALTER TABLE organizations 
RENAME COLUMN address_line2 TO address_line_2;

-- Add comments for clarity
COMMENT ON COLUMN organizations.address_line_1 IS 'First line of organization address (street address)';
COMMENT ON COLUMN organizations.address_line_2 IS 'Second line of organization address (optional - suite, building, etc.)';
