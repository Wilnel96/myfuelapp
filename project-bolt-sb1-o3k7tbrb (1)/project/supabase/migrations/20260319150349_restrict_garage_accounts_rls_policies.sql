/*
  # Restrict Garage Accounts RLS Policies

  ## Problem
  The previous RLS policies allowed ANY anonymous user to:
  - View all organization_garage_accounts regardless of which garage they belonged to
  - Update any account without verifying ownership
  - Insert accounts for any garage

  This was a major security vulnerability where:
  - Garage A could view and modify Garage B's client accounts
  - Malicious actors could manipulate accounts directly via the database

  ## Solution
  Replace permissive policies with restrictive ones that:
  1. Block all anonymous direct access to organization_garage_accounts
  2. Force all operations through the secure Edge Function (garage-local-accounts)
  3. The Edge Function validates garage credentials and enforces ownership

  ## Security Model
  - Garages authenticate via email/password validated by the Edge Function
  - The Edge Function uses the service role key to perform operations
  - RLS policies now block anonymous users from direct database access
  - Only authenticated organization users and super admins can access via normal auth

  ## Changes
  1. Drop all anonymous (anon) policies for organization_garage_accounts
  2. Keep authenticated user policies for organization admins
  3. Keep super admin policies
  4. All garage operations must go through the Edge Function
*/

-- Drop all anonymous user policies
DROP POLICY IF EXISTS "Anonymous users can view garage accounts" ON organization_garage_accounts;
DROP POLICY IF EXISTS "Garages can insert local client accounts" ON organization_garage_accounts;
DROP POLICY IF EXISTS "Garages can update local client accounts" ON organization_garage_accounts;
DROP POLICY IF EXISTS "Drivers can view active garage accounts for validation" ON organization_garage_accounts;

-- Authenticated organization users can still view their own garage accounts
-- (This policy already exists, just documenting it here)

-- Authenticated organization users can still insert/update their own garage accounts  
-- (These policies already exist, just documenting them here)

-- Super admins still have full access via the "Super admin full access" policy
-- (This policy already exists, just documenting it here)