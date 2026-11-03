import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  organization_id: string;
  vehicle_registration: string;
  vehicle_make: string;
  vehicle_model: string;
  driver_name: string;
  previous_driver_name: string;
  last_draw_date: string;
  days_unreturned: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();

    const { data: orgUsers, error: orgUsersError } = await supabase
      .from("organization_users")
      .select("email")
      .eq("organization_id", body.organization_id)
      .in("title", ["main_user", "vehicle_user"])
      .eq("active", true);

    if (orgUsersError) {
      return new Response(
        JSON.stringify({ success: false, error: orgUsersError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("email")
      .eq("id", body.driver_id)
      .maybeSingle();

    if (driverError) {
      return new Response(
        JSON.stringify({ success: false, error: driverError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipients = [
      ...(orgUsers ?? []).map((u: { email: string }) => u.email),
      driver?.email,
    ].filter((e): e is string => typeof e === "string" && e.length > 0);
    const uniqueRecipients = [...new Set(recipients)];

    if (uniqueRecipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No recipients found for this organization" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = `Vehicle Not Returned: ${body.vehicle_registration}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #d97706; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Vehicle Not Returned</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>A vehicle was drawn by a new driver before the previous driver logged a Return Vehicle. The draw was allowed, a Return Vehicle has been logged for the previous driver, and an exception has been recorded.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Vehicle:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${body.vehicle_registration} (${body.vehicle_make} ${body.vehicle_model})</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Drawn By:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${body.driver_name}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Previous Driver:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${body.previous_driver_name}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Previous Draw Date:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${body.last_draw_date}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Days Unreturned:</td><td style="padding: 8px; color: #d97706; font-weight: bold;">${body.days_unreturned}</td></tr>
          </table>

          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">This is an automated message from MyFuelApp.</p>
        </div>
      </div>
    `;

    const fromAddresses = [
      "MyFuelApp <noreply@myfuelapp.net>",
      "MyFuelApp <onboarding@resend.dev>",
    ];

    let lastError = "";
    for (const fromAddr of fromAddresses) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddr,
          to: uniqueRecipients,
          subject,
          html,
        }),
      });

      if (response.ok) {
        return new Response(
          JSON.stringify({ success: true, recipients: uniqueRecipients }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      lastError = await response.text();
      console.error(`Failed to send from ${fromAddr}:`, lastError);
    }

    return new Response(
      JSON.stringify({ success: false, error: lastError }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unreturned vehicle email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
