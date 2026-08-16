import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const { email, currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (newPassword !== confirmPassword) {
      return new Response(
        JSON.stringify({ error: "New passwords do not match" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      return new Response(
        JSON.stringify({
          error: "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character (!@#$%^&*)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Authenticate with email + current password instead of relying on the
    // session token, which may not be fully valid during a forced password change.
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError || !signInData.user) {
      return new Response(
        JSON.stringify({ error: "Current password is incorrect" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = signInData.user.id;

    // Update the password using the service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword },
    );

    if (updateError) {
      console.error("Failed to update password:", updateError);
      throw new Error("Failed to update password");
    }

    // Clear the password_change_required flag
    const { error: flagError } = await adminClient
      .from("profiles")
      .update({ password_change_required: false })
      .eq("id", userId);

    if (flagError) {
      console.error("Failed to clear password_change_required flag:", flagError);
    }

    // Also update the password in organization_users table
    await adminClient
      .from("organization_users")
      .update({ password: newPassword })
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password changed successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Change password error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to change password" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
