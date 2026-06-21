/*
  # Add Organization Details

  1. Changes to organizations table
    - Add `company_registration_number` (text) - Company registration/tax number
    - Add `vat_number` (text) - VAT registration number
    - Add `contact_person` (text) - Primary contact person name
    - Add `email` (text) - Organization email address
    - Add `phone_number` (text) - Primary phone number
    - Add `address_line1` (text) - Street address line 1
    - Add `address_line2` (text) - Street address line 2
    - Add `city` (text) - City
    - Add `province` (text) - Province/State
    - Add `postal_code` (text) - Postal/ZIP code
    - Add `country` (text) - Country
    - Add `billing_email` (text) - Billing contact email
    - Add `website` (text) - Company website
    - Add `status` (text) - active/inactive/suspended
    - Add `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Organizations table already has RLS enabled
    - Add policy for organization admins to view their own organization details
    - Add policy for organization admins to update their own organization details

  3. Important Notes
    - Each organization has separate data isolation
    - Organization details are used for billing and reporting
    - Only authenticated users in the organization can view/edit details
*/

-- Add new columns to organizations table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'company_registration_number') THEN
    ALTER TABLE organizations ADD COLUMN company_registration_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'vat_number') THEN
    ALTER TABLE organizations ADD COLUMN vat_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'contact_person') THEN
    ALTER TABLE organizations ADD COLUMN contact_person text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'email') THEN
    ALTER TABLE organizations ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'phone_number') THEN
    ALTER TABLE organizations ADD COLUMN phone_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'address_line1') THEN
    ALTER TABLE organizations ADD COLUMN address_line1 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'address_line2') THEN
    ALTER TABLE organizations ADD COLUMN address_line2 text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'city') THEN
    ALTER TABLE organizations ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'province') THEN
    ALTER TABLE organizations ADD COLUMN province text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'postal_code') THEN
    ALTER TABLE organizations ADD COLUMN postal_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'country') THEN
    ALTER TABLE organizations ADD COLUMN country text DEFAULT 'South Africa';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_email') THEN
    ALTER TABLE organizations ADD COLUMN billing_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'website') THEN
    ALTER TABLE organizations ADD COLUMN website text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'status') THEN
    ALTER TABLE organizations ADD COLUMN status text DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'updated_at') THEN
    ALTER TABLE organizations ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS organizations_status_idx ON organizations(status);

-- Update existing RLS policies or create new ones
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their organization" ON organizations;
CREATE POLICY "Users can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
