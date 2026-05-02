import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UserToCreate {
  email: string;
  password: string;
  name: string;
  surname: string;
  title?: string;
  phone_office?: string;
  phone_mobile?: string;
  is_main_user: boolean;
  role: string;
  can_add_vehicles?: boolean;
  can_edit_vehicles?: boolean;
  can_delete_vehicles?: boolean;
  can_add_drivers?: boolean;
  can_edit_drivers?: boolean;
  can_delete_drivers?: boolean;
  can_view_reports?: boolean;
  can_edit_organization_info?: boolean;
  can_view_fuel_transactions?: boolean;
  can_create_reports?: boolean;
  can_view_custom_reports?: boolean;
  can_manage_users?: boolean;
  can_view_financial_data?: boolean;
}

interface RequestBody {
  organization_id: string;
  users: UserToCreate[];
}

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'super_admin') {
      throw new Error('Only super admins can create organization users');
    }

    const { organization_id, users }: RequestBody = await req.json();

    if (!organization_id || !users || users.length === 0) {
      throw new Error('organization_id and users array are required');
    }

    const createdUsers = [];

    for (const userData of users) {
      // Check if user already exists in this organization
      const { data: existingUser } = await supabase
        .from('organization_users')
        .select('id, email')
        .eq('organization_id', organization_id)
        .eq('email', userData.email)
        .maybeSingle();

      if (existingUser) {
        throw new Error(`A user with email ${userData.email} already exists in this organization`);
      }

      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name,
          surname: userData.surname,
          organization_id: organization_id
        }
      });

      if (signUpError) {
        console.error(`Failed to create auth user:`, signUpError);
        throw new Error(`Failed to create auth user: ${signUpError.message}`);
      }

      if (authData.user) {
        const permissions = userData.is_main_user ? {
          can_add_vehicles: true,
          can_edit_vehicles: true,
          can_delete_vehicles: true,
          can_add_drivers: true,
          can_edit_drivers: true,
          can_delete_drivers: true,
          can_view_reports: true,
          can_edit_organization_info: true,
          can_view_fuel_transactions: true,
          can_create_reports: true,
          can_view_custom_reports: true,
          can_manage_users: true,
          can_view_financial_data: true,
        } : {
          can_add_vehicles: userData.can_add_vehicles ?? false,
          can_edit_vehicles: userData.can_edit_vehicles ?? false,
          can_delete_vehicles: userData.can_delete_vehicles ?? false,
          can_add_drivers: userData.can_add_drivers ?? false,
          can_edit_drivers: userData.can_edit_drivers ?? false,
          can_delete_drivers: userData.can_delete_drivers ?? false,
          can_view_reports: userData.can_view_reports ?? false,
          can_edit_organization_info: userData.can_edit_organization_info ?? false,
          can_view_fuel_transactions: userData.can_view_fuel_transactions ?? false,
          can_create_reports: userData.can_create_reports ?? false,
          can_view_custom_reports: userData.can_view_custom_reports ?? false,
          can_manage_users: userData.can_manage_users ?? false,
          can_view_financial_data: userData.can_view_financial_data ?? false,
        };

        const title = userData.title || (userData.is_main_user ? 'Main User' : 'User');

        const { error: orgUserError } = await supabase
          .from('organization_users')
          .insert({
            user_id: authData.user.id,
            email: userData.email,
            first_name: userData.name,
            surname: userData.surname,
            title: title,
            password: userData.password,
            phone_office: userData.phone_office || null,
            phone_mobile: userData.phone_mobile || null,
            organization_id: organization_id,
            is_main_user: userData.is_main_user,
            is_active: true,
            ...permissions,
          });

        if (orgUserError) {
          console.error(`Failed to insert into organization_users:`, orgUserError);
          // Clean up auth user if org user creation fails
          await supabase.auth.admin.deleteUser(authData.user.id);
          throw new Error(`Failed to create organization user: ${orgUserError.message || orgUserError.toString()}`);
        }

        // Create profile for the user
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            organization_id: organization_id,
            full_name: `${userData.name} ${userData.surname}`,
            role: userData.role,
          });

        if (profileError) {
          console.error(`Failed to create profile:`, profileError);
          // Clean up if profile creation fails
          await supabase.from('organization_users').delete().eq('user_id', authData.user.id);
          await supabase.auth.admin.deleteUser(authData.user.id);
          throw new Error(`Failed to create profile: ${profileError.message || profileError.toString()}`);
        }

        createdUsers.push({
          user_id: authData.user.id,
          email: userData.email,
          role: userData.role
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, users: createdUsers }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating organization users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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