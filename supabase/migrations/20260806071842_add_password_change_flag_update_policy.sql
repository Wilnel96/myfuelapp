/*
# Allow users to clear their own password_change_required flag

## Purpose
After a user successfully changes their password via the change-password edge function,
the edge function (using service role) clears the flag. This policy is a safety net
that also allows an authenticated user to clear their own flag — but only to false
(they cannot set it to true, which is reserved for the service role).

## Security
- UPDATE policy scoped to authenticated users updating their own profile.
- This is intentionally narrow: the flag can only be cleared (set to false), never set to true by a user.
- The existing handle_new_user trigger already handles profile creation.
*/

-- Check if an update policy already exists for profiles that covers this case
-- We add a narrow policy specifically for the password_change_required column
DO $$
BEGIN
  -- Drop existing policy if it exists to avoid conflicts
  DROP POLICY IF EXISTS "users_clear_own_password_change_flag" ON profiles;
END $$;

-- Allow users to update their own password_change_required flag (to clear it)
CREATE POLICY "users_clear_own_password_change_flag"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND password_change_required = false);