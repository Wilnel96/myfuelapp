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

// Same rule as the change-password function.
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: UpdatePasswordRequest = await req.json();
    const new_password = body.new_password || body.newPassword;

    if (!new_password) {
      return json({ success: false, error: 'New password is required' }, 400);
    }

    if (!STRONG_PASSWORD_REGEX.test(new_password)) {
      return json(
        {
          success: false,
          error:
            'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character',
        },
        400,
      );
    }

    // Every caller must prove who they are. There is no unauthenticated path.
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return json({ success: false, error: 'Unauthorized' }, 403);
    }

    const isSuperAdmin = profile.role === 'super_admin';

    // Resolve the target user. An email may be supplied, but only after the
    // caller has been authenticated and authorized for that target.
    let user_id = body.user_id;

    if (!user_id && body.email) {
      const { data: targetOrgUserByEmail } = await supabase
        .from('organization_users')
        .select('user_id')
        .ilike('email', body.email)
        .maybeSingle();

      user_id = targetOrgUserByEmail?.user_id ?? undefined;

      if (!user_id) {
        // Do not reveal whether the address exists.
        return json({ success: false, error: 'Unable to update password' }, 400);
      }
    }

    if (!user_id) {
      return json({ success: false, error: 'User ID is required' }, 400);
    }

    if (!isSuperAdmin) {
      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('is_main_user, can_manage_users, organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      const selfService = user_id === user.id;

      if (!selfService) {
        if (!orgUser || (!orgUser.is_main_user && !orgUser.can_manage_users)) {
          return json(
            {
              success: false,
              error:
                'Only main users or users with manage_users permission can update passwords',
            },
            403,
          );
        }

        const { data: targetOrgUser } = await supabase
          .from('organization_users')
          .select('organization_id')
          .eq('user_id', user_id)
          .maybeSingle();

        if (!targetOrgUser || targetOrgUser.organization_id !== orgUser.organization_id) {
          return json(
            {
              success: false,
              error: 'You can only update passwords for users in your organization',
            },
            403,
          );
        }
      }
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user_id,
      { password: new_password },
    );

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return json({ success: false, error: 'Failed to update password' }, 400);
    }

    // The credential itself lives in Supabase Auth only. It is never mirrored
    // into a readable table.

    return json({ success: true, message: 'Password updated successfully' }, 200);
  } catch (error) {
    console.error('Error updating password:', error);
    return json({ success: false, error: 'Unable to update password' }, 400);
  }
});
