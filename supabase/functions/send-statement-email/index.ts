import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function formatCurrency(amount: number): string {
  return `R ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-ZA");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { statement_id, to_email } = await req.json();

    if (!statement_id || !to_email) {
      return new Response(
        JSON.stringify({ error: "statement_id and to_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load the statement with organization
    const { data: statement, error: stmtError } = await adminClient
      .from("client_statements")
      .select(`
        *,
        organization:organizations(
          name, vat_number, address_line_1, address_line_2,
          city, province, postal_code, country, company_registration_number
        )
      `)
      .eq("id", statement_id)
      .maybeSingle();

    if (stmtError) throw stmtError;
    if (!statement) {
      return new Response(
        JSON.stringify({ error: "Statement not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load management org
    const { data: mgmtOrg } = await adminClient
      .from("organizations")
      .select("name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, phone_number, company_registration_number")
      .eq("is_management_org", true)
      .maybeSingle();

    // Load invoices for this period
    const { data: invoices } = await adminClient
      .from("invoices")
      .select("invoice_number, invoice_date, total_amount, amount_paid, amount_outstanding, status")
      .eq("organization_id", statement.organization_id)
      .gte("billing_period_start", statement.period_start)
      .lte("billing_period_end", statement.period_end)
      .order("invoice_date", { ascending: true });

    // Load credit notes for this period
    const { data: creditNotes } = await adminClient
      .from("credit_notes")
      .select("credit_note_number, credit_note_date, total_amount, status")
      .eq("organization_id", statement.organization_id)
      .gte("credit_note_date", statement.period_start)
      .lte("credit_note_date", statement.period_end)
      .order("credit_note_date", { ascending: true });

    const org = statement.organization;
    const invRows = (invoices || []).map((inv: any) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${inv.invoice_number}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${formatDate(inv.invoice_date)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-align: right;">${formatCurrency(Number(inv.total_amount))}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-align: right; color: #16a34a;">${formatCurrency(Number(inv.amount_paid))}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-align: right; color: #dc2626;">${formatCurrency(Number(inv.amount_outstanding))}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; text-align: center; text-transform: capitalize;">${inv.status}</td>
      </tr>
    `).join("");

    const cnRows = (creditNotes || []).length > 0
      ? (creditNotes as any[]).map((cn) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${cn.credit_note_number}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${formatDate(cn.credit_note_date)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-align: right;">${formatCurrency(Number(cn.total_amount))}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; text-align: center; text-transform: capitalize;">${cn.status}</td>
        </tr>
      `).join("")
      : "";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        ${mgmtOrg ? `
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="margin: 0; font-size: 24px; color: #1f2937;">${mgmtOrg.name}</h1>
            <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
              <p style="margin: 2px 0;">${mgmtOrg.address_line_1}${mgmtOrg.address_line_2 ? ", " + mgmtOrg.address_line_2 : ""}</p>
              <p style="margin: 2px 0;">${mgmtOrg.city}, ${mgmtOrg.province} ${mgmtOrg.postal_code}</p>
              ${mgmtOrg.phone_number ? `<p style="margin: 2px 0;">Phone: ${mgmtOrg.phone_number}</p>` : ""}
              <div style="margin-top: 6px; font-weight: 500; color: #374151;">
                ${mgmtOrg.vat_number ? `<span style="margin-right: 16px;">VAT No: ${mgmtOrg.vat_number}</span>` : ""}
                ${mgmtOrg.company_registration_number ? `<span>Reg No: ${mgmtOrg.company_registration_number}</span>` : ""}
              </div>
            </div>
          </div>
        </div>
        ` : ""}

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
          <div>
            <h2 style="margin: 0; font-size: 28px; color: #1f2937;">STATEMENT</h2>
            <div style="font-size: 13px; color: #4b5563; margin-top: 8px; line-height: 1.8;">
              <p style="margin: 0;"><strong>Statement Number:</strong> ${statement.statement_number}</p>
              <p style="margin: 0;"><strong>Statement Date:</strong> ${formatDate(statement.statement_date)}</p>
              <p style="margin: 0;"><strong>Period:</strong> ${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}</p>
            </div>
          </div>
        </div>

        ${org ? `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px; font-size: 14px; color: #1f2937;">Bill To:</h3>
          <div style="font-size: 13px; color: #374151; line-height: 1.6;">
            <p style="margin: 0; font-weight: 600;">${org.name}</p>
            ${org.address_line_1 ? `<p style="margin: 0;">${org.address_line_1}${org.address_line_2 ? ", " + org.address_line_2 : ""}</p>` : ""}
            ${org.city ? `<p style="margin: 0;">${org.city}, ${org.province} ${org.postal_code}</p>` : ""}
            ${org.country ? `<p style="margin: 0;">${org.country}</p>` : ""}
            <div style="margin-top: 6px; font-weight: 500;">
              ${org.vat_number ? `<span style="margin-right: 16px;">VAT No: ${org.vat_number}</span>` : ""}
              ${org.company_registration_number ? `<span>Reg No: ${org.company_registration_number}</span>` : ""}
            </div>
          </div>
        </div>
        ` : ""}

        <!-- Summary cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background: #f3f4f6; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Opening</p>
            <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #1f2937;">${formatCurrency(Number(statement.opening_balance))}</p>
          </div>
          <div style="background: #eff6ff; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #2563eb; text-transform: uppercase; font-weight: 600;">Invoiced</p>
            <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #1d4ed8;">${formatCurrency(Number(statement.total_invoiced))}</p>
          </div>
          <div style="background: #f0fdf4; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #16a34a; text-transform: uppercase; font-weight: 600;">Paid</p>
            <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #15803d;">${formatCurrency(Number(statement.total_paid))}</p>
          </div>
          <div style="background: #fef2f2; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #dc2626; text-transform: uppercase; font-weight: 600;">Closing</p>
            <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #b91c1c;">${formatCurrency(Number(statement.closing_balance))}</p>
          </div>
        </div>

        <h3 style="font-size: 16px; color: #1f2937; margin: 24px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Invoices</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Invoice #</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Date</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Total</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Paid</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Outstanding</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${invRows || `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #9ca3af; font-size: 13px;">No invoices in this period</td></tr>`}
          </tbody>
        </table>

        ${(creditNotes || []).length > 0 ? `
        <h3 style="font-size: 16px; color: #1f2937; margin: 24px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Credit Notes</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Credit Note #</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Date</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Amount</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Status</th>
            </tr>
          </thead>
          <tbody>${cnRows}</tbody>
        </table>
        ` : ""}

        <div style="margin-top: 24px; border-top: 2px solid #e5e7eb; padding-top: 16px;">
          <div style="max-width: 280px; margin-left: auto; font-size: 14px; line-height: 2;">
            <div style="display: flex; justify-content: space-between;"><span style="color: #6b7280;">Opening Balance:</span><span style="font-weight: 500;">${formatCurrency(Number(statement.opening_balance))}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #6b7280;">Total Invoiced:</span><span style="font-weight: 500;">${formatCurrency(Number(statement.total_invoiced))}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #6b7280;">Total Paid:</span><span style="font-weight: 500; color: #16a34a;">${formatCurrency(Number(statement.total_paid))}</span></div>
            ${Number(statement.total_credit_notes) > 0 ? `<div style="display: flex; justify-content: space-between;"><span style="color: #6b7280;">Credit Notes:</span><span style="font-weight: 500; color: #ea580c;">-${formatCurrency(Number(statement.total_credit_notes))}</span></div>` : ""}
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 4px;">
              <span>Closing Balance:</span>
              <span style="color: ${Number(statement.closing_balance) > 0 ? "#dc2626" : "#16a34a"};">${formatCurrency(Number(statement.closing_balance))}</span>
            </div>
          </div>
        </div>

        <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          <p>This statement was generated by MyFuelApp. If you have any questions, please contact your account manager.</p>
        </div>
      </div>
    `;

    const text = `MyFuelApp Statement\n\nStatement Number: ${statement.statement_number}\nStatement Date: ${formatDate(statement.statement_date)}\nPeriod: ${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}\n\nOpening Balance: ${formatCurrency(Number(statement.opening_balance))}\nTotal Invoiced: ${formatCurrency(Number(statement.total_invoiced))}\nTotal Paid: ${formatCurrency(Number(statement.total_paid))}\nClosing Balance: ${formatCurrency(Number(statement.closing_balance))}\n\nPlease log in to your MyFuelApp portal to view the full statement details.`;

    // Send email via the send-email edge function
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fromAddresses = [
      "MyFuelApp <noreply@myfuelapp.net>",
      "MyFuelApp <onboarding@resend.dev>",
    ];

    let emailSent = false;
    let emailError = "";

    for (const fromAddr of fromAddresses) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [to_email],
          subject: `Statement ${statement.statement_number} - ${org?.name || ""}`,
          html,
          text,
        }),
      });

      if (emailResponse.ok) {
        emailSent = true;
        break;
      }

      const errBody = await emailResponse.text();
      emailError = `${fromAddr}: ${errBody}`;
      console.error(`Failed to send from ${fromAddr}:`, errBody);
    }

    if (!emailSent) {
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${emailError}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update statement status
    await adminClient
      .from("client_statements")
      .update({
        status: "sent",
        sent_to_email: to_email,
        sent_at: new Date().toISOString(),
      })
      .eq("id", statement_id);

    return new Response(
      JSON.stringify({ success: true, message: `Statement emailed to ${to_email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Send statement email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send statement email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
