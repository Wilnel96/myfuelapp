import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_ids, period_start, period_end } = await req.json();

    if (!organization_ids || !Array.isArray(organization_ids) || organization_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "organization_ids array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!period_start || !period_end) {
      return new Response(
        JSON.stringify({ error: "period_start and period_end are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let statementsCreated = 0;
    let statementsSkipped = 0;
    const errors: string[] = [];

    for (const orgId of organization_ids) {
      try {
        // Check if a statement already exists for this org + period
        const { data: existing } = await adminClient
          .from("client_statements")
          .select("id, statement_number")
          .eq("organization_id", orgId)
          .eq("period_start", period_start)
          .eq("period_end", period_end)
          .maybeSingle();

        if (existing) {
          statementsSkipped++;
          continue;
        }

        // Get the previous statement's closing balance as opening balance
        const { data: prevStmt } = await adminClient
          .from("client_statements")
          .select("closing_balance")
          .eq("organization_id", orgId)
          .lt("period_start", period_start)
          .order("period_end", { ascending: false })
          .limit(1)
          .maybeSingle();

        const openingBalance = prevStmt?.closing_balance || 0;

        // Fetch invoices for this org in the period
        const { data: invoices, error: invError } = await adminClient
          .from("invoices")
          .select("total_amount, amount_paid, amount_outstanding, status")
          .eq("organization_id", orgId)
          .gte("billing_period_start", period_start)
          .lte("billing_period_end", period_end);

        if (invError) throw invError;

        const totalInvoiced = (invoices || []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);
        const totalPaid = (invoices || []).reduce((sum, inv) => sum + Number(inv.amount_paid), 0);

        // Fetch credit notes for this org in the period
        const { data: creditNotes, error: cnError } = await adminClient
          .from("credit_notes")
          .select("total_amount, status")
          .eq("organization_id", orgId)
          .gte("credit_note_date", period_start)
          .lte("credit_note_date", period_end);

        if (cnError) throw cnError;

        const totalCreditNotes = (creditNotes || [])
          .filter((cn) => cn.status === "issued")
          .reduce((sum, cn) => sum + Number(cn.total_amount), 0);

        const closingBalance = openingBalance + totalInvoiced - totalPaid - totalCreditNotes;

        // Generate statement number
        const { data: stmtNumber, error: seqError } = await adminClient
          .rpc("get_next_statement_number");

        if (seqError) throw seqError;

        // Insert the statement
        const { error: insertError } = await adminClient
          .from("client_statements")
          .insert({
            organization_id: orgId,
            statement_number: stmtNumber,
            statement_date: new Date().toISOString().split("T")[0],
            period_start,
            period_end,
            opening_balance: openingBalance,
            total_invoiced: totalInvoiced,
            total_paid: totalPaid,
            total_credit_notes: totalCreditNotes,
            closing_balance: closingBalance,
            status: "draft",
          });

        if (insertError) throw insertError;

        statementsCreated++;
      } catch (err: any) {
        errors.push(`Org ${orgId}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        statements_created: statementsCreated,
        statements_skipped: statementsSkipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Statement generation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate statements" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
