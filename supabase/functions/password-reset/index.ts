import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateTempPassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const special = "!@#$%^&*";
  const all = lower + upper + numbers + special;

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  // Guarantee at least one of each category
  let password = pick(lower) + pick(upper) + pick(numbers) + pick(special);
  for (let i = 0; i < 8; i++) {
    password += pick(all);
  }
  // Shuffle
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find the user by email
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      throw new Error("Failed to look up user");
    }

    const targetUser = users.find((u) => u.email === email);

    // Always return a generic success message even if user not found,
    // to prevent email enumeration attacks
    if (!targetUser) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "If an account exists for that email, a temporary password has been sent.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tempPassword = generateTempPassword();

    // Update the user's auth password with the temporary one
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUser.id,
      { password: tempPassword },
    );

    if (updateError) {
      console.error("Failed to set temp password:", updateError);
      throw new Error("Failed to process password reset");
    }

    // Set the password_change_required flag on the profile
    const { error: flagError } = await adminClient
      .from("profiles")
      .update({ password_change_required: true })
      .eq("id", targetUser.id);

    if (flagError) {
      console.error("Failed to set password_change_required flag:", flagError);
      // Don't throw — the password was already changed, the flag is a bonus
    }

    // Also update the password in organization_users table for consistency
    await adminClient
      .from("organization_users")
      .update({ password: tempPassword })
      .eq("user_id", targetUser.id);

    // Send the email with the temporary password
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    let emailError = "";

    if (resendApiKey) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">MyFuelApp</h1>
            <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Password Reset</p>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; font-size: 20px; margin-top: 0;">Your temporary password</h2>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
              You have requested a password reset for your MyFuelApp account.
              Use the temporary password below to log in. You will be asked to choose
              a new password after signing in.
            </p>
            <div style="background: #ffffff; border: 2px dashed #2563eb; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 22px; font-weight: bold; color: #2563eb; letter-spacing: 2px; font-family: monospace;">${tempPassword}</span>
            </div>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
              After logging in with this temporary password, you must set a new password
              that meets the following requirements:
            </p>
            <ul style="color: #4b5563; font-size: 14px; line-height: 1.8;">
              <li>At least 8 characters long</li>
              <li>Contains at least one uppercase letter</li>
              <li>Contains at least one lowercase letter</li>
              <li>Contains at least one number</li>
              <li>Contains at least one special character (!@#$%^&*)</li>
            </ul>
            <p style="color: #6b7280; font-size: 13px; margin-top: 25px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
              If you did not request this password reset, please contact your account administrator immediately.
            </p>
          </div>
        </div>
      `;
      const emailText = `MyFuelApp Password Reset\n\nYour temporary password is: ${tempPassword}\n\nUse this to log in, then you will be asked to choose a new password.\n\nIf you did not request this reset, contact your administrator immediately.`;

      // Try sending from the verified domain first
      const fromAddresses = [
        "MyFuelApp <noreply@myfuelapp.net>",
        "MyFuelApp <onboarding@resend.dev>",
      ];

      for (const fromAddr of fromAddresses) {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [email],
            subject: "Your Temporary Password - MyFuelApp",
            html: emailHtml,
            text: emailText,
          }),
        });

        if (emailResponse.ok) {
          emailSent = true;
          break;
        }

        const errBody = await emailResponse.text();
        emailError = `${fromAddr}: ${errBody}`;
        console.error(`Failed to send from ${fromAddr}:`, errBody);
        // Try the next from address
      }
    } else {
      emailError = "RESEND_API_KEY not configured";
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        debug: !emailSent ? `Email failed: ${emailError}` : undefined,
        message: emailSent
          ? "If an account exists for that email, a temporary password has been sent."
          : "Password was reset but the email could not be delivered. Please contact your administrator.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Password reset error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process password reset" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
