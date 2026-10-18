import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendInvoiceRequest {
  invoiceId?: string;
  invoiceIds?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoiceId, invoiceIds }: SendInvoiceRequest = await req.json();

    const ids = invoiceIds && invoiceIds.length > 0
      ? invoiceIds
      : invoiceId
        ? [invoiceId]
        : [];

    if (ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "invoiceId or invoiceIds is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: invoices, error: invoicesError } = await supabase
      .from("fuel_transaction_invoices")
      .select(`
        id,
        invoice_number,
        invoice_date,
        transaction_date,
        fuel_type,
        liters,
        price_per_liter,
        fuel_amount,
        total_amount,
        vehicle_registration,
        driver_name,
        garage_name,
        garage_address,
        odometer_reading,
        email_recipient,
        oil_quantity,
        oil_unit_price,
        oil_total_amount,
        oil_type,
        oil_brand,
        items_subtotal_excl_vat,
        items_vat_amount,
        items_total_incl_vat,
        payment_option,
        fuel_payment_terms,
        fuel_payment_interest_rate,
        organization_id,
        client_name,
        client_address
      `)
      .in("id", ids);

    if (invoicesError || !invoices) {
      return new Response(
        JSON.stringify({ error: "Failed to load invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured — cannot send fuel invoice emails");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: { invoiceId: string; sent: boolean; error?: string }[] = [];

    for (const invoice of invoices) {
      const toEmail = invoice.email_recipient;
      if (!toEmail) {
        results.push({ invoiceId: invoice.id, sent: false, error: "No email recipient on invoice" });
        continue;
      }

      const oilQuantity = Number(invoice.oil_quantity || 0);
      const oilUnitPrice = Number(invoice.oil_unit_price || 0);
      const oilTotalInclVat = Number(invoice.oil_total_amount || 0);
      const oilExclVat = oilTotalInclVat / 1.15;
      const oilVatAmount = oilTotalInclVat - oilExclVat;
      const fuelAmount = Number(invoice.fuel_amount || 0);
      const itemsVatAmount = Number(invoice.items_vat_amount || 0);
      const itemsSubtotalExclVat = Number(invoice.items_subtotal_excl_vat || 0);
      const itemsTotalInclVat = Number(invoice.items_total_incl_vat || 0);
      const totalAmount = Number(invoice.total_amount || 0);

      const hasBreakdown = oilQuantity > 0 || itemsSubtotalExclVat > 0;

      const oilSection = oilQuantity > 0
        ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;">Oil (${invoice.oil_type || 'N/A'}${invoice.oil_brand ? ' — ' + invoice.oil_brand : ''})</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${oilQuantity} units</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">R ${oilUnitPrice.toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">R ${oilTotalInclVat.toFixed(2)}</td></tr>`
        : "";

      const breakdownRows = hasBreakdown
        ? `<tr><td colspan="3" style="padding:8px;text-align:right;font-weight:600;">Fuel Amount (VAT Zero-Rated):</td><td style="padding:8px;text-align:right;font-weight:600;">R ${fuelAmount.toFixed(2)}</td></tr>
           ${oilQuantity > 0 ? `<tr><td colspan="3" style="padding:8px;text-align:right;">Oil Subtotal (excl VAT):</td><td style="padding:8px;text-align:right;">R ${oilExclVat.toFixed(2)}</td></tr><tr><td colspan="3" style="padding:8px;text-align:right;">Oil VAT (15%):</td><td style="padding:8px;text-align:right;">R ${oilVatAmount.toFixed(2)}</td></tr>` : ""}
           ${itemsSubtotalExclVat > 0 ? `<tr><td colspan="3" style="padding:8px;text-align:right;">Additional Items (excl VAT):</td><td style="padding:8px;text-align:right;">R ${itemsSubtotalExclVat.toFixed(2)}</td></tr><tr><td colspan="3" style="padding:8px;text-align:right;">Additional Items VAT:</td><td style="padding:8px;text-align:right;">R ${itemsVatAmount.toFixed(2)}</td></tr>` : ""}
           <tr><td colspan="3" style="padding:12px 8px;text-align:right;font-weight:700;font-size:16px;">Total Amount:</td><td style="padding:12px 8px;text-align:right;font-weight:700;font-size:16px;color:#2563eb;">R ${totalAmount.toFixed(2)}</td></tr>`
        : `<tr><td colspan="3" style="padding:12px 8px;text-align:right;font-weight:700;font-size:16px;">Total Amount (VAT Zero-Rated):</td><td style="padding:12px 8px;text-align:right;font-weight:700;font-size:16px;color:#2563eb;">R ${totalAmount.toFixed(2)}</td></tr>`;

      const clientName = invoice.client_name || "Valued Client";
      const invDate = new Date(invoice.invoice_date).toLocaleDateString("en-ZA");
      const txDate = new Date(invoice.transaction_date).toLocaleDateString("en-ZA");

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background:#2563eb;color:white;padding:20px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:22px;">MyFuelApp</h1>
            <p style="margin:4px 0 0;font-size:14px;opacity:0.9;">Fuel Transaction Invoice</p>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p style="color:#1f2937;font-size:15px;margin:0 0 16px;">Dear ${clientName},</p>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 16px;">
              A fuel transaction invoice has been generated for your account.
            </p>
            <table style="width:100%;font-size:14px;color:#374151;margin-bottom:20px;">
              <tr><td style="padding:4px 0;color:#6b7280;">Invoice Number:</td><td style="padding:4px 0;font-weight:600;">${invoice.invoice_number}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;">Invoice Date:</td><td style="padding:4px 0;">${invDate}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;">Transaction Date:</td><td style="padding:4px 0;">${txDate}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;">Vehicle:</td><td style="padding:4px 0;">${invoice.vehicle_registration || 'N/A'}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;">Driver:</td><td style="padding:4px 0;">${invoice.driver_name || 'N/A'}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;">Odometer:</td><td style="padding:4px 0;">${invoice.odometer_reading || 'N/A'} km</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;">Fuel Station:</td><td style="padding:4px 0;">${invoice.garage_name || 'N/A'}</td></tr>
            </table>
            <table style="width:100%;font-size:13px;color:#374151;border-collapse:collapse;margin-bottom:8px;">
              <thead>
                <tr style="background:#e5e7eb;">
                  <th style="padding:8px;text-align:left;border-bottom:2px solid #d1d5db;">Item</th>
                  <th style="padding:8px;text-align:right;border-bottom:2px solid #d1d5db;">Qty</th>
                  <th style="padding:8px;text-align:right;border-bottom:2px solid #d1d5db;">Unit Price</th>
                  <th style="padding:8px;text-align:right;border-bottom:2px solid #d1d5db;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #eee;">Fuel — ${invoice.fuel_type || 'N/A'}</td>
                  <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${Number(invoice.liters || 0).toFixed(2)} L</td>
                  <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">R ${Number(invoice.price_per_liter || 0).toFixed(2)}</td>
                  <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">R ${fuelAmount.toFixed(2)}</td>
                </tr>
                ${oilSection}
                ${breakdownRows}
              </tbody>
            </table>
            <p style="color:#6b7280;font-size:12px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">
              This invoice is for accounting and tax compliance purposes. Please retain for your records.
            </p>
          </div>
        </div>
      `;

      const text = `MyFuelApp — Fuel Transaction Invoice ${invoice.invoice_number}\n\nDear ${clientName},\n\nA fuel transaction invoice has been generated.\n\nInvoice Number: ${invoice.invoice_number}\nInvoice Date: ${invDate}\nTransaction Date: ${txDate}\nVehicle: ${invoice.vehicle_registration || 'N/A'}\nDriver: ${invoice.driver_name || 'N/A'}\nOdometer: ${invoice.odometer_reading || 'N/A'} km\nFuel Station: ${invoice.garage_name || 'N/A'}\n\nFuel: ${Number(invoice.liters||0).toFixed(2)}L @ R ${Number(invoice.price_per_liter||0).toFixed(2)} = R ${fuelAmount.toFixed(2)}\n${oilQuantity > 0 ? `Oil: ${oilQuantity} units @ R ${oilUnitPrice.toFixed(2)} = R ${oilTotalInclVat.toFixed(2)}\n` : ''}\nTotal Amount: R ${totalAmount.toFixed(2)}\n\nThis invoice is for accounting and tax compliance purposes.`;

      const fromAddresses = [
        "MyFuelApp <noreply@myfuelapp.net>",
        "MyFuelApp <onboarding@resend.dev>",
      ];

      let sent = false;
      let lastError = "";
      for (const fromAddr of fromAddresses) {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [toEmail],
            subject: `Fuel Invoice ${invoice.invoice_number} — ${invoice.vehicle_registration || ''}`,
            html,
            text,
          }),
        });

        if (emailResponse.ok) {
          sent = true;
          break;
        }
        lastError = await emailResponse.text();
        console.error(`Failed to send invoice email from ${fromAddr}:`, lastError);
      }

      if (sent) {
        await supabase
          .from("fuel_transaction_invoices")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", invoice.id);
      }

      results.push({ invoiceId: invoice.id, sent, error: sent ? undefined : lastError });
    }

    const sentCount = results.filter((r) => r.sent).length;
    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error sending fuel invoice email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send fuel invoice email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
