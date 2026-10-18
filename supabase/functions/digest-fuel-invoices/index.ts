import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional body: { frequency?: 'daily'|'weekly'|'monthly' }
    // If omitted, processes all digest frequencies.
    let body: { frequency?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine — process all
    }

    const frequencies = body.frequency
      ? [body.frequency]
      : ["daily", "weekly", "monthly"];

    const summary: { frequency: string; organizations: number; emailsSent: number }[] = [];

    for (const frequency of frequencies) {
      // Find organizations with this digest frequency
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("fuel_invoice_email_frequency", frequency)
        .eq("organization_type", "client");

      if (orgsError || !orgs) {
        console.error(`Failed to load orgs for ${frequency}:`, orgsError);
        summary.push({ frequency, organizations: 0, emailsSent: 0 });
        continue;
      }

      let emailsSent = 0;

      for (const org of orgs) {
        // Determine the date window for this digest
        const now = new Date();
        let since = new Date();
        if (frequency === "daily") {
          since.setDate(now.getDate() - 1);
        } else if (frequency === "weekly") {
          since.setDate(now.getDate() - 7);
        } else if (frequency === "monthly") {
          since.setMonth(now.getMonth() - 1);
        }

        // Find un-sent invoices for this org within the window
        const { data: invoices, error: invError } = await supabase
          .from("fuel_transaction_invoices")
          .select("id, email_recipient, invoice_number")
          .eq("organization_id", org.id)
          .is("email_sent_at", null)
          .gte("invoice_date", since.toISOString())
          .order("invoice_date", { ascending: true });

        if (invError || !invoices || invoices.length === 0) {
          continue;
        }

        // Send all unsent invoices for this org via the email function
        const invoiceIds = invoices.map((i) => i.id);
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-fuel-invoice-email`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invoiceIds }),
        });

        if (sendResponse.ok) {
          const result = await sendResponse.json();
          emailsSent += result.sent || 0;
        } else {
          console.error(`Failed to send digest for org ${org.id}:`, await sendResponse.text());
        }
      }

      summary.push({ frequency, organizations: orgs.length, emailsSent });
    }

    return new Response(
      JSON.stringify({ success: true, summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in digest-fuel-invoices:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process fuel invoice digest" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
