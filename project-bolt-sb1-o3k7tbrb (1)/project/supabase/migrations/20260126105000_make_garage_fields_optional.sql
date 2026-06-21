/*
  # Make garage fields optional for easier onboarding

  1. Changes
    - Make city optional (nullable)
    - Make all bank fields optional (nullable)
    - Garages can now be imported with minimal information
    - They can update their details later once operational

  2. Notes
    - name and organization_id remain required (essential for system)
    - All other fields are now optional for flexible onboarding
*/

-- Make city optional
ALTER TABLE garages 
ALTER COLUMN city DROP NOT NULL;

-- Make bank fields optional
ALTER TABLE garages 
ALTER COLUMN bank_name DROP NOT NULL,
ALTER COLUMN account_holder DROP NOT NULL,
ALTER COLUMN account_number DROP NOT NULL,
ALTER COLUMN branch_code DROP NOT NULL;