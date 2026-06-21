/*
  # Add More Payment Terms Options

  1. Changes
    - Drop the existing payment_terms constraint that only allowed 'Immediate', 'Next Day', '30-Days'
    - Add a new constraint that allows: 'Immediate', 'Next Day', '7-Days', '14-Days', '30-Days', '60-Days', '90-Days'
  
  2. Purpose
    - Allow more flexibility in setting payment terms for organizations
    - Support common business payment term periods
*/

-- Drop the existing constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_payment_terms_check;

-- Add the new constraint with more options
ALTER TABLE organizations ADD CONSTRAINT organizations_payment_terms_check 
CHECK (payment_terms = ANY (ARRAY['Immediate'::text, 'Next Day'::text, '7-Days'::text, '14-Days'::text, '30-Days'::text, '60-Days'::text, '90-Days'::text]));
