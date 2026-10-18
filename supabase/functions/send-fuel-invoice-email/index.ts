import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.83.0";
import { jsPDF } from "npm:jspdf@3.0.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendInvoiceRequest {
  invoiceId?: string;
  invoiceIds?: string[];
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  transaction_date: string;
  fuel_type: string;
  liters: string;
  price_per_liter: string;
  fuel_amount: string;
  total_amount: string;
  vehicle_registration: string;
  driver_name: string;
  garage_name: string;
  garage_address: string;
  garage_vat_number: string;
  client_name: string;
  client_address: string;
  client_vat_number: string;
  odometer_reading: number;
  email_recipient: string;
  oil_quantity: string;
  oil_unit_price: string;
  oil_total_amount: string;
  oil_type: string;
  oil_brand: string;
  items_subtotal_excl_vat: string;
  items_vat_amount: string;
  items_total_incl_vat: string;
  payment_option: string;
  fuel_payment_terms: string;
  fuel_payment_interest_rate: string;
  card_last_four_digits: string;
}

function renderInvoicePDF(invoice: InvoiceRow): Uint8Array {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  // Header
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text("MyFuelApp", pageWidth / 2, y, { align: "center" });

  y += 7;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(107, 114, 128);
  pdf.text("Operated by Fuel Empowerment Systems (Pty) Ltd", pageWidth / 2, y, { align: "center" });

  y += 6;
  pdf.setDrawColor(17, 24, 39);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // FUEL INVOICE FROM
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(107, 114, 128);
  pdf.text("FUEL INVOICE FROM", margin, y);
  y += 3;

  const addressLines = invoice.garage_address ? invoice.garage_address.split("\n").filter(Boolean) : [];
  const fromBoxHeight = 6 + addressLines.length * 5 + (invoice.garage_vat_number ? 5 : 0) + 3;
  pdf.setFillColor(249, 250, 251);
  pdf.rect(margin, y, contentWidth, fromBoxHeight, "F");

  y += 5;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text(invoice.garage_name || "Not recorded", margin + 3, y);

  for (const line of addressLines) {
    y += 5;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text(line, margin + 3, y);
  }

  if (invoice.garage_vat_number) {
    y += 5;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text(`VAT No: ${invoice.garage_vat_number}`, margin + 3, y);
  }

  y += 8;

  // CLIENT
  if (invoice.client_name) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(107, 114, 128);
    pdf.text("CLIENT", margin, y);
    y += 3;

    const clientLines = invoice.client_address ? invoice.client_address.split("\n").filter(Boolean) : [];
    const hasClientVat = !!invoice.client_vat_number;
    const clientBoxHeight = 6 + clientLines.length * 5 + (hasClientVat ? 5 : 0) + 3;
    pdf.setFillColor(249, 250, 251);
    pdf.rect(margin, y, contentWidth, clientBoxHeight, "F");

    y += 5;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(17, 24, 39);
    pdf.text(invoice.client_name, margin + 3, y);

    for (const line of clientLines) {
      y += 5;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(75, 85, 99);
      pdf.text(line, margin + 3, y);
    }

    if (hasClientVat) {
      y += 5;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(75, 85, 99);
      pdf.text(`VAT No: ${invoice.client_vat_number}`, margin + 3, y);
    }

    y += 8;
  }

  // VEHICLE & DRIVER
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(107, 114, 128);
  pdf.text("VEHICLE & DRIVER", margin, y);
  y += 3;

  pdf.setFillColor(249, 250, 251);
  pdf.rect(margin, y, contentWidth, 13, "F");

  y += 5;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(75, 85, 99);
  pdf.text("Vehicle:", margin + 3, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text(` ${invoice.vehicle_registration || "N/A"}`, margin + 3 + pdf.getTextWidth("Vehicle:"), y);

  if (invoice.driver_name) {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    const dLabel = "Driver:";
    const dX = margin + contentWidth / 2 - pdf.getTextWidth(dLabel) / 2;
    pdf.text(dLabel, dX, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(17, 24, 39);
    pdf.text(` ${invoice.driver_name}`, dX + pdf.getTextWidth(dLabel), y);
  }

  if (invoice.odometer_reading != null) {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    const odoLabel = "Odometer:";
    const odoVal = ` ${invoice.odometer_reading.toLocaleString()} km`;
    const odoW = pdf.getTextWidth(odoLabel) + pdf.getTextWidth(odoVal);
    pdf.text(odoLabel, margin + contentWidth - 3 - odoW, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(17, 24, 39);
    pdf.text(odoVal, margin + contentWidth - 3 - pdf.getTextWidth(odoVal), y);
  }

  y += 13;

  // INVOICE
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(107, 114, 128);
  pdf.text("INVOICE", margin, y);
  y += 3;

  pdf.setFillColor(249, 250, 251);
  pdf.rect(margin, y, contentWidth, 13, "F");

  y += 5;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(75, 85, 99);
  pdf.text("Number:", margin + 3, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text(` ${invoice.invoice_number}`, margin + 3 + pdf.getTextWidth("Number:"), y);

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(75, 85, 99);
  const dLabel = "Date:";
  const dX = margin + contentWidth / 2 - pdf.getTextWidth(dLabel) / 2;
  pdf.text(dLabel, dX, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text(` ${new Date(invoice.invoice_date).toLocaleDateString("en-ZA")}`, dX + pdf.getTextWidth(dLabel), y);

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(75, 85, 99);
  const tLabel = "Transaction Date & Time:";
  const tDate = new Date(invoice.transaction_date).toLocaleDateString("en-ZA");
  const tTime = new Date(invoice.transaction_date).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  const tVal = ` ${tDate} ${tTime}`;
  const tW = pdf.getTextWidth(tLabel) + pdf.getTextWidth(tVal);
  pdf.text(tLabel, margin + contentWidth - 3 - tW, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text(tVal, margin + contentWidth - 3 - pdf.getTextWidth(tVal), y);

  y += 13;

  // FUEL DETAILS
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(107, 114, 128);
  pdf.text("FUEL DETAILS", margin, y);
  y += 3;

  pdf.setFillColor(249, 250, 251);
  pdf.rect(margin, y, contentWidth, 16, "F");

  y += 5;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(75, 85, 99);
  pdf.text("Fuel Type", margin + 3, y);
  pdf.text("Liters", margin + contentWidth * 0.35, y, { align: "right" });
  pdf.text("Price per Liter", margin + contentWidth * 0.6, y, { align: "right" });
  pdf.text("Fuel Amount", margin + contentWidth - 3, y, { align: "right" });

  y += 5;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text(invoice.fuel_type || "N/A", margin + 3, y);
  pdf.text(parseFloat(invoice.liters || "0").toFixed(2), margin + contentWidth * 0.35, y, { align: "right" });
  pdf.text(`R ${parseFloat(invoice.price_per_liter || "0").toFixed(2)}`, margin + contentWidth * 0.6, y, { align: "right" });
  const fuelAmt = parseFloat(invoice.liters || "0") * parseFloat(invoice.price_per_liter || "0");
  pdf.text(`R ${fuelAmt.toFixed(2)}`, margin + contentWidth - 3, y, { align: "right" });

  y += 11;

  // OIL PURCHASE
  const oilQuantity = parseFloat(invoice.oil_quantity || "0");
  if (oilQuantity > 0) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(107, 114, 128);
    pdf.text("OIL PURCHASE", margin, y);
    y += 3;

    pdf.setFillColor(249, 250, 251);
    pdf.rect(margin, y, contentWidth, 16, "F");

    y += 5;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text("Oil Type", margin + 3, y);
    pdf.text("Quantity", margin + contentWidth * 0.35, y, { align: "right" });
    pdf.text("Unit Price (Incl VAT)", margin + contentWidth * 0.6, y, { align: "right" });
    pdf.text("Oil Amount (Incl VAT)", margin + contentWidth - 3, y, { align: "right" });

    y += 5;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(17, 24, 39);
    const oilTypeText = `${invoice.oil_type || "N/A"}${invoice.oil_brand ? ` (${invoice.oil_brand})` : ""}`;
    pdf.text(oilTypeText, margin + 3, y);
    pdf.text(`${oilQuantity.toFixed(0)} Unit${oilQuantity > 1 ? "s" : ""}`, margin + contentWidth * 0.35, y, { align: "right" });
    pdf.text(`R ${parseFloat(invoice.oil_unit_price || "0").toFixed(2)}`, margin + contentWidth * 0.6, y, { align: "right" });
    pdf.text(`R ${parseFloat(invoice.oil_total_amount || "0").toFixed(2)}`, margin + contentWidth - 3, y, { align: "right" });

    y += 7;
    pdf.setDrawColor(209, 213, 219);
    pdf.setLineWidth(0.3);
    pdf.line(margin + 3, y, margin + contentWidth - 3, y);

    y += 5;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text("Amount of VAT included:", margin + 3, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(17, 24, 39);
    const oilTotal = parseFloat(invoice.oil_total_amount || "0");
    const oilVAT = oilTotal - oilTotal / 1.15;
    pdf.text(`R ${oilVAT.toFixed(2)}`, margin + contentWidth - 3, y, { align: "right" });

    y += 10;
  }

  // TOTAL
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);

  y += 8;
  pdf.setFillColor(239, 246, 255);
  pdf.rect(margin, y, contentWidth, 20, "F");

  y += 13;
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text("TOTAL AMOUNT:", margin + 5, y);

  pdf.setFontSize(16);
  pdf.setTextColor(37, 99, 235);
  pdf.text(`R ${parseFloat(invoice.total_amount || "0").toFixed(2)}`, pageWidth - margin - 5, y, { align: "right" });

  y += 18;

  // PAYMENT STATUS
  const isCardPayment = invoice.payment_option === "Card Payment";
  const isLocalAccount = invoice.payment_option === "Local Account";
  if (isCardPayment || isLocalAccount) {
    const boxColor: [number, number, number] = isCardPayment ? [240, 253, 244] : [239, 246, 255];
    const borderColor: [number, number, number] = isCardPayment ? [134, 239, 172] : [147, 197, 253];
    const textColor: [number, number, number] = isCardPayment ? [22, 101, 52] : [30, 64, 175];
    pdf.setFillColor(...boxColor);
    pdf.setDrawColor(...borderColor);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(margin, y, contentWidth, 12, 2, 2, "FD");
    y += 8;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...textColor);
    let paymentText: string;
    if (isCardPayment) {
      paymentText = invoice.card_last_four_digits
        ? `Paid by Credit/Debit Card  •  **** **** **** ${invoice.card_last_four_digits}`
        : "Paid by Credit/Debit Card";
    } else {
      paymentText = "Garage Account Invoice — To be paid";
    }
    pdf.text(paymentText, pageWidth / 2, y, { align: "center" });
    y += 8;
  }

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(75, 85, 99);
  pdf.text("This invoice is for accounting and tax compliance purposes.", pageWidth / 2, y, { align: "center" });
  y += 5;
  pdf.text("Thank you for your business.", pageWidth / 2, y, { align: "center" });

  return pdf.output("arraybuffer") as Uint8Array;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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
        garage_vat_number,
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

      const clientName = invoice.client_name || "Valued Client";
      const totalAmount = Number(invoice.total_amount || 0);

      // Generate PDF
      let pdfBase64: string;
      try {
        const pdfBytes = renderInvoicePDF(invoice as InvoiceRow);
        pdfBase64 = uint8ToBase64(pdfBytes);
      } catch (pdfError) {
        console.error("Failed to generate PDF for invoice", invoice.invoice_number, pdfError);
        results.push({ invoiceId: invoice.id, sent: false, error: "PDF generation failed" });
        continue;
      }

      const filename = `Fuel-Invoice-${invoice.invoice_number}.pdf`;

      const subject = `Fuel Invoice ${invoice.invoice_number} — ${invoice.vehicle_registration || ""}`.trim();

      const textBody = `Dear ${clientName},

Attached is Fuel Invoice ${invoice.invoice_number} for your attention.

Invoice Date: ${new Date(invoice.invoice_date).toLocaleDateString("en-ZA")}
Transaction Date: ${new Date(invoice.transaction_date).toLocaleDateString("en-ZA")}
Vehicle: ${invoice.vehicle_registration || "N/A"}
Driver: ${invoice.driver_name || "N/A"}
Fuel Station: ${invoice.garage_name || "N/A"}
Total Amount: R ${totalAmount.toFixed(2)}

This invoice is for accounting and tax compliance purposes. Please retain for your records.

Kind regards,
MyFuelApp Management`;

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
            subject,
            text: textBody,
            attachments: [
              {
                filename,
                content: pdfBase64,
              },
            ],
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
