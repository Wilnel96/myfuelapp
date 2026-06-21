import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UpdatePasswordRequest {
  user_id?: string;
  email?: string;
  new_password: string;
  newPassword?: string;
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

    // Parse request body
    const body: UpdatePasswordRequest = await req.json();
    const new_password = body.new_password || body.newPassword;

    if (!new_password) {
      throw new Error('New password is required');
    }

    if (new_password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // If email is provided (public password reset without auth)
    if (body.email) {
      // Find user by email
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

      if (listError) {
        throw new Error('Failed to find user');
      }

      const targetUser = users.find(u => u.email === body.email);

      if (!targetUser) {
        throw new Error('User not found');
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        targetUser.id,
        { password: new_password }
      );

      if (updateError) {
        console.error('Failed to update password:', updateError);
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      // Also update the password in organization_users table
      await supabase
        .from('organization_users')
        .update({ password: new_password })
        .eq('user_id', targetUser.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Password updated successfully'
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          status: 200,
        }
      );
    }

    // Otherwise, use authenticated flow with user_id
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has permission (main user, can_manage_users, or super admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('User profile not found');
    }

    const isSuperAdmin = profile.role === 'super_admin';
    const user_id = body.user_id;

    // If not super admin, check if they're a main user or have manage_users permission
    if (!isSuperAdmin) {
      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('is_main_user, can_manage_users, organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!orgUser || (!orgUser.is_main_user && !orgUser.can_manage_users)) {
        throw new Error('Only main users or users with manage_users permission can update passwords');
      }

      // Verify the target user belongs to the same organization
      const { data: targetOrgUser } = await supabase
        .from('organization_users')
        .select('organization_id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (!targetOrgUser || targetOrgUser.organization_id !== orgUser.organization_id) {
        throw new Error('You can only update passwords for users in your organization');
      }
    }

    if (!user_id) {
      throw new Error('User ID is required');
    }

    // Update the user's password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    );

    if (updateError) {
      console.error('Failed to update password:', updateError);
      throw new Error(`Failed to update password: ${updateError.message}`);
    }

    // Also update the password in organization_users table
    const { error: orgUpdateError } = await supabase
      .from('organization_users')
      .update({ password: new_password })
      .eq('user_id', user_id);

    if (orgUpdateError) {
      console.error('Failed to update password in organization_users:', orgUpdateError);
      // Don't throw error here - auth password was updated successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password updated successfully'
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
    console.error('Error updating password:', error);
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