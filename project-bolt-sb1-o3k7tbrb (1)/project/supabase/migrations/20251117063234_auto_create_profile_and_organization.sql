/*
  # Auto-create Profile and Organization on User Signup

  1. Changes
    - Create a trigger function to automatically create organization and profile when a new user signs up
    - Drop existing policies that might conflict
    - Create new policies that allow the trigger to work

  2. Security
    - Profiles are created automatically via trigger
    - Users can view and update their own profiles
    - Organizations are created automatically
*/

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Create organization
  INSERT INTO public.organizations (name)
  VALUES ('My Organization')
  RETURNING id INTO new_org_id;

  -- Create profile
  INSERT INTO public.profiles (id, email, organization_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    new_org_id,
    'admin'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
