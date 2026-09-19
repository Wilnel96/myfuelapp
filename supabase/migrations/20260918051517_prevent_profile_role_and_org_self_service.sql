-- F16 and F17: the "update own profile" policy checked the row but not the columns, so a user
-- could set their own role (privilege escalation) or move themselves into another organisation
-- (tenant boundary bypass). Role and organisation changes belong to server-side code only.

REVOKE UPDATE ON public.profiles FROM anon, authenticated;

GRANT UPDATE (full_name, id_number, password_change_required, updated_at)
  ON public.profiles TO authenticated;
