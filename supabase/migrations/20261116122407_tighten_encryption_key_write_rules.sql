/*
  # Tighten encryption key write rules

  1. Problem
     - Both ALL policies on encryption_keys had a USING clause but no WITH CHECK, so
       the insert/update check fell back to permissive behaviour for rows that do not
       yet exist.

  2. Changes
     - Recreate both policies with a matching WITH CHECK.
*/

DROP POLICY IF EXISTS "Service role can manage encryption keys" ON encryption_keys;
DROP POLICY IF EXISTS "Super admins can manage encryption keys" ON encryption_keys;

CREATE POLICY "Management org users can manage encryption keys" ON encryption_keys
  FOR ALL TO authenticated
  USING (
    (SELECT auth.uid()) IN (
      SELECT p.id FROM profiles p
      WHERE p.organization_id = (
        SELECT o.id FROM organizations o WHERE o.is_management_org = true LIMIT 1
      )
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IN (
      SELECT p.id FROM profiles p
      WHERE p.organization_id = (
        SELECT o.id FROM organizations o WHERE o.is_management_org = true LIMIT 1
      )
    )
  );

CREATE POLICY "Super admins can manage encryption keys" ON encryption_keys
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'super_admin'
    )
  );
