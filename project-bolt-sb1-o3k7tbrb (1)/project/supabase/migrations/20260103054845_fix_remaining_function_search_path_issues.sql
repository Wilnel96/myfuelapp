/*
  # Fix Remaining Function Search Path Issues
  
  This migration fixes the search_path for the overloaded acquire_transaction_lock function
  that takes driver_id and vehicle_id parameters.
  
  ## Changes
  - Set explicit search_path for acquire_transaction_lock(uuid, uuid) function
  - This prevents security vulnerabilities from search_path manipulation
*/

-- Fix the overloaded acquire_transaction_lock function
DROP FUNCTION IF EXISTS acquire_transaction_lock(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION acquire_transaction_lock(
  p_driver_id uuid,
  p_vehicle_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_key bigint;
BEGIN
  -- Create a unique lock key from driver_id and vehicle_id
  -- Use first 4 bytes of each UUID's hash
  v_lock_key := (
    ('x' || substring(md5(p_driver_id::text) from 1 for 8))::bit(32)::bigint << 32
  ) | (
    ('x' || substring(md5(p_vehicle_id::text) from 1 for 8))::bit(32)::bigint
  );
  
  -- Try to acquire lock (non-blocking, transaction-scoped)
  RETURN pg_try_advisory_xact_lock(v_lock_key);
END;
$$;
