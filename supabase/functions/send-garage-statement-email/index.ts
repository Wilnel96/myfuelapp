import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { jsPDF } from "npm:jspdf@3.0.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FROM_ADDRESSES = [
  "MyFuelApp <noreply@myfuelapp.net>",
  "MyFuelApp <onboarding@resend.dev>",
];

interface StatementInvoice {
  invoice_number: string;
  transaction_date: string;
  vehicle_registration: string;
  fuel_type: string | null;
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

interface StatementRow {
  statement_number: string;
  statement_date: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  total_invoices: number;
  total_payments: number;
  closing_balance: number;
}

interface Party {
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  vat_number: string | null;
}

function fmtBalance(val: number): string {
  return val < 0 ? `CR R ${Math.abs(val).toFixed(2)}` : `R ${val.toFixed(2)}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-ZA");
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

function partyAddressLines(party: Party | null): string[] {
  if (!party) return [];
  const cityLine = party.city ? [party.city, party.province, party.postal_code].filter(Boolean).join(", ") : null;
  return [party.address_line_1, party.address_line_2, cityLine].filter(Boolean) as string[];
}

function drawPartyBox(
  pdf: jsPDF,
  x: number,
  y: number,
  boxW: number,
  label: string,
  party: Party | null,
  extraLines: string[],
): number {
  const lines: string[] = [];
  if (party) {
    if (party.name) lines.push(party.name);
    lines.push(...partyAddressLines(party));
    if (party.vat_number) lines.push(`VAT No: ${party.vat_number}`);
  }
  lines.push(...extraLines.filter(Boolean));

  pdf.setDrawColor(229, 231, 235);
  pdf.setFillColor(249, 250, 251);
  pdf.setLineWidth(0.3);
  const labelY = y + 5;
  const boxHeight = 5 + (1 + lines.length) * 4.5 + 2;
  pdf.rect(x, y, boxW, boxHeight, "FD");

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(107, 114, 128);
  pdf.text(label, x + 3, labelY);

  let ly = labelY + 5;
  lines.forEach((line, idx) => {
    if (idx === 0) {
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(17, 24, 39);
    } else {
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(75, 85, 99);
    }
    pdf.text(line, x + 3, ly);
    ly += 4.5;
  });

  return y + boxHeight;
}

function renderStatementPDF(
  statement: StatementRow,
  garage: Party | null,
  client: Party | null,
  invoices: StatementInvoice[],
  payments: StatementPayment[],
): Uint8Array {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin - 10) {
      pdf.addPage();
      y = margin;
    }
  };

  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text("MyFuelApp", pageWidth / 2, y + 8, { align: "center" });

  y += 13;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(107, 114, 128);
  pdf.text("Operated by Fuel Empowerment Systems (Pty) Ltd", pageWidth / 2, y, { align: "center" });

  y += 4;
  pdf.setDrawColor(17, 24, 39);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);

  y += 10;
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text("ACCOUNT STATEMENT", pageWidth / 2, y, { align: "center" });

  y += 8;
  const colGap = 4;
  const colW = (contentWidth - colGap) / 2;
  const boxesTop = y;
  const fromBottom = drawPartyBox(pdf, margin, boxesTop, colW, "FROM:", garage, []);
  const clientBottom = drawPartyBox(pdf, margin + colW + colGap, boxesTop, colW, "CLIENT:", client, []);
  y = Math.max(fromBottom, clientBottom) + 4;

  ensureSpace(30);
  pdf.setDrawColor(229, 231, 235);
  pdf.setFillColor(249, 250, 251);
  pdf.setLineWidth(0.3);
  const detailsBoxHeight = 5 + 4 * 5 + 2;
  pdf.rect(margin, y, contentWidth, detailsBoxHeight, "FD");
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(107, 114, 128);
  pdf.text("STATEMENT DETAILS", margin + 3, y + 5);

  const detailRows: [string, string][] = [
    ["Statement Number:", statement.statement_number],
    ["Statement Date:", formatDate(statement.statement_date)],
    ["Period:", `${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}`],
    ["Client:", client?.name || "-"],
  ];
  let dy = y + 10;
  detailRows.forEach(([label, value]) => {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(75, 85, 99);
    pdf.text(label, margin + 3, dy);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(17, 24, 39);
    pdf.text(value, margin + 40, dy);
    dy += 5;
  });
  y += detailsBoxHeight + 6;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(17, 24, 39);
  pdf.text("TRANSACTION DETAILS", margin, y);
  y += 5;

  const transactions = [
    ...invoices.map((inv) => ({
      date: new Date(inv.transaction_date),
      description: inv.invoice_number,
      detail: [
        inv.fuel_type ? inv.fuel_type : null,
        inv.liters ? `${Number(inv.liters).toFixed(2)} L` : null,
        inv.vehicle_registration ? `Vehicle ${inv.vehicle_registration}` : null,
      ].filter(Boolean).join(" - "),
      amount: Number(inv.total_amount),
      isPayment: false,
    })),
    ...payments.map((pay) => ({
      date: new Date(pay.payment_date),
      description: pay.payment_number,
      detail: [
        pay.payment_method ? pay.payment_method.toUpperCase() : null,
        pay.reference || null,
      ].filter(Boolean).join(" - "),
      amount: -Number(pay.amount),
      isPayment: true,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const colAmountW = 24;
  const colBalanceW = 26;
  const colDateW = 22;
  const colDescW = contentWidth - colDateW - colAmountW - colBalanceW;

  const drawTableHeader = () => {
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, y, contentWidth, 6, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(107, 114, 128);
    pdf.text("DATE", margin + 1.5, y + 4);
    pdf.text("DESCRIPTION", margin + colDateW + 1.5, y + 4);
    pdf.text("AMOUNT", margin + colDateW + colDescW, y + 4, { align: "right" });
    pdf.text("BALANCE", margin + colDateW + colDescW + colAmountW, y + 4, { align: "right" });
    y += 6;
  };

  drawTableHeader();

  let runningBalance = Number(statement.opening_balance);
  const fmtAmt = (v: number) => `R ${Math.abs(v).toFixed(2)}`;

  if (transactions.length === 0) {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(156, 163, 175);
    pdf.text("No transactions recorded in this period", margin + 1.5, y + 4);
    y += 7;
  }

  transactions.forEach((tx) => {
    runningBalance += tx.amount;

    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(55, 65, 81);
    const dateStr = formatDate(tx.date.toISOString());
    pdf.text(dateStr, margin + 1.5, y + 4);

    let descLines: string[] = [tx.description];
    if (tx.detail) {
      pdf.setFontSize(6.5);
      pdf.setTextColor(107, 114, 128);
      descLines = pdf.splitTextToSize(tx.detail, colDescW - 3) as string[];
    }
    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", tx.isPayment ? "bold" : "normal");
    pdf.setTextColor(tx.isPayment ? 22 : 17, tx.isPayment ? 101 : 24, tx.isPayment ? 52 : 39);
    pdf.text(tx.description, margin + colDateW + 1.5, y + 4);

    if (tx.detail) {
      pdf.setFontSize(6.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(107, 114, 128);
      pdf.text(descLines, margin + colDateW + 1.5, y + 6.8);
    }

    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(tx.isPayment ? 22 : 17, tx.isPayment ? 101 : 24, tx.isPayment ? 52 : 39);
    pdf.text(`${tx.isPayment ? "-" : ""}${fmtAmt(tx.amount)}`, margin + colDateW + colDescW, y + 4, { align: "right" });
    pdf.setTextColor(17, 24, 39);
    pdf.text(fmtBalance(runningBalance), margin + colDateW + colDescW + colAmountW, y + 4, { align: "right" });

    const rowH = tx.detail ? 6.8 + descLines.length * 3 + 1.5 : 7;
    pdf.setDrawColor(233, 236, 239);
    pdf.setLineWidth(0.1);
    pdf.line(margin, y + rowH - 1, margin + contentWidth, y + rowH - 1);
    y += rowH;

    if (y + 8 > pageHeight - margin - 10) {
      pdf.addPage();
      y = margin;
      drawTableHeader();
    }
  });

  ensureSpace(40);
  y += 3;
  const summaryH = 5 + 4 * 5.5 + 2;
  pdf.setDrawColor(229, 231, 235);
  pdf.setFillColor(249, 250, 251);
  pdf.setLineWidth(0.3);
  pdf.rect(margin + contentWidth * 0.45, y, contentWidth * 0.55, summaryH, "FD");

  let sy = y + 5;
  const summaryRows: [string, string, boolean][] = [
    ["Opening Balance:", fmtBalance(Number(statement.opening_balance)), false],
    ["Total Invoices:", `R ${Number(statement.total_invoices).toFixed(2)}`, false],
    ["Total Payments:", `R ${Number(statement.total_payments).toFixed(2)}`, false],
    ["CLOSING BALANCE:", fmtBalance(Number(statement.closing_balance)), true],
  ];
  summaryRows.forEach(([label, value, bold]) => {
    pdf.setFontSize(bold ? 9 : 8);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(bold ? 17 : 75, bold ? 24 : 85, bold ? 39 : 99);
    pdf.text(label, margin + contentWidth * 0.45 + 3, sy);
    pdf.text(value, margin + contentWidth - 3, sy, { align: "right" });
    sy += 5.5;
  });

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(156, 163, 175);
  pdf.text(
    "This statement was generated by MyFuelApp. If you have any questions, please contact your account manager.",
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" },
  );

  return new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
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

    const [garageResult, orgResult, invResult, payResult] = await Promise.all([
      adminClient
        .from("garages")
        .select("name, address_line_1, address_line_2, city, province, postal_code, vat_number")
        .eq("id", statement.garage_id)
        .maybeSingle(),
      adminClient
        .from("organizations")
        .select("name, vat_number, address_line_1, address_line_2, city, province, postal_code, country")
        .eq("id", statement.organization_id)
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
    if (invResult.error) throw invResult.error;
    if (payResult.error) throw payResult.error;

    const garage = garageResult.data as Party | null;
    const org = orgResult.data as Party | null;
    const invoices: StatementInvoice[] = invResult.data || [];
    const payments: StatementPayment[] = payResult.data || [];

    let pdfBase64: string;
    try {
      const pdfBytes = renderStatementPDF(statement, garage, org, invoices, payments);
      pdfBase64 = uint8ToBase64(pdfBytes);
    } catch (pdfError) {
      console.error("Failed to generate statement PDF", statement.statement_number, pdfError);
      return new Response(
        JSON.stringify({ error: "Failed to generate statement PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const filename = `Statement-${statement.statement_number}.pdf`;
    const clientName = org?.name || "Client";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
        <p style="font-size: 15px; color: #1f2937; margin: 0 0 12px;">Dear ${clientName},</p>
        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 12px;">
          Please find your account statement attached for the period
          <strong>${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}</strong>.
        </p>
        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 16px;">
          Statement Number: <strong>${statement.statement_number}</strong><br />
          Closing Balance: <strong>${fmtBalance(Number(statement.closing_balance))}</strong>
        </p>
        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 4px;">Kind regards,</p>
        <p style="font-size: 14px; color: #374151; margin: 0;"><strong>MyFuelApp</strong><br />
        <span style="font-size: 12px; color: #6b7280;">Operated by Fuel Empowerment Systems (Pty) Ltd</span></p>
      </div>
    `;
    const text = `Dear ${clientName},\n\nPlease find your account statement attached for the period ${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}.\n\nStatement Number: ${statement.statement_number}\nClosing Balance: ${fmtBalance(Number(statement.closing_balance))}\n\nKind regards,\nMyFuelApp`;

    let emailSent = false;
    let emailError = "";

    for (const fromAddr of FROM_ADDRESSES) {
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
          attachments: [{ filename, content: pdfBase64 }],
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
