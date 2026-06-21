/*
  # Create Custom Report Templates Table

  1. New Tables
    - `custom_report_templates`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text) - Report template name
      - `description` (text) - Report description
      - `table_name` (text) - Database table to query
      - `columns` (jsonb) - Selected columns array
      - `filters` (jsonb) - Filter conditions array
      - `sort_orders` (jsonb) - Sort order configuration array
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `custom_report_templates` table
    - Add policy for users to manage their own organization's templates
    - Add policy for super admins to access all templates
*/

CREATE TABLE IF NOT EXISTS custom_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  table_name text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_orders jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_report_templates ENABLE ROW LEVEL SECURITY;

-- Users can view templates from their organization
CREATE POLICY "Users can view own organization templates"
  ON custom_report_templates
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM organizations WHERE parent_org_id = (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Users can create templates for their organization
CREATE POLICY "Users can create templates for own organization"
  ON custom_report_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON custom_report_templates
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON custom_report_templates
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_report_templates_org_id ON custom_report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_report_templates_user_id ON custom_report_templates(user_id);