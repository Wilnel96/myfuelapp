/*
  # Fix handle_new_user to Set Role and Grant Permissions

  1. Problem
    - The handle_new_user() function creates organization_users with is_main_user=true
    - But it doesn't set the role field to 'main_user'
    - The auto_grant_main_user_permissions() trigger checks for role IN ('main_user', 'secondary_main_user')
    - So new users don't get their permissions auto-granted
    - This causes "Access Restricted" errors for newly created accounts

  2. Solution
    - Update handle_new_user() to set role='main_user' when creating main users
    - This will trigger auto_grant_main_user_permissions() to grant all permissions
    
  3. Changes
    - Insert organization_users with role='main_user' instead of default 'user'
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  org_id uuid;
  org_name text;
  user_name text;
  user_surname text;
  is_org_user boolean;
BEGIN
  -- Check if this is an organization user (has organization_id in metadata)
  is_org_user := (NEW.raw_user_meta_data->>'organization_id') IS NOT NULL;
  
  -- If this is an organization user being created by edge function, skip profile creation
  -- The edge function will handle creating the organization_users entry
  IF is_org_user THEN
    RETURN NEW;
  END IF;

  -- Below is for regular signups (main account holders)
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    'Organization'
  );
  
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
  user_surname := COALESCE(NEW.raw_user_meta_data->>'surname', '');
  
  -- Create new organization
  INSERT INTO organizations (name, status)
  VALUES (org_name, 'active')
  RETURNING id INTO org_id;
  
  -- Create profile
  INSERT INTO profiles (id, organization_id, email, full_name, role)
  VALUES (
    NEW.id,
    org_id,
    NEW.email,
    user_name || ' ' || user_surname,
    'admin'
  );
  
  -- Create organization_users entry with role='main_user' to trigger auto_grant_main_user_permissions()
  INSERT INTO organization_users (
    user_id, 
    organization_id, 
    is_main_user, 
    is_active, 
    role,
    title, 
    first_name, 
    surname, 
    email
  )
  VALUES (
    NEW.id, 
    org_id, 
    true, 
    true, 
    'main_user',
    'Main User', 
    user_name, 
    user_surname, 
    NEW.email
  );
  
  RETURN NEW;
END;
$function$;
