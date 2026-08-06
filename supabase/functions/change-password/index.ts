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
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
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

    // Get the access token from the Authorization header to identify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify the current password by attempting a sign-in
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userEmail = userData.user.email;
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "Unable to verify account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify current password by signing in with it
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (signInError) {
      return new Response(
        JSON.stringify({ error: "Current password is incorrect" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update the password using the service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userData.user.id,
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
      .eq("id", userData.user.id);

    if (flagError) {
      console.error("Failed to clear password_change_required flag:", flagError);
    }

    // Also update the password in organization_users table
    await adminClient
      .from("organization_users")
      .update({ password: newPassword })
      .eq("user_id", userData.user.id);

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
