/*
  # Add RLS Policies for Authenticated Garage Users

  1. Purpose
    - Allow garage users to view and update their own garage data
    - Ensure garage users can only access data related to their garage
    - Maintain security by verifying user is linked to garage through organization_users

  2. New Policies
    - Garage users can SELECT their own garage
    - Garage users can UPDATE their own garage
    - Garage users can SELECT fuel invoices for transactions at their garage
    - Garage users can SELECT statements for their garage
    - Garage users can SELECT/UPDATE local accounts at their garage

  3. Security
    - All policies verify user is linked to garage through organization_users
    - User must be active and have garage_user role
    - Garage must have the same organization_id as the user's organization
*/

-- Policy for garage users to SELECT their own garage
CREATE POLICY "Garage users can view own garage"
  ON garages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.organization_id = garages.organization_id
        AND ou.role = 'garage_user'
        AND ou.is_active = true
    )
  );

-- Policy for garage users to UPDATE their own garage
CREATE POLICY "Garage users can update own garage"
  ON garages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.organization_id = garages.organization_id
        AND ou.role = 'garage_user'
        AND ou.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.organization_id = garages.organization_id
        AND ou.role = 'garage_user'
        AND ou.is_active = true
    )
  );

-- Policy for garage users to SELECT fuel transaction invoices from their garage
-- (invoices are linked by organization_id, so we need to find invoices for transactions at this garage)
CREATE POLICY "Garage users can view invoices for their garage"
  ON fuel_transaction_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM fuel_transactions ft
      JOIN garages g ON g.id = ft.garage_id
      JOIN organization_users ou ON ou.organization_id = g.organization_id
      WHERE ft.id = fuel_transaction_invoices.fuel_transaction_id
        AND ou.user_id = auth.uid()
        AND ou.role = 'garage_user'
        AND ou.is_active = true
    )
  );

-- Policy for garage users to SELECT statements for their garage
CREATE POLICY "Garage users can view own statements"
  ON garage_statements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM garages g
      JOIN organization_users ou ON ou.organization_id = g.organization_id
      WHERE g.id = garage_statements.garage_id
        AND ou.user_id = auth.uid()
        AND ou.role = 'garage_user'
        AND ou.is_active = true
    )
  );

-- Policy for garage users to SELECT organization_garage_accounts for their garage
CREATE POLICY "Garage users can view own local accounts"
  ON organization_garage_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM garages g
      JOIN organization_users ou ON ou.organization_id = g.organization_id
      WHERE g.id = organization_garage_accounts.garage_id
        AND ou.user_id = auth.uid()
        AND ou.role = 'garage_user'
        AND ou.is_active = true
    )
  );

-- Policy for garage users to UPDATE organization_garage_accounts for their garage
CREATE POLICY "Garage users can update own local accounts"
  ON organization_garage_accounts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM garages g
      JOIN organization_users ou ON ou.organization_id = g.organization_id
      WHERE g.id = organization_garage_accounts.garage_id
        AND ou.user_id = auth.uid()
        AND ou.role = 'garage_user'
        AND ou.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM garages g
      JOIN organization_users ou ON ou.organization_id = g.organization_id
      WHERE g.id = organization_garage_accounts.garage_id
        AND ou.user_id = auth.uid()
        AND ou.role = 'garage_user'
        AND ou.is_active = true
    )
  );

-- Policy for garage users to SELECT organizations (client organizations with accounts at their garage)
CREATE POLICY "Garage users can view client organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_garage_accounts oga
      JOIN garages g ON g.id = oga.garage_id
      JOIN organization_users ou ON ou.organization_id = g.organization_id
      WHERE oga.organization_id = organizations.id
        AND ou.user_id = auth.uid()
        AND ou.role = 'garage_user'
        AND ou.is_active = true
    )
  );

-- Policy for garage users to SELECT organization_users (client users)
CREATE POLICY "Garage users can view client org users"
  ON organization_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_garage_accounts oga
      JOIN garages g ON g.id = oga.garage_id
      JOIN organization_users garage_ou ON garage_ou.organization_id = g.organization_id
      WHERE oga.organization_id = organization_users.organization_id
        AND garage_ou.user_id = auth.uid()
        AND garage_ou.role = 'garage_user'
        AND garage_ou.is_active = true
    )
  );
