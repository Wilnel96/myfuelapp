/*
  # Add INSERT policies for super admin and organization users to garage_client_payments

  1. Changes
    - Add policy for super admin to insert payments
    - Add policy for organization users with payment permissions to insert payments
  
  2. Security
    - Super admin can insert any payment
    - Organization users can only insert payments for their own organization
*/

-- Policy: Super admin can insert payments
CREATE POLICY "Super admin can insert payments"
  ON garage_client_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy: Organization users can insert payments for their organization
CREATE POLICY "Organization users can insert own payments"
  ON garage_client_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.user_id = auth.uid()
      AND organization_users.organization_id = garage_client_payments.organization_id
      AND organization_users.is_active = true
    )
  );
