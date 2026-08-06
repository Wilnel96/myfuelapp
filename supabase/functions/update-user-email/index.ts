import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const { user_id, new_email } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!new_email || typeof new_email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'New email address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get the caller's profile
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Your profile was not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const isSuperAdmin = callerProfile.role === 'super_admin';

    // Permission check: super admin, main user, secondary main user, or can_manage_users
    if (!isSuperAdmin) {
      const { data: callerOrgUser } = await adminClient
        .from('organization_users')
        .select('is_main_user, is_secondary_main_user, can_manage_users, organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!callerOrgUser || (!callerOrgUser.is_main_user && !callerOrgUser.is_secondary_main_user && !callerOrgUser.can_manage_users)) {
        return new Response(
          JSON.stringify({ error: 'You do not have permission to change email addresses' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Verify the target user belongs to the same organization
      const { data: targetOrgUser } = await adminClient
        .from('organization_users')
        .select('organization_id')
        .eq('user_id', user_id)
        .maybeSingle();

      if (!targetOrgUser || targetOrgUser.organization_id !== callerOrgUser.organization_id) {
        return new Response(
          JSON.stringify({ error: 'You can only change email for users in your organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Check if the new email is already in use by another auth user
    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers();
    const conflictingUser = existingUsers.find(
      (u) => u.email?.toLowerCase() === new_email.toLowerCase() && u.id !== user_id
    );

    if (conflictingUser) {
      return new Response(
        JSON.stringify({ error: 'This email address is already in use by another account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update the auth user's email
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user_id,
      { email: new_email, email_confirm: true }
    );

    if (updateError) {
      console.error('Failed to update auth email:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update email: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update the email in organization_users table
    const { error: orgUpdateError } = await adminClient
      .from('organization_users')
      .update({ email: new_email })
      .eq('user_id', user_id);

    if (orgUpdateError) {
      console.error('Failed to update organization_users email:', orgUpdateError);
      // Auth email was updated, so still return success
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email address updated successfully. The user will need to sign in with the new email address.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Error changing email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to change email address' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
