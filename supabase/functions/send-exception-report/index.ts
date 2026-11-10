import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@3.0.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TYPE_LABELS: Record<string, string> = {
  odometer_mismatch: "Odometer mismatch",
  unauthorized_license: "Driver licence not valid for vehicle",
  unauthorized_prdp: "PrDP not valid for vehicle",
  unauthorized_trailer_license: "Driver licence not valid for trailer",
  not_returned_by_previous_driver: "Vehicle not returned by previous driver",
  service_overdue: "Vehicle overdue for service",
};

const humanize = (value: string) =>
  TYPE_LABELS[value] ?? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderExceptionReportPDF(rows: [string, string][], description: string): Uint8Array {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 20;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const labelWidth = 50;

  pdf.setFillColor(30, 58, 95);
  pdf.rect(0, 0, pageWidth, 36, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Exception Report", margin, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("MyFuelApp", margin, 27);

  let y = 52;
  pdf.setTextColor(17, 24, 39);
  for (const [label, value] of rows) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(label, margin, y);
    pdf.setFont("helvetica", "normal");
    const valueLines = pdf.splitTextToSize(value, contentWidth - labelWidth);
    pdf.text(valueLines, margin + labelWidth, y);
    const rowHeight = valueLines.length * 6 + 4;
    y += rowHeight;
    pdf.setDrawColor(229, 231, 235);
    pdf.line(margin, y - 3, pageWidth - margin, y - 3);
  }

  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Details", margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  for (const line of pdf.splitTextToSize(description || "No additional details.", contentWidth)) {
    if (y > pageHeight - 30) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, margin, y);
    y += 6;
  }

  pdf.setFontSize(9);
  pdf.setTextColor(107, 114, 128);
  pdf.text("This is an automated report from MyFuelApp.", pageWidth / 2, pageHeight - 15, { align: "center" });

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

interface OrgUser {
  email: string;
  title: string;
  is_main_user: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let claimedId: string | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const { exception_id } = await req.json();
    if (typeof exception_id !== "string" || exception_id.length === 0) {
      return jsonResponse({ success: false, error: "exception_id is required" }, 400);
    }

    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: exception, error: claimError } = await supabase
      .from("vehicle_exceptions")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", exception_id)
      .is("email_sent_at", null)
      .select("id, organization_id, vehicle_id, driver_id, exception_type, description, expected_value, actual_value, transaction_type, created_at")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!exception) {
      return jsonResponse({ success: true, skipped: "already sent or not found" });
    }
    claimedId = exception.id;

    const [{ data: vehicle }, { data: driver }, { data: orgUsers, error: usersError }] = await Promise.all([
      supabase
        .from("vehicles")
        .select("registration_number, make, model")
        .eq("id", exception.vehicle_id)
        .maybeSingle(),
      exception.driver_id
        ? supabase.from("drivers").select("first_name, surname").eq("id", exception.driver_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("organization_users")
        .select("email, title, is_main_user")
        .eq("organization_id", exception.organization_id)
        .eq("is_active", true),
    ]);

    if (usersError) throw usersError;

    const users = (orgUsers ?? []) as OrgUser[];
    const vehicleUsers = users.filter((u) => u.title === "Vehicle User" && u.email);
    const recipientRows = vehicleUsers.length > 0
      ? vehicleUsers
      : users.filter((u) => u.is_main_user && u.email);
    const recipients = [...new Set(recipientRows.map((u) => u.email))];

    if (recipients.length === 0) {
      await supabase.from("vehicle_exceptions").update({ email_sent_at: null }).eq("id", claimedId);
      return jsonResponse({ success: false, message: "No vehicle user or main user to notify" });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      await supabase.from("vehicle_exceptions").update({ email_sent_at: null }).eq("id", claimedId);
      return jsonResponse({ success: false, message: "Email service not configured" });
    }

    const registration = vehicle?.registration_number ?? "Unknown vehicle";
    const vehicleLabel = vehicle ? `${registration} (${vehicle.make} ${vehicle.model})` : registration;
    const driverName = driver ? `${driver.first_name} ${driver.surname}` : "Unknown driver";
    const typeLabel = humanize(exception.exception_type);
    const loggedAt = new Date(exception.created_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

    const rows: [string, string][] = [
      ["Exception:", typeLabel],
      ["Vehicle:", vehicleLabel],
      ["Driver:", driverName],
      ["Logged:", loggedAt],
      ...(exception.transaction_type ? [["Transaction:", humanize(exception.transaction_type)] as [string, string]] : []),
      ...(exception.expected_value ? [["Expected:", exception.expected_value] as [string, string]] : []),
      ...(exception.actual_value ? [["Actual:", exception.actual_value] as [string, string]] : []),
    ];

    const rowsHtml = rows
      .map(([label, value]) =>
        `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 35%;">${escapeHtml(label)}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(value)}</td></tr>`
      )
      .join("");

    const subject = `Exception Report: ${typeLabel} - ${registration}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e3a5f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Exception Report</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>An exception was recorded in MyFuelApp. Please review the details below. A PDF copy is attached for printing.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">${rowsHtml}</table>
          <p style="font-weight: bold;">${escapeHtml(exception.description ?? "")}</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">This is an automated message from MyFuelApp.</p>
        </div>
      </div>
    `;

    const pdfBase64 = uint8ToBase64(renderExceptionReportPDF(rows, exception.description ?? ""));
    const safeRegistration = registration.replace(/[^A-Za-z0-9]+/g, "-");
    const filename = `Exception-Report-${safeRegistration}-${exception.id.slice(0, 8)}.pdf`;

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
          to: recipients,
          subject,
          html,
          attachments: [{ filename, content: pdfBase64 }],
        }),
      });

      if (response.ok) {
        return jsonResponse({ success: true, recipients });
      }

      lastError = await response.text();
      console.error(`Failed to send exception report from ${fromAddr}:`, lastError);
    }

    await supabase.from("vehicle_exceptions").update({ email_sent_at: null }).eq("id", claimedId);
    return jsonResponse({ success: false, error: lastError }, 500);
  } catch (error: any) {
    console.error("Exception report email error:", error);
    if (supabase && claimedId) {
      await supabase.from("vehicle_exceptions").update({ email_sent_at: null }).eq("id", claimedId);
    }
    return jsonResponse({ success: false, error: error?.message || "Failed to send exception report" }, 500);
  }
});
