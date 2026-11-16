/*
  # Scope trip logbook access

  1. Problem
     - The four policies on trip_logbook_entries were `true` for anon and authenticated,
       so any holder of the anon key could read, edit and delete every organization's
       logbook entries.

  2. Changes
     - Drop the permissive policies.
     - Drivers (anon, identified by their driver session token) may read their own
       organization's entries and only write/modify/delete their own rows.
     - Signed-in users may act within their own organization tree; super_admin and
       management may act across organizations.
*/

DROP POLICY IF EXISTS logbook_select_anon ON trip_logbook_entries;
DROP POLICY IF EXISTS logbook_insert_anon ON trip_logbook_entries;
DROP POLICY IF EXISTS logbook_update_anon ON trip_logbook_entries;
DROP POLICY IF EXISTS logbook_delete_anon ON trip_logbook_entries;

CREATE POLICY logbook_driver_select ON trip_logbook_entries
  FOR SELECT TO anon
  USING (organization_id = current_driver_org_id());

CREATE POLICY logbook_driver_insert ON trip_logbook_entries
  FOR INSERT TO anon
  WITH CHECK (organization_id = current_driver_org_id() AND driver_id = current_driver_id());

CREATE POLICY logbook_driver_update ON trip_logbook_entries
  FOR UPDATE TO anon
  USING (driver_id = current_driver_id() AND organization_id = current_driver_org_id())
  WITH CHECK (driver_id = current_driver_id() AND organization_id = current_driver_org_id());

CREATE POLICY logbook_driver_delete ON trip_logbook_entries
  FOR DELETE TO anon
  USING (driver_id = current_driver_id() AND organization_id = current_driver_org_id());

CREATE POLICY logbook_org_select ON trip_logbook_entries
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR organization_id IN (
      SELECT organizations.id FROM organizations
      WHERE organizations.parent_org_id IN (
        SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::text, 'management'::text])
    )
  );

CREATE POLICY logbook_org_insert ON trip_logbook_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR organization_id IN (
      SELECT organizations.id FROM organizations
      WHERE organizations.parent_org_id IN (
        SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::text, 'management'::text])
    )
  );

CREATE POLICY logbook_org_update ON trip_logbook_entries
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR organization_id IN (
      SELECT organizations.id FROM organizations
      WHERE organizations.parent_org_id IN (
        SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::text, 'management'::text])
    )
  )
  WITH CHECK (
    organization_id IN (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR organization_id IN (
      SELECT organizations.id FROM organizations
      WHERE organizations.parent_org_id IN (
        SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::text, 'management'::text])
    )
  );

CREATE POLICY logbook_org_delete ON trip_logbook_entries
  FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid())
    OR organization_id IN (
      SELECT organizations.id FROM organizations
      WHERE organizations.parent_org_id IN (
        SELECT profiles.organization_id FROM profiles WHERE profiles.id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['super_admin'::text, 'management'::text])
    )
  );
