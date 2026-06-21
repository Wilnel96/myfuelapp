import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateRequest {
  garage_id: string;
  organization_id: string;
  billing_period_start: string;
  billing_period_end: string;
  payment_terms?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { garage_id, organization_id, billing_period_start, billing_period_end, payment_terms = "30-Days" }: GenerateRequest = await req.json();

    if (!garage_id || !organization_id || !billing_period_start || !billing_period_end) {
      return new Response(
        JSON.stringify({ error: "garage_id, organization_id, billing_period_start and billing_period_end are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify org belongs to this garage
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, monthly_fee_per_vehicle, monthly_fee_per_driver, managing_garage_id, is_garage_managed, payment_option, fuel_payment_terms, fuel_payment_interest_rate")
      .eq("id", organization_id)
      .eq("managing_garage_id", garage_id)
      .eq("is_garage_managed", true)
      .eq("status", "active")
      .maybeSingle();

    if (orgError) throw orgError;
    if (!org) {
      return new Response(
        JSON.stringify({ error: "Organization not found or not managed by this garage" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate invoice
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("organization_id", organization_id)
      .eq("billing_period_start", billing_period_start)
      .eq("billing_period_end", billing_period_end)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: `Invoice ${existing.invoice_number} already exists for this period` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count active vehicles
    const { count: vehicleCount } = await supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .is("deleted_at", null);

    // Count active drivers
    const { count: driverCount } = await supabase
      .from("drivers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .is("deleted_at", null);

    const activeVehicles = vehicleCount || 0;
    const activeDrivers = driverCount || 0;

    const feePerVehicle = parseFloat(String(org.monthly_fee_per_vehicle || 0));
    const feePerDriver = parseFloat(String(org.monthly_fee_per_driver || 0));

    const vehicleFeeTotal = Math.round(activeVehicles * feePerVehicle * 100) / 100;
    const driverFeeTotal = Math.round(activeDrivers * feePerDriver * 100) / 100;
    const subtotal = Math.round((vehicleFeeTotal + driverFeeTotal) * 100) / 100;

    if (subtotal === 0) {
      return new Response(
        JSON.stringify({ error: "No billable items: no active vehicles/drivers or no fee rates set" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const VAT_RATE = 0.15;
    const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
    const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;

    const invoiceDate = new Date().toISOString().split("T")[0];
    const billingEndDate = new Date(billing_period_end);
    const paymentDueDate = new Date(billingEndDate.getFullYear(), billingEndDate.getMonth() + 2, 0);
    const paymentDueDateStr = paymentDueDate.toISOString().split("T")[0];

    // Get next invoice number
    const { data: invoiceNumberData, error: seqError } = await supabase.rpc("get_next_invoice_number");
    if (seqError) throw seqError;
    const invoiceNumber = invoiceNumberData as string;

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        organization_id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        billing_period_start,
        billing_period_end,
        subtotal,
        vat_amount: vatAmount,
        vat_rate: VAT_RATE,
        total_amount: totalAmount,
        amount_paid: 0,
        amount_outstanding: totalAmount,
        payment_terms,
        payment_due_date: paymentDueDateStr,
        payment_option: org.payment_option || null,
        fuel_payment_terms: org.fuel_payment_terms || null,
        fuel_payment_interest_rate: org.fuel_payment_interest_rate || null,
        status: "issued",
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Create line items
    const lineItems = [];
    let lineNumber = 1;

    if (activeVehicles > 0 && feePerVehicle > 0) {
      lineItems.push({
        invoice_id: invoice.id,
        line_number: lineNumber++,
        description: `Monthly fleet management fee - ${activeVehicles} vehicle(s)`,
        quantity: activeVehicles,
        unit_price: feePerVehicle,
        line_total: vehicleFeeTotal,
        item_type: "Vehicle Fee",
      });
    }

    if (activeDrivers > 0 && feePerDriver > 0) {
      lineItems.push({
        invoice_id: invoice.id,
        line_number: lineNumber++,
        description: `Monthly driver management fee - ${activeDrivers} driver(s)`,
        quantity: activeDrivers,
        unit_price: feePerDriver,
        line_total: driverFeeTotal,
        item_type: "Driver Fee",
      });
    }

    if (lineItems.length > 0) {
      const { error: lineItemError } = await supabase.from("invoice_line_items").insert(lineItems);
      if (lineItemError) throw lineItemError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoiceNumber,
        organization: org.name,
        vehicle_count: activeVehicles,
        driver_count: activeDrivers,
        subtotal,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        invoice_id: invoice.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
