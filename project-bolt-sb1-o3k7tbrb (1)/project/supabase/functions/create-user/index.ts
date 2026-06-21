import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  surname: string;
  title: string;
  organization_id?: string; // Optional: allows super admins to create users for specific organizations
  phone_office?: string;
  phone_mobile?: string;
  can_add_vehicles: boolean;
  can_edit_vehicles: boolean;
  can_delete_vehicles: boolean;
  can_add_drivers: boolean;
  can_edit_drivers: boolean;
  can_delete_drivers: boolean;
  can_view_reports: boolean;
  can_edit_organization_info: boolean;
  can_view_fuel_transactions: boolean;
  can_create_reports: boolean;
  can_view_custom_reports: boolean;
  can_manage_users: boolean;
  can_view_financial_data: boolean;
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
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('User profile not found');
    }

    const isSuperAdmin = profile.role === 'super_admin';
    const userData: CreateUserRequest = await req.json();

    let userOrgId: string;

    // If super admin specifies an organization_id, use that
    if (isSuperAdmin && userData.organization_id) {
      userOrgId = userData.organization_id;
    } else if (isSuperAdmin) {
      // Super admin without specified org - use their org
      userOrgId = profile.organization_id;
    } else {
      // Regular users - must be main user or have manage_users permission
      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('is_main_user, can_manage_users, organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!orgUser || (!orgUser.is_main_user && !orgUser.can_manage_users)) {
        throw new Error('Only main users or users with manage_users permission can create new users');
      }

      userOrgId = orgUser.organization_id;
    }

    if (!userOrgId) {
      throw new Error('No organization found');
    }

    // Verify the target organization exists and get its type
    const { data: targetOrg, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, organization_type, is_management_org')
      .eq('id', userOrgId)
      .maybeSingle();

    if (orgError || !targetOrg) {
      throw new Error('Target organization not found');
    }

    // Log for debugging
    console.log('Creating user for organization:', {
      id: targetOrg.id,
      name: targetOrg.name,
      type: targetOrg.organization_type,
      is_management: targetOrg.is_management_org
    });

    if (!userData.email || !userData.password || !userData.name || !userData.surname) {
      throw new Error('Email, password, name, and surname are required');
    }

    const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
    const authUserExists = existingAuthUser?.users.find(u => u.email === userData.email);

    let authUserId: string;

    if (authUserExists) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        authUserExists.id,
        { password: userData.password }
      );

      if (updateError) {
        console.error('Failed to update existing auth user password:', updateError);
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      authUserId = authUserExists.id;
    } else {
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name,
          surname: userData.surname,
          organization_id: userOrgId
        }
      });

      if (signUpError) {
        console.error('Failed to create user:', signUpError);
        throw new Error(`Failed to create user: ${signUpError.message}`);
      }

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      authUserId = authData.user.id;
    }

    const { data: existingOrgUser } = await supabase
      .from('organization_users')
      .select('id, user_id')
      .eq('email', userData.email)
      .eq('organization_id', userOrgId)
      .maybeSingle();

    if (existingOrgUser) {
      const { error: updateError } = await supabase
        .from('organization_users')
        .update({
          user_id: authUserId,
          first_name: userData.name,
          surname: userData.surname,
          title: userData.title,
          password: userData.password,
          phone_office: userData.phone_office || null,
          phone_mobile: userData.phone_mobile || null,
          can_add_vehicles: userData.can_add_vehicles,
          can_edit_vehicles: userData.can_edit_vehicles,
          can_delete_vehicles: userData.can_delete_vehicles,
          can_add_drivers: userData.can_add_drivers,
          can_edit_drivers: userData.can_edit_drivers,
          can_delete_drivers: userData.can_delete_drivers,
          can_view_reports: userData.can_view_reports,
          can_edit_organization_info: userData.can_edit_organization_info,
          can_view_fuel_transactions: userData.can_view_fuel_transactions,
          can_create_reports: userData.can_create_reports,
          can_view_custom_reports: userData.can_view_custom_reports,
          can_manage_users: userData.can_manage_users,
          can_view_financial_data: userData.can_view_financial_data,
          is_active: true
        })
        .eq('id', existingOrgUser.id);

      if (updateError) {
        console.error('Failed to update organization_users:', updateError);
        if (!authUserExists) {
          await supabase.auth.admin.deleteUser(authUserId);
        }
        throw new Error(`Failed to update user record: ${updateError.message}`);
      }
    } else {
      const { error: orgUserError } = await supabase
        .from('organization_users')
        .insert({
          user_id: authUserId,
          email: userData.email,
          first_name: userData.name,
          surname: userData.surname,
          title: userData.title,
          password: userData.password,
          phone_office: userData.phone_office || null,
          phone_mobile: userData.phone_mobile || null,
          organization_id: userOrgId,
          is_main_user: false,
          can_add_vehicles: userData.can_add_vehicles,
          can_edit_vehicles: userData.can_edit_vehicles,
          can_delete_vehicles: userData.can_delete_vehicles,
          can_add_drivers: userData.can_add_drivers,
          can_edit_drivers: userData.can_edit_drivers,
          can_delete_drivers: userData.can_delete_drivers,
          can_view_reports: userData.can_view_reports,
          can_edit_organization_info: userData.can_edit_organization_info,
          can_view_fuel_transactions: userData.can_view_fuel_transactions,
          can_create_reports: userData.can_create_reports,
          can_view_custom_reports: userData.can_view_custom_reports,
          can_manage_users: userData.can_manage_users,
          can_view_financial_data: userData.can_view_financial_data,
          is_active: true
        });

      if (orgUserError) {
        console.error('Failed to link user to organization:', orgUserError);
        if (!authUserExists) {
          await supabase.auth.admin.deleteUser(authUserId);
        }
        throw new Error(`Failed to link user to organization: ${orgUserError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authUserId,
          email: userData.email,
          name: userData.name,
          surname: userData.surname,
          title: userData.title
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
    console.error('Error creating user:', error);
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
