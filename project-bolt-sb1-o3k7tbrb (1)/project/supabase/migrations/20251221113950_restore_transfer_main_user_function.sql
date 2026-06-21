/*
  # Restore Transfer Main User Function

  1. Functions
    - `transfer_main_user` - Allows transferring main user status from one user to another
      - Takes from_user_id and to_user_id as parameters
      - Removes main user status from the current main user
      - Grants main user status to the target user
      - Automatically removes secondary main user status from target user if they have it
  
  2. Security
    - Function uses SECURITY DEFINER to allow authorized transfers
    - Sets search_path to empty string for security
*/

CREATE OR REPLACE FUNCTION transfer_main_user(from_user_id uuid, to_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.organization_users
  WHERE id = from_user_id;
  
  UPDATE public.organization_users
  SET is_main_user = false
  WHERE id = from_user_id;
  
  UPDATE public.organization_users
  SET is_main_user = true, is_secondary_main_user = false
  WHERE id = to_user_id;
END;
$$;
