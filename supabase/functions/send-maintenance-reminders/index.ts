import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

const SERVICE_ALERT_WINDOW_KM = 1000;
const TIME_ZONE = "Africa/Johannesburg";
const TYPE_LABELS: Record<string, string> = {
  service: "Service",
  other: "Other maintenance",
  license_renewal: "Licence renewal",
  insurance: "Insurance",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatKm = (km: number) => `${Math.round(km).toLocaleString("en-ZA")} km`;

const formatDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-ZA", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const todayInTimeZone = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

interface OrgUser {
  email: string;
  title: string;
  is_main_user: boolean;
}

interface Vehicle {
  id: string;
  organization_id: string;
  registration_number: string;
  make: string;
  model: string;
  initial_odometer_reading: number | null;
  next_service_km: number | null;
  next_service_date: string | null;
  service_reminder_sent_for_km: number | null;
}

interface ScheduledJob {
  id: string;
  vehicle_id: string;
  organization_id: string;
  maintenance_type: string;
  description: string;
  maintenance_items: string[] | null;
  workshop: string | null;
  scheduled_date: string;
}

type Supabase = ReturnType<typeof createClient>;

const resolveRecipients = async (supabase: Supabase, organizationId: string) => {
  const { data, error } = await supabase
    .from("organization_users")
    .select("email, title, is_main_user")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  if (error) throw error;

  const users = (data ?? []) as OrgUser[];
  const vehicleUsers = users.filter((u) => u.title === "Vehicle User" && u.email);
  const rows = vehicleUsers.length > 0
    ? vehicleUsers
    : users.filter((u) => u.is_main_user && u.email);
  return [...new Set(rows.map((u) => u.email))];
};

const currentOdometer = async (supabase: Supabase, vehicle: Vehicle) => {
  const [{ data: lastReturn, error: returnError }, { data: lastLogbook, error: logbookError }] =
    await Promise.all([
      supabase
        .from("vehicle_transactions")
        .select("odometer_reading")
        .eq("vehicle_id", vehicle.id)
        .eq("transaction_type", "return")
        .order("odometer_reading", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("trip_logbook_entries")
        .select("closing_km")
        .eq("vehicle_id", vehicle.id)
        .order("closing_km", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if (returnError) throw returnError;
  if (logbookError) throw logbookError;

  const readings = [
    lastReturn?.odometer_reading,
    lastLogbook?.closing_km,
    vehicle.initial_odometer_reading,
  ].filter((value): value is number => typeof value === "number");

  return readings.length > 0 ? Math.max(...readings) : null;
};

const sendEmail = async (
  resendApiKey: string,
  recipients: string[],
  subject: string,
  html: string,
) => {
  const fromAddresses = [
    "MyFuelApp <noreply@myfuelapp.net>",
    "MyFuelApp <onboarding@resend.dev>",
  ];

  let lastError = "";
  for (const from of fromAddresses) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    });
    if (response.ok) return;
    lastError = await response.text();
    console.error(`Failed to send maintenance reminder from ${from}:`, lastError);
  }
  throw new Error(lastError || "Email send failed");
};

const emailShell = (title: string, intro: string, rowsHtml: string, footnote: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #1e3a5f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">${escapeHtml(title)}</h2>
    </div>
    <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      <p>${intro}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">${rowsHtml}</table>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">${escapeHtml(footnote)}</p>
      <p style="color: #6b7280; font-size: 12px;">This is an automated message from MyFuelApp.</p>
    </div>
  </div>
`;

const row = (label: string, value: string) =>
  `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 35%;">${escapeHtml(label)}</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(value)}</td></tr>`;

const sendScheduledReminders = async (
  supabase: Supabase,
  resendApiKey: string,
  tomorrow: string,
) => {
  const { data: jobs, error } = await supabase
    .from("vehicle_scheduled_maintenance")
    .select("id, vehicle_id, organization_id, maintenance_type, description, maintenance_items, workshop, scheduled_date")
    .eq("status", "scheduled")
    .eq("scheduled_date", tomorrow)
    .is("reminder_sent_at", null);
  if (error) throw error;

  const results: unknown[] = [];
  for (const job of (jobs ?? []) as ScheduledJob[]) {
    const { data: claimed, error: claimError } = await supabase
      .from("vehicle_scheduled_maintenance")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", job.id)
      .is("reminder_sent_at", null)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;

    try {
      const [{ data: vehicle }, recipients] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, organization_id, registration_number, make, model, initial_odometer_reading, next_service_km, next_service_date, service_reminder_sent_for_km")
          .eq("id", job.vehicle_id)
          .maybeSingle(),
        resolveRecipients(supabase, job.organization_id),
      ]);
      if (recipients.length === 0) {
        await supabase.from("vehicle_scheduled_maintenance").update({ reminder_sent_at: null }).eq("id", job.id);
        results.push({ id: job.id, skipped: "no recipients" });
        continue;
      }

      const registration = vehicle?.registration_number ?? "Unknown vehicle";
      const vehicleLabel = vehicle ? `${registration} (${vehicle.make} ${vehicle.model})` : registration;
      const typeLabel = TYPE_LABELS[job.maintenance_type] ?? job.maintenance_type;
      const items = job.maintenance_items && job.maintenance_items.length > 0
        ? job.maintenance_items.join(", ")
        : "-";

      const rows = [
        row("Vehicle:", vehicleLabel),
        row("Type:", typeLabel),
        row("Scheduled for:", formatDate(job.scheduled_date)),
        row("Details:", job.description),
        row("Items:", items),
        ...(job.workshop ? [row("Workshop:", job.workshop)] : []),
      ].join("");

      const html = emailShell(
        "Maintenance Reminder",
        "A maintenance job is scheduled for tomorrow. Please make sure the vehicle is available.",
        rows,
        "Scheduled maintenance reminder sent the day before the job.",
      );

      await sendEmail(resendApiKey, recipients, `Maintenance Reminder: ${typeLabel} tomorrow - ${registration}`, html);
      results.push({ id: job.id, recipients });
    } catch (error) {
      await supabase.from("vehicle_scheduled_maintenance").update({ reminder_sent_at: null }).eq("id", job.id);
      console.error("Scheduled maintenance reminder failed:", job.id, error);
      results.push({ id: job.id, error: "send failed" });
    }
  }
  return results;
};

const sendServiceDueAlerts = async (supabase: Supabase, resendApiKey: string) => {
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id, organization_id, registration_number, make, model, initial_odometer_reading, next_service_km, next_service_date, service_reminder_sent_for_km")
    .not("next_service_km", "is", null);
  if (error) throw error;

  const results: unknown[] = [];
  for (const vehicle of (vehicles ?? []) as Vehicle[]) {
    if (vehicle.next_service_km === null) continue;
    if (vehicle.service_reminder_sent_for_km === vehicle.next_service_km) continue;

    const odometer = await currentOdometer(supabase, vehicle);
    if (odometer === null || odometer < vehicle.next_service_km - SERVICE_ALERT_WINDOW_KM) continue;

    const dueKm = vehicle.next_service_km;
    const previousMarker = vehicle.service_reminder_sent_for_km;
    const { data: claimed, error: claimError } = await supabase
      .from("vehicles")
      .update({ service_reminder_sent_for_km: dueKm })
      .eq("id", vehicle.id)
      .or(`service_reminder_sent_for_km.is.null,service_reminder_sent_for_km.neq.${dueKm}`)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;

    try {
      const recipients = await resolveRecipients(supabase, vehicle.organization_id);
      if (recipients.length === 0) {
        await supabase.from("vehicles").update({ service_reminder_sent_for_km: previousMarker }).eq("id", vehicle.id);
        results.push({ id: vehicle.id, skipped: "no recipients" });
        continue;
      }

      const registration = vehicle.registration_number;
      const kmRemaining = Math.max(0, dueKm - odometer);
      const dueDateLabel = vehicle.next_service_date ? formatDate(vehicle.next_service_date) : "Not set";

      const rows = [
        row("Vehicle:", `${registration} (${vehicle.make} ${vehicle.model})`),
        row("Service due at:", formatKm(dueKm)),
        row("Current odometer:", formatKm(odometer)),
        row("Remaining:", kmRemaining === 0 ? "Service due now" : formatKm(kmRemaining)),
        row("Service due date:", dueDateLabel),
      ].join("");

      const html = emailShell(
        "Service Due Soon",
        `${escapeHtml(registration)} is within ${formatKm(SERVICE_ALERT_WINDOW_KM)} of its scheduled service. Please book the service.`,
        rows,
        "Service reminder sent when the vehicle comes within 1,000 km of its service due point.",
      );

      await sendEmail(resendApiKey, recipients, `Service Due Soon: ${registration}`, html);
      results.push({ id: vehicle.id, recipients });
    } catch (error) {
      await supabase.from("vehicles").update({ service_reminder_sent_for_km: previousMarker }).eq("id", vehicle.id);
      console.error("Service due alert failed:", vehicle.id, error);
      results.push({ id: vehicle.id, error: "send failed" });
    }
  }
  return results;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return jsonResponse({ success: false, message: "Email service not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tomorrow = addDays(todayInTimeZone(), 1);
    const scheduled = await sendScheduledReminders(supabase, resendApiKey, tomorrow);
    const serviceDue = await sendServiceDueAlerts(supabase, resendApiKey);

    return jsonResponse({ success: true, scheduled, serviceDue });
  } catch (error: any) {
    console.error("Maintenance reminder error:", error);
    return jsonResponse({ success: false, error: error?.message || "Failed to run maintenance reminders" }, 500);
  }
});
