/*
  # Fix User Signup to Link to Existing Organizations

  1. Changes
    - Update the handle_new_user() function to check for existing organizations by email
    - If an organization exists with the user's email, link the profile to that organization
    - If no organization exists, create a new one (default behavior)
    - Extract full name from email metadata if available

  2. Logic Flow
    - When a new user signs up with email (e.g., koos@wcroads.gov.za)
    - Check if any organization has that email in their email field
    - If found: Link the user profile to that existing organization
    - If not found: Create a new organization called "My Organization"

  3. Security
    - Function runs with SECURITY DEFINER to allow inserting into profiles
    - Maintains existing RLS policies
*/

-- Update function to handle new user signup with organization matching
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id uuid;
  existing_org_id uuid;
  user_full_name text;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
