import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  organization_id: string;
  vehicle_id: string;
  driver_id: string;
  vehicle_registration: string;
  vehicle_make: string;
  vehicle_model: string;
  driver_name: string;
  last_service_km: number;
  next_service_km: number;
  current_odometer: number;
  last_service_date: string | null;
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

    // Fetch main user and vehicle user emails from organization_users
    const { data: orgUsers } = await supabase
      .from("organization_users")
      .select("email, title, is_main_user")
      .eq("organization_id", body.organization_id)
      .in("title", ["main_user", "vehicle_user"])
      .eq("active", true);

    if (!orgUsers || orgUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No main user or vehicle user found for this organization" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipients = orgUsers.map((u: { email: string }) => u.email);
    const uniqueRecipients = [...new Set(recipients)];

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fmtDate = (d: string | null) => {
      if (!d) return "Not recorded";
      return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };

    const fmtKm = (km: number) => km.toLocaleString() + " km";

    const subject = `Service Overdue Alert: ${body.vehicle_registration}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Service Overdue Alert</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>A vehicle was drawn by a driver despite being overdue for service. Please review the details below and arrange for servicing.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Vehicle:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${body.vehicle_registration} (${body.vehicle_make} ${body.vehicle_model})</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Driver:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${body.driver_name}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Last Service Date:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fmtDate(body.last_service_date)}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Last Service KM:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fmtKm(body.last_service_km)}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Next Service Due At:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fmtKm(body.next_service_km)}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Current Odometer:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${fmtKm(body.current_odometer)}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">KM Overdue:</td><td style="padding: 8px; color: #dc2626; font-weight: bold;">${fmtKm(body.current_odometer - body.next_service_km)}</td></tr>
          </table>

          <p style="color: #dc2626; font-weight: bold;">This vehicle has exceeded its scheduled service interval and requires immediate attention.</p>

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
    console.error("Service exception email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
