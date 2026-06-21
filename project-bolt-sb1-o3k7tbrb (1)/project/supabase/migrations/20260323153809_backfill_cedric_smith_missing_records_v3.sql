/*
  # Backfill Missing Records for Cedric Smith (v3)

  1. Problem
    - User cedric@email.com was created but the handle_new_user() trigger failed
    - Missing: profile, organization, and organization_users records
    - User can log in but gets "No organization found" error

  2. Solution
    - Manually create the missing records for this user
    - Create organization with user's name
    - Create profile linking user to organization
    - Create organization_users record with full permissions (main user)
    
  3. Data
    - Email: cedric@email.com
    - First Name: Cedric
    - Last Name: Smith
    - ID Number: 9506230542089
*/

DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_org_name text;
  v_email text := 'cedric@email.com';
BEGIN
  -- Get the user ID for Cedric
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  -- Only proceed if user exists and doesn't already have a profile
  IF v_user_id IS NOT NULL THEN
    -- Check if profile already exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) THEN
      
      v_org_name := 'Cedric Smith';
      
      -- Create organization
      INSERT INTO organizations (
        name, 
        status, 
        organization_type, 
        is_management_org,
        company_registration_number
      )
      VALUES (
        v_org_name, 
        'active', 
        'client', 
        false,
        '9506230542089'
      )
      RETURNING id INTO v_org_id;
      
      -- Create profile
      INSERT INTO profiles (
        id, 
        organization_id, 
        full_name, 
        role,
        id_number
      )
      VALUES (
        v_user_id,
        v_org_id,
        'Cedric Smith',
        'admin',
        '9506230542089'
      );
      
      -- Create organization_users entry with full permissions
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
        v_user_id, 
        v_org_id, 
        true, 
        true, 
        'main_user',
        'Main User', 
        'Cedric', 
        'Smith', 
        v_email
      );
      
      RAISE NOTICE 'Successfully created records for Cedric Smith (org_id: %)', v_org_id;
    ELSE
      RAISE NOTICE 'Profile already exists for %, skipping backfill', v_email;
    END IF;
  ELSE
    RAISE NOTICE 'User % not found, skipping backfill', v_email;
  END IF;
END $$;
