/*
  # Add ID Number Support for Individual Accounts

  This migration adds support for individual accounts with ID numbers.

  ## Changes

  1. **Organization Users Table**
     - Add `id_number` column to store individual's South African ID number
     - Optional field, only required for individual accounts

  2. **Profiles Table**
     - Add `id_number` column to store ID number in user metadata

  ## Security

  - ID numbers are sensitive personal information
  - Only accessible to the user themselves and super admins
  - Used for individual account verification and organization creation
*/

-- ============================================================================
-- ADD ID NUMBER TO ORGANIZATION USERS
-- ============================================================================

ALTER TABLE public.organization_users
ADD COLUMN IF NOT EXISTS id_number text;

COMMENT ON COLUMN public.organization_users.id_number IS
'South African ID number for individual accounts (13 digits)';

-- ============================================================================
-- ADD ID NUMBER TO PROFILES
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS id_number text;

COMMENT ON COLUMN public.profiles.id_number IS
'South African ID number for individual accounts, stored from user metadata';

-- Create index for faster ID number lookups (useful for verification)
CREATE INDEX IF NOT EXISTS idx_organization_users_id_number
ON public.organization_users(id_number)
WHERE id_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_id_number
ON public.profiles(id_number)
WHERE id_number IS NOT NULL;
