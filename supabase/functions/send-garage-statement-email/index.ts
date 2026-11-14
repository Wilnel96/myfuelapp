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

interface StatementInvoice {
  invoice_number: string;
  transaction_date: string;
  vehicle_registration: string;
  liters: number;
  total_amount: number;
}

interface StatementPayment {
  payment_number: string;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  amount: number;
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

    const { data: statement, error: stmtError } = await adminClient
      .from("garage_statements")
      .select("*")
      .eq("id", statement_id)
      .maybeSingle();

    if (stmtError) throw stmtError;
    if (!statement) {
      return new Response(
        JSON.stringify({ error: "Statement not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [garageResult, orgResult, mgmtOrgResult, invResult, payResult] = await Promise.all([
      adminClient
        .from("garages")
        .select("name, address_line_1, address_line_2, city, province, postal_code, vat_number")
        .eq("id", statement.garage_id)
        .maybeSingle(),
      adminClient
        .from("organizations")
        .select("name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, company_registration_number")
        .eq("id", statement.organization_id)
        .maybeSingle(),
      adminClient
        .from("organizations")
        .select("name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, phone_number, company_registration_number")
        .eq("is_management_org", true)
        .maybeSingle(),
      adminClient.rpc("get_statement_invoices", {
        p_garage_id: statement.garage_id,
        p_organization_id: statement.organization_id,
        p_period_start: statement.period_start,
        p_period_end: statement.period_end,
      }),
      adminClient.rpc("get_statement_payments", {
        p_garage_id: statement.garage_id,
        p_organization_id: statement.organization_id,
        p_period_start: statement.period_start,
        p_period_end: statement.period_end,
      }),
    ]);

    if (garageResult.error) throw garageResult.error;
    if (orgResult.error) throw orgResult.error;

    const garage = garageResult.data;
    const org = orgResult.data;
    const mgmtOrg = mgmtOrgResult.data;
    const invoices: StatementInvoice[] = invResult.data || [];
    const payments: StatementPayment[] = payResult.data || [];

    const orgAddress = org ? [
      org.address_line_1,
      org.address_line_2,
      org.city ? `${org.city}, ${org.province} ${org.postal_code}` : null,
      org.country,
    ].filter(Boolean).join(", ") : "";

    const invRows = invoices.map((inv) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${formatDate(inv.transaction_date)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${inv.invoice_number}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${inv.vehicle_registration}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-align: right;">${Number(inv.liters).toFixed(2)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-align: right;">${formatCurrency(Number(inv.total_amount))}</td>
      </tr>
    `).join("");

    const payRows = payments.map((pay) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${formatDate(pay.payment_date)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${pay.payment_number}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-transform: uppercase;">${pay.payment_method}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px;">${pay.reference || "—"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-align: right; color: #16a34a;">${formatCurrency(Number(pay.amount))}</td>
      </tr>
    `).join("");

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
            <h2 style="margin: 0; font-size: 28px; color: #1f2937;">ACCOUNT STATEMENT</h2>
            <div style="font-size: 13px; color: #4b5563; margin-top: 8px; line-height: 1.8;">
              <p style="margin: 0;"><strong>Statement Number:</strong> ${statement.statement_number}</p>
              <p style="margin: 0;"><strong>Statement Date:</strong> ${formatDate(statement.statement_date)}</p>
              <p style="margin: 0;"><strong>Period:</strong> ${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}</p>
            </div>
          </div>
          ${garage ? `
          <div style="text-align: right;">
            <h3 style="margin: 0; font-size: 16px; color: #1f2937;">${garage.name}</h3>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
              ${garage.address_line_1 ? `<p style="margin: 1px 0;">${garage.address_line_1}</p>` : ""}
              ${garage.city ? `<p style="margin: 1px 0;">${garage.city}, ${garage.province} ${garage.postal_code || ""}</p>` : ""}
              ${garage.vat_number ? `<p style="margin: 1px 0;">VAT No: ${garage.vat_number}</p>` : ""}
            </div>
          </div>
          ` : ""}
        </div>

        ${org ? `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px; font-size: 14px; color: #1f2937;">Client:</h3>
          <div style="font-size: 13px; color: #374151; line-height: 1.6;">
            <p style="margin: 0; font-weight: 600;">${org.name}</p>
            ${orgAddress ? `<p style="margin: 0;">${orgAddress}</p>` : ""}
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
          <div style="background: #fef2f2; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #dc2626; text-transform: uppercase; font-weight: 600;">Invoices</p>
            <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #b91c1c;">${formatCurrency(Number(statement.total_invoices))}</p>
          </div>
          <div style="background: #f0fdf4; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #16a34a; text-transform: uppercase; font-weight: 600;">Payments</p>
            <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #15803d;">${formatCurrency(Number(statement.total_payments))}</p>
          </div>
          <div style="background: ${Number(statement.closing_balance) > 0 ? "#fef3c7" : "#f0fdf4"}; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="margin: 0; font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Closing</p>
            <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: ${Number(statement.closing_balance) > 0 ? "#b45309" : "#15803d"};">${formatCurrency(Number(statement.closing_balance))}</p>
          </div>
        </div>

        <h3 style="font-size: 16px; color: #1f2937; margin: 24px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Fuel Purchases &amp; Invoices</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Date</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Invoice #</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Vehicle</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Liters</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invRows || `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af; font-size: 13px;">No invoices in this period</td></tr>`}
          </tbody>
          ${invoices.length > 0 ? `
          <tfoot>
            <tr style="background: #f9fafb; font-weight: 600;">
              <td colspan="4" style="padding: 8px 12px; text-align: right; font-size: 13px;">Total Invoices:</td>
              <td style="padding: 8px 12px; text-align: right; font-size: 13px;">${formatCurrency(Number(statement.total_invoices))}</td>
            </tr>
          </tfoot>
          ` : ""}
        </table>

        <h3 style="font-size: 16px; color: #1f2937; margin: 24px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Payments Made</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Date</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Payment #</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Method</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Reference</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${payRows || `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af; font-size: 13px;">No payments in this period</td></tr>`}
          </tbody>
          ${payments.length > 0 ? `
          <tfoot>
            <tr style="background: #f9fafb; font-weight: 600;">
              <td colspan="4" style="padding: 8px 12px; text-align: right; font-size: 13px;">Total Payments:</td>
              <td style="padding: 8px 12px; text-align: right; font-size: 13px; color: #16a34a;">${formatCurrency(Number(statement.total_payments))}</td>
            </tr>
          </tfoot>
          ` : ""}
        </table>

        <div style="margin-top: 24px; border-top: 2px solid #e5e7eb; padding-top: 16px;">
          <div style="max-width: 280px; margin-left: auto; font-size: 14px; line-height: 2;">
            <div style="display: flex; justify-content: space-between;"><span style="color: #6b7280;">Opening Balance:</span><span style="font-weight: 500;">${formatCurrency(Number(statement.opening_balance))}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #6b7280;">Total Invoices:</span><span style="font-weight: 500;">${formatCurrency(Number(statement.total_invoices))}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: #6b7280;">Total Payments:</span><span style="font-weight: 500; color: #16a34a;">${formatCurrency(Number(statement.total_payments))}</span></div>
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

    const text = `MyFuelApp Account Statement\n\nStatement Number: ${statement.statement_number}\nStatement Date: ${formatDate(statement.statement_date)}\nPeriod: ${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}\nGarage: ${garage?.name || "N/A"}\nClient: ${org?.name || "N/A"}\n\nOpening Balance: ${formatCurrency(Number(statement.opening_balance))}\nTotal Invoices: ${formatCurrency(Number(statement.total_invoices))}\nTotal Payments: ${formatCurrency(Number(statement.total_payments))}\nClosing Balance: ${formatCurrency(Number(statement.closing_balance))}\n\nPlease log in to your MyFuelApp portal to view the full statement details.`;

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
          subject: `Account Statement ${statement.statement_number} - ${garage?.name || ""}`,
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

    return new Response(
      JSON.stringify({ success: true, message: `Statement emailed to ${to_email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Send garage statement email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send statement email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
