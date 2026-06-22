-- The is_management_organization and is_client_organization functions are used
-- in CHECK constraints on vehicle_transactions, vehicles, drivers, and
-- fuel_transactions tables. Drivers use the anon role. PostgreSQL requires the
-- calling role to have EXECUTE permission even when the function is SECURITY
-- DEFINER. The June 2026 security hardening revoked anon access, breaking
-- driver inserts. Restore only what is needed for the constraints to work.

GRANT EXECUTE ON FUNCTION public.is_management_organization(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_client_organization(uuid) TO anon;
