/*
  # Add Super Admin and Management Organization

  1. Changes to organizations table
    - Add `is_management_org` (boolean) - Flag for the primary management organization
    - Add `parent_org_id` (uuid) - Reference to parent management organization
    
  2. Changes to profiles table
    - Update `role` check constraint to include 'super_admin'
    - Super admins can view all organizations and consolidated data
    
  3. Security
    - Add RLS policies for super admin access to all organizations
    - Add RLS policies for super admin access to all fuel transactions
    - Regular admins can only see their own organization data
    
  4. Important Notes
    - Only ONE organization should be marked as is_management_org = true
    - Super admins belong to the management organization
    - All other organizations will have parent_org_id pointing to management org
    - Management org handles consolidated payments to garages
*/

-- Add new columns to organizations table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_management_org') THEN
    ALTER TABLE organizations ADD COLUMN is_management_org boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'parent_org_id') THEN
    ALTER TABLE organizations ADD COLUMN parent_org_id uuid REFERENCES organizations(id);
  END IF;
END $$;

-- Update role column check constraint in profiles table
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'driver'::text, 'super_admin'::text]));
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS organizations_is_management_org_idx ON organizations(is_management_org);
CREATE INDEX IF NOT EXISTS organizations_parent_org_id_idx ON organizations(parent_org_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- Update RLS policies for organizations to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all organizations" ON organizations;
CREATE POLICY "Super admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can update all organizations" ON organizations;
CREATE POLICY "Super admins can update all organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

-- Update RLS policies for fuel_transactions to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all fuel transactions" ON fuel_transactions;
CREATE POLICY "Super admins can view all fuel transactions"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

-- Update RLS policies for vehicles to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all vehicles" ON vehicles;
CREATE POLICY "Super admins can view all vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

-- Update RLS policies for garages to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all garages" ON garages;
CREATE POLICY "Super admins can view all garages"
  ON garages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

-- Update RLS policies for drivers to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all drivers" ON drivers;
CREATE POLICY "Super admins can view all drivers"
  ON drivers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

-- Update RLS policies for daily_eft_batches to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all eft batches" ON daily_eft_batches;
CREATE POLICY "Super admins can view all eft batches"
  ON daily_eft_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can insert eft batches" ON daily_eft_batches;
CREATE POLICY "Super admins can insert eft batches"
  ON daily_eft_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can update eft batches" ON daily_eft_batches;
CREATE POLICY "Super admins can update eft batches"
  ON daily_eft_batches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

-- Update RLS policies for eft_batch_items to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all eft batch items" ON eft_batch_items;
CREATE POLICY "Super admins can view all eft batch items"
  ON eft_batch_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can insert eft batch items" ON eft_batch_items;
CREATE POLICY "Super admins can insert eft batch items"
  ON eft_batch_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );
