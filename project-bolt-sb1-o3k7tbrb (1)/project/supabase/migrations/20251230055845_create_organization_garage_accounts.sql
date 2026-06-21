/*
  # Create Organization-Garage Account Relationships
  
  1. New Table
    - `organization_garage_accounts`
      - Links organizations with garages where they have local accounts
      - Used to restrict which garages drivers can use for Local Account payments
      - `organization_id` (uuid, FK to organizations)
      - `garage_id` (uuid, FK to garages)
      - `is_active` (boolean, default true) - Enable/disable the relationship
      - `notes` (text) - Optional notes about the account relationship
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on the table
    - Super admins can manage all relationships
    - Organization users can view their organization's garage relationships
    - Anonymous users (drivers) can read to validate garage selection
  
  3. Indexes
    - Index on organization_id for fast lookups
    - Index on garage_id for reverse lookups
    - Composite unique constraint on (organization_id, garage_id)
*/

-- Create organization_garage_accounts table
CREATE TABLE IF NOT EXISTS organization_garage_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  garage_id uuid NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, garage_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_garage_accounts_org_id ON organization_garage_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_garage_accounts_garage_id ON organization_garage_accounts(garage_id);
CREATE INDEX IF NOT EXISTS idx_org_garage_accounts_active ON organization_garage_accounts(organization_id, is_active);

-- Enable RLS
ALTER TABLE organization_garage_accounts ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "Super admin full access to org garage accounts"
  ON organization_garage_accounts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Organization users can view their organization's garage relationships
CREATE POLICY "Organization users can view their garage accounts"
  ON organization_garage_accounts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT profiles.organization_id FROM profiles
      WHERE profiles.id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT organizations.id FROM organizations
      WHERE organizations.parent_org_id IN (
        SELECT profiles.organization_id FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );

-- Anonymous users (drivers) can read to validate garage selection
CREATE POLICY "Drivers can view active garage accounts for validation"
  ON organization_garage_accounts
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_organization_garage_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_organization_garage_accounts_updated_at
  BEFORE UPDATE ON organization_garage_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_garage_accounts_updated_at();