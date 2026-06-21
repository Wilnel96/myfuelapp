import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const email = 'shell.robertson@test.com';
    const password = 'Shell123!';
    const garageId = 'bf932c12-8ac3-4baf-9142-b794a0a021d7';
    const organizationId = '72443dcd-f70b-4a8b-8104-a96bac959458';

    console.log('Setting up Shell Robertson user account...');

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let userId: string;

    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      console.log('User already exists, updating password...');
      userId = existingUser.id;

      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: password }
      );

      if (updateError) {
        console.error('Error updating password:', updateError);
        throw new Error(`Failed to update password: ${updateError.message}`);
      }
    } else {
      // Create the user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: 'Shell Robertson',
          surname: 'Administrator'
        }
      });

      if (authError) {
        console.error('Error creating user:', authError);
        throw new Error(`Failed to create user: ${authError.message}`);
      }

      userId = authData.user.id;
    }

    console.log('User ID:', userId);

    // Create or update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        role: 'user',
        full_name: 'Shell Robertson Administrator',
        organization_id: organizationId
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    console.log('Profile created');

    // Create or update organization_users record
    const { error: orgUserError } = await supabase
      .from('organization_users')
      .upsert({
        organization_id: organizationId,
        user_id: userId,
        email: email,
        first_name: 'Shell Robertson',
        surname: 'Administrator',
        role: 'main_user',
        title: 'Main User',
        phone_mobile: null,
        phone_office: null,
        is_main_user: true,
        is_active: true,
        can_manage_users: true,
        can_add_vehicles: true,
        can_edit_vehicles: true,
        can_delete_vehicles: true,
        can_add_drivers: true,
        can_edit_drivers: true,
        can_delete_drivers: true,
        can_view_reports: true,
        can_view_financial_data: true
      }, {
        onConflict: 'organization_id,email'
      });

    if (orgUserError) {
      console.error('Error creating organization_users:', orgUserError);
      throw new Error(`Failed to create organization user: ${orgUserError.message}`);
    }

    console.log('Organization user created');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Shell Robertson user account created successfully',
        credentials: {
          email: email,
          password: password,
          garageId: garageId,
          organizationId: organizationId
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    );
  }
});
