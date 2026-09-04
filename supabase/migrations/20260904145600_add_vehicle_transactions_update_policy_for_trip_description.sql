/*
# Add UPDATE policy on vehicle_transactions for trip description updates

1. Purpose
   Drivers need to update the trip_description on a drawn (unreturned) vehicle
   transaction mid-trip — e.g. adding a new destination or note while the vehicle
   is still checked out. Previously there was no UPDATE policy on this table,
   so no client could update rows.

2. Security
   - Adds an UPDATE policy scoped to `anon, authenticated` (the driver mobile app
     uses the anon key with custom driver auth, not Supabase auth sessions).
   - The policy allows updating any row (the driver app already validates that
     the transaction belongs to the logged-in driver before attempting an update).
   - This mirrors the existing INSERT/SELECT policies which are also public.
   - Only the `trip_description` column is updated by the driver app.
*/

ALTER TABLE vehicle_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_trans_update_public" ON vehicle_transactions;
CREATE POLICY "vehicle_trans_update_public"
ON vehicle_transactions FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
