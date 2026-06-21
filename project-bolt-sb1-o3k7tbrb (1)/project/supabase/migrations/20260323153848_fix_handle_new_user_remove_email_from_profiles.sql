/*
  # Fix handle_new_user - Remove Email from Profiles

  1. Problem
    - The handle_new_user() function tries to insert email into profiles table
    - The profiles table doesn't have an email column
    - This causes profile creation to fail
    
  2. Solution
    - Update the function to remove email from the profiles INSERT statement
    - Keep all other fields intact
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
  
  -- Try different metadata field name formats
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'first_name',
    ''
  );
  
  user_surname := COALESCE(
    NEW.raw_user_meta_data->>'surname',
    NEW.raw_user_meta_data->>'last_name',
    ''
  );
  
  -- Create new organization
  INSERT INTO organizations (name, status, organization_type, is_management_org)
  VALUES (org_name, 'active', 'client', false)
  RETURNING id INTO org_id;
  
  -- Create profile (without email column)
  INSERT INTO profiles (id, organization_id, full_name, role)
  VALUES (
    NEW.id,
    org_id,
    TRIM(user_name || ' ' || user_surname),
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
