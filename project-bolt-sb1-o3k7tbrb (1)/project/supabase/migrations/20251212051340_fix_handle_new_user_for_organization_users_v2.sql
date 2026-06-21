/*
  # Fix handle_new_user for Organization Users (v2)
  
  1. Problem
    - The handle_new_user() trigger was overwritten and lost the organization user check
    - When creating users via edge function with organization_id in metadata, it tries to create duplicate organizations/profiles
    - This causes "Database error creating new user"
  
  2. Solution
    - Update handle_new_user() to check if organization_id exists in user metadata
    - If it exists, this is an organization user being created by edge function -> skip profile creation
    - Otherwise, proceed with normal signup flow (create org + profile + org_user)
  
  3. Logic Flow
    - Check if raw_user_meta_data contains 'organization_id'
    - If YES: Return early (organization_users entry will be created by edge function)
    - If NO: Create organization, profile, and organization_users entry (normal signup)
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
  
  -- Create organization_users entry
  INSERT INTO organization_users (user_id, organization_id, is_main_user, is_active, title, first_name, surname, email)
  VALUES (NEW.id, org_id, true, true, 'Main User', user_name, user_surname, NEW.email);
  
  RETURN NEW;
END;
$function$;
