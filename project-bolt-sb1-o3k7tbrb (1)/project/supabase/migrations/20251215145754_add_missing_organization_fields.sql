/*
  # Add Missing Organization Fields
  
  Adds all the required fields to the organizations table that are expected by the application:
  
  1. Company Information
    - company_registration_number
    - vat_number
    - website
  
  2. Address Fields
    - address_line1
    - address_line2
    - city
    - province
    - postal_code
    - country
  
  3. Financial Settings
    - monthly_fee_per_vehicle
    - month_end_day
    - year_end_month
    - year_end_day
  
  4. Banking Details (Primary Account)
    - bank_name
    - bank_account_holder
    - bank_account_number
    - bank_branch_code
    - bank_account_type
  
  5. Banking Details (Secondary Account)
    - bank_name_2
    - bank_account_holder_2
    - bank_account_number_2
    - bank_branch_code_2
    - bank_account_type_2
  
  6. Billing Contact
    - billing_contact_name
    - billing_contact_surname
    - billing_contact_email
    - billing_contact_phone
  
  7. Spending Limits
    - daily_spending_limit
    - monthly_spending_limit
*/

-- Add company information fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'company_registration_number') THEN
    ALTER TABLE organizations ADD COLUMN company_registration_number text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'vat_number') THEN
    ALTER TABLE organizations ADD COLUMN vat_number text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'website') THEN
    ALTER TABLE organizations ADD COLUMN website text DEFAULT '';
  END IF;
END $$;

-- Add address fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'address_line1') THEN
    ALTER TABLE organizations ADD COLUMN address_line1 text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'address_line2') THEN
    ALTER TABLE organizations ADD COLUMN address_line2 text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'city') THEN
    ALTER TABLE organizations ADD COLUMN city text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'province') THEN
    ALTER TABLE organizations ADD COLUMN province text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'postal_code') THEN
    ALTER TABLE organizations ADD COLUMN postal_code text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'country') THEN
    ALTER TABLE organizations ADD COLUMN country text DEFAULT 'South Africa';
  END IF;
END $$;

-- Add financial settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'monthly_fee_per_vehicle') THEN
    ALTER TABLE organizations ADD COLUMN monthly_fee_per_vehicle numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'month_end_day') THEN
    ALTER TABLE organizations ADD COLUMN month_end_day text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'year_end_month') THEN
    ALTER TABLE organizations ADD COLUMN year_end_month text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'year_end_day') THEN
    ALTER TABLE organizations ADD COLUMN year_end_day text DEFAULT '';
  END IF;
END $$;

-- Add primary banking details
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_name') THEN
    ALTER TABLE organizations ADD COLUMN bank_name text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_account_holder') THEN
    ALTER TABLE organizations ADD COLUMN bank_account_holder text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_account_number') THEN
    ALTER TABLE organizations ADD COLUMN bank_account_number text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_branch_code') THEN
    ALTER TABLE organizations ADD COLUMN bank_branch_code text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_account_type') THEN
    ALTER TABLE organizations ADD COLUMN bank_account_type text DEFAULT '';
  END IF;
END $$;

-- Add secondary banking details
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_name_2') THEN
    ALTER TABLE organizations ADD COLUMN bank_name_2 text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_account_holder_2') THEN
    ALTER TABLE organizations ADD COLUMN bank_account_holder_2 text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_account_number_2') THEN
    ALTER TABLE organizations ADD COLUMN bank_account_number_2 text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_branch_code_2') THEN
    ALTER TABLE organizations ADD COLUMN bank_branch_code_2 text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'bank_account_type_2') THEN
    ALTER TABLE organizations ADD COLUMN bank_account_type_2 text DEFAULT '';
  END IF;
END $$;

-- Add billing contact fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_contact_name') THEN
    ALTER TABLE organizations ADD COLUMN billing_contact_name text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_contact_surname') THEN
    ALTER TABLE organizations ADD COLUMN billing_contact_surname text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_contact_email') THEN
    ALTER TABLE organizations ADD COLUMN billing_contact_email text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_contact_phone') THEN
    ALTER TABLE organizations ADD COLUMN billing_contact_phone text DEFAULT '';
  END IF;
END $$;

-- Add spending limits
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'daily_spending_limit') THEN
    ALTER TABLE organizations ADD COLUMN daily_spending_limit numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'monthly_spending_limit') THEN
    ALTER TABLE organizations ADD COLUMN monthly_spending_limit numeric DEFAULT 0;
  END IF;
END $$;

-- Add RLS policies for organization updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organizations' 
    AND policyname = 'organizations_update_policy'
  ) THEN
    CREATE POLICY "organizations_update_policy" ON organizations 
    FOR UPDATE TO authenticated 
    USING (
      id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    WITH CHECK (
      id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;
