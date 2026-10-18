import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;
  let pw = '';
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  pw += upper[arr[0] % upper.length];
  pw += lower[arr[1] % lower.length];
  pw += digits[arr[2] % digits.length];
  pw += special[arr[3] % special.length];
  for (let i = 4; i < 14; i++) {
    pw += all[arr[i] % all.length];
  }
  return pw;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
    const {
      user_id,
      first_name,
      surname,
      phone_office,
      phone_mobile,
      new_email,
      new_password,
    } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get the caller's profile and org
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

    // Determine caller's authority. Management users (in a management org) or
    // main/secondary main users with can_manage_users may edit client org users.
    let isManagementUser = false;
    let callerOrgId: string | null = callerProfile.organization_id;

    if (!isSuperAdmin) {
      const { data: callerOrg } = await adminClient
        .from('organizations')
        .select('id, is_management_org, organization_type')
        .eq('id', callerProfile.organization_id)
        .maybeSingle();

      isManagementUser = callerOrg?.is_management_org === true || callerOrg?.organization_type === 'management';

      if (!isManagementUser) {
        // Same-org main/secondary/can_manage_users may also edit
        const { data: callerOrgUser } = await adminClient
          .from('organization_users')
          .select('is_main_user, is_secondary_main_user, can_manage_users, organization_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!callerOrgUser || (!callerOrgUser.is_main_user && !callerOrgUser.is_secondary_main_user && !callerOrgUser.can_manage_users)) {
          return new Response(
            JSON.stringify({ error: 'You do not have permission to edit users' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        callerOrgId = callerOrgUser.organization_id;
      }
    }

    // Fetch the target user's org to verify access
    const { data: targetOrgUser } = await adminClient
      .from('organization_users')
      .select('organization_id, email, is_main_user')
      .eq('user_id', user_id)
      .maybeSingle();

    if (!targetOrgUser) {
      return new Response(
        JSON.stringify({ error: 'Target user was not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Super admin or management user can edit any client org user.
    // Same-org privileged user can edit users in their own org.
    if (!isSuperAdmin && !isManagementUser) {
      if (targetOrgUser.organization_id !== callerOrgId) {
        return new Response(
          JSON.stringify({ error: 'You can only edit users in your organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Management users cannot edit other management org users (only client org users)
    if (isManagementUser && !isSuperAdmin) {
      const { data: targetOrg } = await adminClient
        .from('organizations')
        .select('is_management_org, organization_type')
        .eq('id', targetOrgUser.organization_id)
        .maybeSingle();

      if (targetOrg?.is_management_org === true || targetOrg?.organization_type === 'management') {
        return new Response(
          JSON.stringify({ error: 'Management users cannot edit other management organization users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const updates: Record<string, any> = {};
    if (typeof first_name === 'string' && first_name.trim()) updates.first_name = first_name.trim();
    if (typeof surname === 'string') updates.surname = surname.trim();
    if (phone_office !== undefined) updates.phone_office = phone_office?.trim() || null;
    if (phone_mobile !== undefined) updates.phone_mobile = phone_mobile?.trim() || null;

    // Update basic fields in organization_users
    if (Object.keys(updates).length > 0) {
      const { error: orgUpdateError } = await adminClient
        .from('organization_users')
        .update(updates)
        .eq('user_id', user_id);

      if (orgUpdateError) {
        console.error('Failed to update organization_users:', orgUpdateError);
        return new Response(
          JSON.stringify({ error: `Failed to update user: ${orgUpdateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    let emailChanged = false;
    let emailMessage = '';

    // Handle email change (with temp password + notification, like update-user-email)
    if (new_email && typeof new_email === 'string' && new_email.trim().toLowerCase() !== (targetOrgUser.email || '').toLowerCase()) {
      const newEmailTrimmed = new_email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmailTrimmed)) {
        return new Response(
          JSON.stringify({ error: 'Please enter a valid email address' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Check email not in use
      const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers();
      const conflictingUser = existingUsers.find(
        (u) => u.email?.toLowerCase() === newEmailTrimmed.toLowerCase() && u.id !== user_id
      );
      if (conflictingUser) {
        return new Response(
          JSON.stringify({ error: 'This email address is already in use by another account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const oldEmail = targetOrgUser.email || '';
      const tempPassword = generateTempPassword();

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        user_id,
        { email: newEmailTrimmed, password: tempPassword, email_confirm: true }
      );

      if (updateError) {
        console.error('Failed to update auth email:', updateError);
        return new Response(
          JSON.stringify({ error: `Failed to update email: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      await adminClient
        .from('organization_users')
        .update({ email: newEmailTrimmed })
        .eq('user_id', user_id);

      await adminClient
        .from('profiles')
        .update({ password_change_required: true })
        .eq('id', user_id);

      emailChanged = true;

      // Send the temp password to the new email
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const fromAddresses = [
          'MyFuelApp <noreply@myfuelapp.net>',
          'MyFuelApp <onboarding@resend.dev>',
        ];
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">MyFuelApp</h1>
              <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Email Address Changed</p>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
              <h2 style="color: #1f2937; font-size: 20px; margin-top: 0;">Your sign-in email has been updated</h2>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                The email address associated with your MyFuelApp account has been changed from
                <strong>${oldEmail}</strong> to <strong>${newEmailTrimmed}</strong>.
                A new temporary password has been generated for security. Please use the temporary
                password below to sign in, then choose a new password.
              </p>
              <div style="background: #ffffff; border: 2px dashed #2563eb; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <span style="font-size: 22px; font-weight: bold; color: #2563eb; letter-spacing: 2px; font-family: monospace;">${tempPassword}</span>
              </div>
              <p style="color: #6b7280; font-size: 13px; margin-top: 25px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
                If you did not request this change, please contact your account administrator immediately.
              </p>
            </div>
          </div>
        `;
        const text = `MyFuelApp - Email Address Changed\n\nYour sign-in email has been changed from ${oldEmail} to ${newEmailTrimmed}.\n\nYour temporary password is: ${tempPassword}\n\nUse this to sign in, then you will be asked to choose a new password.`;

        for (const fromAddr of fromAddresses) {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: fromAddr, to: [newEmailTrimmed], subject: 'Your Email Has Changed - MyFuelApp', html, text }),
          });
          if (emailResponse.ok) break;
        }
      }

      emailMessage = 'Email changed — a temporary password was sent to the new address.';
    }

    // Handle password reset (only if email is NOT changing, since email change sets its own temp password)
    let passwordMessage = '';
    if (new_password && typeof new_password === 'string' && new_password.trim() && !emailChanged) {
      if (new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 6 characters long' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { error: pwdError } = await adminClient.auth.admin.updateUserById(
        user_id,
        { password: new_password.trim() }
      );

      if (pwdError) {
        return new Response(
          JSON.stringify({ error: `Failed to update password: ${pwdError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      await adminClient
        .from('profiles')
        .update({ password_change_required: true })
        .eq('id', user_id);

      passwordMessage = 'Password updated.';
    }

    const selfChange = user.id === user_id;
    const parts: string[] = [];
    if (emailMessage) parts.push(emailMessage);
    if (passwordMessage) parts.push(passwordMessage);
    if (Object.keys(updates).length > 0) parts.push('User details updated');
    if (parts.length === 0) parts.push('No changes to save');

    return new Response(
      JSON.stringify({
        success: true,
        self_change: selfChange,
        message: parts.join(' '),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Error updating organization user:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
