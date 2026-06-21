/*
  # Fix handle_new_user to Support Both Name Formats

  1. Problem
    - The handle_new_user() trigger expects 'name' and 'surname' in metadata
    - Some signups may send 'first_name' and 'last_name' instead
    - This causes the trigger to use empty strings, which breaks profile/org creation
    - Users can log in but have no organization (NULL profile/org records)

  2. Solution
    - Update handle_new_user() to check for both metadata field formats
    - Try 'name' and 'surname' first (current format)
    - Fall back to 'first_name' and 'last_name' if not found
    - Also support 'first_name' and 'surname' combinations
    
  3. Changes
    - Enhanced metadata extraction with fallback logic
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
  
  -- Create profile
  INSERT INTO profiles (id, organization_id, email, full_name, role)
  VALUES (
    NEW.id,
    org_id,
    NEW.email,
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
