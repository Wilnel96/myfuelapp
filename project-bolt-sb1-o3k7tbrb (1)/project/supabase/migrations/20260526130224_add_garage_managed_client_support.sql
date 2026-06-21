/*
  # Add Garage-Managed Client Support

  ## Summary
  Extends organizations to support the concept of garage-managed clients — organizations
  that were onboarded by a garage, are billed through the garage for vehicle/driver fees,
  and have full access to the system portal (vehicles, drivers, reports, invoices, etc.)
  just like direct system clients.

  ## Changes

  ### Modified Tables
  - `organizations`
    - `managing_garage_id` (uuid, nullable, FK to garages): The garage responsible for
      billing this organization for vehicle/driver fees. When set, the system skips
      direct fee invoicing for this org and rolls the counts into the garage's invoice.
    - `is_garage_managed` (boolean, default false): Fast index flag. True when
      managing_garage_id is set.

  ## Security
  - RLS policies on organizations are unchanged — garage-managed clients remain
    accessible to authenticated users per existing policies.
  - Super admins retain full visibility for audit/support.

  ## Important Notes
  1. Garage-managed clients are full system participants — all portal features available.
  2. The billing run must check `is_garage_managed` before generating direct fee invoices.
  3. `managing_garage_id` links to `garages.id` (not organizations.id).
*/

-- Add managing_garage_id column to organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'managing_garage_id'
  ) THEN
    ALTER TABLE organizations
      ADD COLUMN managing_garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add is_garage_managed flag for fast querying
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'is_garage_managed'
  ) THEN
    ALTER TABLE organizations
      ADD COLUMN is_garage_managed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Index for fast lookups of all clients managed by a given garage
CREATE INDEX IF NOT EXISTS idx_organizations_managing_garage_id
  ON organizations(managing_garage_id)
  WHERE managing_garage_id IS NOT NULL;

-- Index for billing run: quickly find all garage-managed orgs to skip
CREATE INDEX IF NOT EXISTS idx_organizations_is_garage_managed
  ON organizations(is_garage_managed)
  WHERE is_garage_managed = true;

-- Ensure consistency: if managing_garage_id is set, is_garage_managed must be true, and vice versa
-- We enforce this via a trigger so both fields stay in sync regardless of which is updated.
CREATE OR REPLACE FUNCTION sync_is_garage_managed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.managing_garage_id IS NOT NULL THEN
    NEW.is_garage_managed := true;
  ELSE
    NEW.is_garage_managed := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_is_garage_managed ON organizations;
CREATE TRIGGER trg_sync_is_garage_managed
  BEFORE INSERT OR UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION sync_is_garage_managed();
