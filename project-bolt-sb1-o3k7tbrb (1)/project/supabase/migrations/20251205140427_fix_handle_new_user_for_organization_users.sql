/*
  # Fix handle_new_user trigger for organization users

  1. Changes
    - Update handle_new_user() function to skip profile creation when organization_id is in metadata
    - Organization users should only be created in organization_users table, not profiles table
    - Regular users (main account holders) still get profiles created automatically

  2. Logic
    - If user_metadata contains organization_id, this is an organization user -> skip profile creation
    - Otherwise, create profile as normal (existing behavior for main users)
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  new_org_id uuid;
  existing_org_id uuid;
  user_full_name text;
  is_org_user boolean;
BEGIN
  -- Check if this is an organization user (has organization_id in metadata)
  is_org_user := (NEW.raw_user_meta_data->>'organization_id') IS NOT NULL;
  
  -- If this is an organization user, skip profile creation (will be created in organization_users)
  IF is_org_user THEN
    RETURN NEW;
  END IF;

  -- Below is for regular users (main account holders)
  -- Try to extract full name from user metadata
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Check if an organization exists with this email
  SELECT id INTO existing_org_id
  FROM public.organizations
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  -- If organization exists, use it; otherwise create new one
  IF existing_org_id IS NOT NULL THEN
    new_org_id := existing_org_id;
  ELSE
    -- Create new organization
    INSERT INTO public.organizations (name)
    VALUES ('My Organization')
    RETURNING id INTO new_org_id;
  END IF;

  -- Create profile linked to the organization
  INSERT INTO public.profiles (id, email, full_name, organization_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    new_org_id,
    'admin'
  );

  RETURN NEW;
END;
$function$;
