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
  // Guarantee at least one of each required type
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

    // Permission check
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

    // Get the current email address (for notification)
    const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);
    const oldEmail = targetUser?.user?.email || '';

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

    // Generate a temporary password
    const tempPassword = generateTempPassword();

    // Update the auth user's email AND password in one call
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user_id,
      { email: new_email, password: tempPassword, email_confirm: true }
    );

    if (updateError) {
      console.error('Failed to update auth email:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update email: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update the email and password in organization_users table
    const { error: orgUpdateError } = await adminClient
      .from('organization_users')
      .update({ email: new_email, password: tempPassword })
      .eq('user_id', user_id);

    if (orgUpdateError) {
      console.error('Failed to update organization_users:', orgUpdateError);
    }

    // Set password_change_required flag so user must choose a new password on next login
    const { error: flagError } = await adminClient
      .from('profiles')
      .update({ password_change_required: true })
      .eq('id', user_id);

    if (flagError) {
      console.error('Failed to set password_change_required flag:', flagError);
    }

    // Send the temporary password to the NEW email address
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      const fromAddresses = [
        'MyFuelApp <noreply@myfuelapp.net>',
        'MyFuelApp <onboarding@resend.dev>',
      ];

      const newEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">MyFuelApp</h1>
            <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Email Address Changed</p>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; font-size: 20px; margin-top: 0;">Your sign-in email has been updated</h2>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
              The email address associated with your MyFuelApp account has been changed from
              <strong>${oldEmail}</strong> to <strong>${new_email}</strong>.
              A new temporary password has been generated for security. Please use the temporary
              password below to sign in, then choose a new password.
            </p>
            <div style="background: #ffffff; border: 2px dashed #2563eb; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 22px; font-weight: bold; color: #2563eb; letter-spacing: 2px; font-family: monospace;">${tempPassword}</span>
            </div>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
              After signing in with this temporary password, you must set a new password
              that meets the following requirements:
            </p>
            <ul style="color: #4b5563; font-size: 14px; line-height: 1.8;">
              <li>At least 8 characters long</li>
              <li>Contains at least one uppercase letter</li>
              <li>Contains at least one lowercase letter</li>
              <li>Contains at least one number</li>
              <li>Contains at least one special character (!@#$%^&amp;*)</li>
            </ul>
            <p style="color: #6b7280; font-size: 13px; margin-top: 25px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
              If you did not request this change, please contact your account administrator immediately.
            </p>
          </div>
        </div>
      `;
      const newEmailText = `MyFuelApp - Email Address Changed\n\nYour sign-in email has been changed from ${oldEmail} to ${new_email}.\n\nYour temporary password is: ${tempPassword}\n\nUse this to sign in, then you will be asked to choose a new password.\n\nIf you did not request this change, contact your administrator immediately.`;

      for (const fromAddr of fromAddresses) {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [new_email],
            subject: 'Your Email Has Changed - MyFuelApp',
            html: newEmailHtml,
            text: newEmailText,
          }),
        });

        if (emailResponse.ok) break;
        console.error(`Failed to send to new address from ${fromAddr}:`, await emailResponse.text());
      }

      // Also send a notification to the OLD email address
      if (oldEmail && oldEmail.toLowerCase() !== new_email.toLowerCase()) {
        const oldEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">MyFuelApp</h1>
              <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Security Alert</p>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
              <h2 style="color: #1f2937; font-size: 20px; margin-top: 0;">Your email address has been changed</h2>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                The email address associated with your MyFuelApp account has been changed from
                <strong>${oldEmail}</strong> to <strong>${new_email}</strong>.
              </p>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                A new temporary password has been sent to the new email address. Your old password
                is no longer valid.
              </p>
              <p style="color: #6b7280; font-size: 13px; margin-top: 25px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
                If you did not request this change, please contact your account administrator immediately.
              </p>
            </div>
          </div>
        `;
        const oldEmailText = `MyFuelApp Security Alert\n\nYour email address has been changed from ${oldEmail} to ${new_email}.\n\nA new temporary password has been sent to the new email address. Your old password is no longer valid.\n\nIf you did not request this change, contact your administrator immediately.`;

        for (const fromAddr of fromAddresses) {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromAddr,
              to: [oldEmail],
              subject: 'Security Alert: Your Email Has Been Changed - MyFuelApp',
              html: oldEmailHtml,
              text: oldEmailText,
            }),
          });

          if (emailResponse.ok) break;
          console.error(`Failed to send to old address from ${fromAddr}:`, await emailResponse.text());
        }
      }
    }

    // If the caller changed their own email, sign them out
    const selfChange = user.id === user_id;

    return new Response(
      JSON.stringify({
        success: true,
        self_change: selfChange,
        message: 'Email updated successfully. A temporary password has been sent to the new email address. The user must sign in with the new email and temporary password, then choose a new password.',
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
