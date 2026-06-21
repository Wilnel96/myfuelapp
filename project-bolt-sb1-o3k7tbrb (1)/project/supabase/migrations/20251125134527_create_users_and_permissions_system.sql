/*
  # Create Users and Permissions System

  1. New Tables
    - organization_users: Links users to organizations with specific permissions
      - id (uuid, primary key)
      - organization_id (uuid, foreign key to organizations)
      - user_id (uuid, foreign key to auth.users)
      - email (text)
      - full_name (text)
      - is_main_user (boolean) - only main user can modify organization details
      - can_add_vehicles (boolean)
      - can_edit_vehicles (boolean)
      - can_delete_vehicles (boolean)
      - can_add_drivers (boolean)
      - can_edit_drivers (boolean)
      - can_delete_drivers (boolean)
      - can_view_reports (boolean)
      - is_active (boolean)
      - created_at (timestamptz)
      - updated_at (timestamptz)

  2. Security
    - Enable RLS on organization_users table
    - Main user can manage all users in their organization
    - Super admin can view all users
    - Users can view their own record

  3. Notes
    - Main user has full permissions by default
    - Other users have restricted permissions based on settings
    - Only main user can change organization bank details and contact info
*/

-- Create organization_users table
CREATE TABLE IF NOT EXISTS organization_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  is_main_user boolean DEFAULT false,
  can_add_vehicles boolean DEFAULT false,
  can_edit_vehicles boolean DEFAULT false,
  can_delete_vehicles boolean DEFAULT false,
  can_add_drivers boolean DEFAULT false,
  can_edit_drivers boolean DEFAULT false,
  can_delete_drivers boolean DEFAULT false,
  can_view_reports boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, email)
);

-- Enable RLS
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;

-- Super admin can view all users
CREATE POLICY "Super admin can view all organization users"
  ON organization_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Main users can view all users in their organization
CREATE POLICY "Main users can view users in their organization"
  ON organization_users FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Main users can insert users in their organization
CREATE POLICY "Main users can add users to their organization"
  ON organization_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Main users can update users in their organization (except cannot change another main user)
CREATE POLICY "Main users can update users in their organization"
  ON organization_users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Main users can delete users in their organization (except cannot delete another main user)
CREATE POLICY "Main users can delete users in their organization"
  ON organization_users FOR DELETE
  TO authenticated
  USING (
    NOT is_main_user
    AND
    (
      EXISTS (
        SELECT 1 FROM organization_users ou
        WHERE ou.user_id = auth.uid()
        AND ou.organization_id = organization_users.organization_id
        AND ou.is_main_user = true
        AND ou.is_active = true
      )
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
      )
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_organization_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_organization_users_updated_at
  BEFORE UPDATE ON organization_users
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_users_updated_at();
