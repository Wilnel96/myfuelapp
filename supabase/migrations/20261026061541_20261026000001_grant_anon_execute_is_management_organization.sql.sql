-- The is_management_organization function is used in CHECK constraints on
-- vehicle_transactions and other tables. Since drivers use the anon key
-- (no Supabase Auth session) to insert vehicle draws, the anon role must
-- have EXECUTE permission or inserts fail with "permission denied for
-- function is_management_organization".

GRANT EXECUTE ON FUNCTION public.is_management_organization(uuid) TO anon;
