/*
  # Restrict Garages RLS Policies

  ## Problem
  The `garages_update_anonymous` policy allowed ANY anonymous user to update ANY active garage:
  - Garage A could modify Garage B's fuel prices, contact info, etc.
  - No validation of which garage was making the update
  - Major security vulnerability

  ## Solution
  1. Remove the anonymous UPDATE policy for garages
  2. Force all garage updates through the secure Edge Function (garage-update)
  3. The Edge Function validates credentials and enforces that garages can only update their own data
  4. Keep SELECT policy for anonymous users (needed for drivers to find garages)

  ## Security Model
  - Garages authenticate via email/password validated by Edge Functions
  - Edge Functions use service role key to perform operations
  - RLS blocks direct anonymous updates
  - Only authenticated admins and super admins can update via normal auth

  ## Changes
  1. Drop the `garages_update_anonymous` policy
  2. All garage self-updates must go through the garage-update Edge Function
*/

-- Drop the insecure anonymous update policy
DROP POLICY IF EXISTS "garages_update_anonymous" ON garages;

-- Anonymous users can still SELECT garages (needed for drivers to find garages)
-- (This policy already exists: "Anonymous users can view garages")

-- Authenticated admins can still insert/update via normal auth
-- (These policies already exist: garages_insert_policy, garages_update_policy)