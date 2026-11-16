/*
  # Scope profile reads

  1. Problem
     - profiles_select_policy was `USING (true)` for every signed-in user, exposing
       every user's name, email, phone and identity number across all organizations.

  2. Changes
     - Limit reads to the caller's own profile, profiles in the caller's organization
       tree, and platform operators.
*/

DROP POLICY IF EXISTS profiles_select_policy ON profiles;

CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR organization_id IN (
      SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()
    )
    OR public.is_management_org_member()
  );
