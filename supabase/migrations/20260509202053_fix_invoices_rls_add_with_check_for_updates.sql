/*
  # Fix invoices RLS — split ALL policy into SELECT/INSERT/UPDATE/DELETE

  ## Problem
  The existing "Comprehensive invoices access" policy uses FOR ALL with only a
  USING clause and no WITH CHECK. PostgreSQL requires WITH CHECK for INSERT and
  UPDATE operations; without it those operations are silently blocked even when
  USING passes.

  ## Changes
  - Drop the single FOR ALL policy
  - Add four separate policies (SELECT, INSERT, UPDATE, DELETE) each with the
    same access condition: super_admin, management org user, or org user with
    can_view_reports=true
  - UPDATE and INSERT policies include WITH CHECK using the same condition
*/

DROP POLICY IF EXISTS "Comprehensive invoices access" ON invoices;

CREATE POLICY "invoices_select"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
    OR is_management_org_user((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM organization_users WHERE organization_users.organization_id = invoices.organization_id AND organization_users.user_id = (SELECT auth.uid()) AND organization_users.can_view_reports = true)
  );

CREATE POLICY "invoices_insert"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
    OR is_management_org_user((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM organization_users WHERE organization_users.organization_id = invoices.organization_id AND organization_users.user_id = (SELECT auth.uid()) AND organization_users.can_view_reports = true)
  );

CREATE POLICY "invoices_update"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
    OR is_management_org_user((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM organization_users WHERE organization_users.organization_id = invoices.organization_id AND organization_users.user_id = (SELECT auth.uid()) AND organization_users.can_view_reports = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
    OR is_management_org_user((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM organization_users WHERE organization_users.organization_id = invoices.organization_id AND organization_users.user_id = (SELECT auth.uid()) AND organization_users.can_view_reports = true)
  );

CREATE POLICY "invoices_delete"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
    OR is_management_org_user((SELECT auth.uid()))
  );
