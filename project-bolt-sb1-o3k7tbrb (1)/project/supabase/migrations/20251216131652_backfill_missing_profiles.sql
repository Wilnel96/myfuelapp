/*
  # Backfill Missing Profiles for Organization Users

  1. Problem
    - Users created via edge functions (management users, etc.) don't have profile records
    - This causes "No organization found" errors in components that rely on profiles table
    - The handle_new_user trigger returns early for organization users without creating profiles

  2. Solution
    - Insert missing profile records for all users in organization_users who don't have profiles
    - Set organization_id, full_name, and role from organization_users table

  3. Logic
    - Find all organization_users who don't have a corresponding profile
    - Create profile records with data from organization_users
*/

-- Insert missing profiles for organization users
INSERT INTO profiles (id, organization_id, full_name, role)
SELECT 
  ou.user_id as id,
  ou.organization_id,
  CONCAT(ou.name, ' ', ou.surname) as full_name,
  CASE 
    WHEN ou.title = 'Super Admin' THEN 'super_admin'
    WHEN ou.title = 'Main User' OR ou.title = 'Secondary Main User' THEN 'admin'
    WHEN ou.title = 'Billing' THEN 'billing'
    ELSE 'admin'
  END as role
FROM organization_users ou
LEFT JOIN profiles p ON p.id = ou.user_id
WHERE p.id IS NULL
  AND ou.user_id IS NOT NULL
  AND ou.is_active = true
ON CONFLICT (id) DO NOTHING;
