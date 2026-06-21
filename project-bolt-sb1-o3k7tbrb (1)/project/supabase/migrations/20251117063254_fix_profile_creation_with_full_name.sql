/*
  # Fix Profile Creation to Include full_name

  1. Changes
    - Update trigger function to include full_name field
    - Extract name from email as default full_name

  2. Security
    - Maintains existing security model
*/

-- Update function to handle new user signup with full_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id uuid;
  user_full_name text;
BEGIN
  -- Extract name from email (part before @)
  user_full_name := split_part(NEW.email, '@', 1);
  
  -- Create organization
  INSERT INTO public.organizations (name)
  VALUES ('My Organization')
  RETURNING id INTO new_org_id;

  -- Create profile with full_name
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
