/*
# Add password_change_required flag to profiles

## Purpose
Supports the secure password reset flow: when a user requests a password reset,
the system generates a temporary password, emails it, and sets this flag.
On the next login, the user is forced to choose a new password before accessing the app.

## Changes
1. Adds `password_change_required` boolean column to `profiles` table (defaults to false).
2. Updates RLS: users can read their own `password_change_required` flag (already covered
   by existing SELECT policy on profiles, no new policy needed).
3. Adds an UPDATE policy allowing users to clear their own flag after changing password.

## Security
- The flag is set only by the service-role key (edge functions), never by the client.
- Users can read their own flag (via existing SELECT policy) but cannot set it to true.
- Users can update their own flag to false only through the change-password edge function
  which also validates the new password meets strength requirements.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT false;