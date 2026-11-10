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

const TRIP_TYPES = ["business", "private"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const requiredText = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return jsonResponse({ success: false, error: "Not signed in" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ success: false, error: "Not signed in" }, 401);
    }

    const body = await req.json();
    const exceptionId = requiredText(body?.exception_id, 64);
    const driverId = requiredText(body?.driver_id, 64);
    const entryDate = typeof body?.entry_date === "string" && DATE_PATTERN.test(body.entry_date) ? body.entry_date : null;
    const fromLocation = requiredText(body?.from_location, 200);
    const toLocation = requiredText(body?.to_location, 200);
    const tripReason = requiredText(body?.trip_reason, 500);
    const tripType = typeof body?.trip_type === "string" && TRIP_TYPES.includes(body.trip_type) ? body.trip_type : null;

    if (!exceptionId || !driverId || !entryDate || !fromLocation || !toLocation || !tripReason || !tripType) {
      return jsonResponse({ success: false, error: "Please complete every field of the trip" }, 400);
    }

    const { data: exception, error: exceptionError } = await supabase
      .from("vehicle_exceptions")
      .select("id, organization_id, vehicle_id, exception_type, expected_value, actual_value, resolved")
      .eq("id", exceptionId)
      .maybeSingle();

    if (exceptionError) throw exceptionError;
    if (!exception) {
      return jsonResponse({ success: false, error: "Exception not found" }, 404);
    }
    if (exception.exception_type !== "odometer_mismatch") {
      return jsonResponse({ success: false, error: "This exception does not have a missing trip" }, 400);
    }
    if (exception.resolved) {
      return jsonResponse({ success: false, error: "This exception has already been resolved" }, 409);
    }

    const openingKm = Number.parseInt(exception.expected_value ?? "", 10);
    const closingKm = Number(exception.actual_value);
    if (!Number.isInteger(openingKm) || !Number.isInteger(closingKm) || closingKm <= openingKm) {
      return jsonResponse({ success: false, error: "The kilometre readings for this exception are invalid" }, 400);
    }

    const { data: orgUsers, error: orgUsersError } = await supabase
      .from("organization_users")
      .select("user_id, title, is_main_user")
      .eq("organization_id", exception.organization_id)
      .eq("is_active", true);

    if (orgUsersError) throw orgUsersError;

    const caller = (orgUsers ?? []).find((u) => u.user_id === user.id);
    const hasVehicleUsers = (orgUsers ?? []).some((u) => u.title === "Vehicle User");
    const allowed = hasVehicleUsers
      ? caller?.title === "Vehicle User"
      : caller?.is_main_user === true;
    if (!allowed) {
      return jsonResponse({
        success: false,
        error: hasVehicleUsers
          ? "Only the Vehicle User can log this missing trip"
          : "Only the Main User can log this missing trip",
      }, 403);
    }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id")
      .eq("id", driverId)
      .eq("organization_id", exception.organization_id)
      .maybeSingle();

    if (driverError) throw driverError;
    if (!driver) {
      return jsonResponse({ success: false, error: "Driver not found in this organization" }, 400);
    }

    const { data: trip, error: insertError } = await supabase
      .from("trip_logbook_entries")
      .insert({
        organization_id: exception.organization_id,
        driver_id: driverId,
        vehicle_id: exception.vehicle_id,
        vehicle_transaction_id: null,
        sequence_number: 1,
        entry_date: entryDate,
        opening_km: openingKm,
        closing_km: closingKm,
        from_location: fromLocation,
        to_location: toLocation,
        trip_reason: tripReason,
        trip_type: tripType,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const { error: resolveError } = await supabase
      .from("vehicle_exceptions")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: `Missing trip logged from ${openingKm} km to ${closingKm} km (${closingKm - openingKm} km).`,
      })
      .eq("id", exceptionId)
      .eq("resolved", false);

    if (resolveError) {
      return jsonResponse({
        success: false,
        error: "The missing trip was saved, but the exception could not be marked resolved",
      }, 500);
    }

    return jsonResponse({ success: true, trip_id: trip.id });
  } catch (err) {
    console.error("log-missing-trip failed:", err);
    return jsonResponse({ success: false, error: "Something went wrong while logging the trip" }, 500);
  }
});
