/*
# Allow pending garage records

1. Purpose
   - Enable imported and self-registered garages to remain clearly marked as pending until reviewed by platform staff.
   - Align the garages table with the existing public garage signup function, which already creates records with status `pending`.

2. Modified Tables
   - `public.garages`
   - The existing `garages_status_check` constraint now accepts `pending` in addition to `active`, `inactive`, and `suspended`.

3. Security
   - No row access policies, grants, or permissions are changed.
   - The change only permits the application’s existing review status to be stored safely.

4. Important Notes
   - Existing garage records are not changed.
   - New spreadsheet imports can use `pending` without weakening access control.
*/

ALTER TABLE public.garages
  DROP CONSTRAINT IF EXISTS garages_status_check;

ALTER TABLE public.garages
  ADD CONSTRAINT garages_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'inactive'::text, 'suspended'::text]));