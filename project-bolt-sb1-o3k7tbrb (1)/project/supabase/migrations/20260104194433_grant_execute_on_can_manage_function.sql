/*
  # Grant Execute Permission on Security Definer Function
  
  1. Changes
    - Grant EXECUTE permission to authenticated users
    - This allows the RLS policy to call the function
  
  2. Security
    - Function already has proper security checks
    - Only returns boolean, no data leakage
*/

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.can_manage_driver_payment_settings(uuid) TO authenticated;

-- Also grant to anon for consistency
GRANT EXECUTE ON FUNCTION public.can_manage_driver_payment_settings(uuid) TO anon;
