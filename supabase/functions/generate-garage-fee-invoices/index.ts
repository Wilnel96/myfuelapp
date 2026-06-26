import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateRequest {
  garage_id: string;
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

    const { garage_id, billing_period_start, billing_period_end, payment_terms = "30-Days" }: GenerateRequest = await req.json();

    if (!garage_id || !billing_period_start || !billing_period_end) {
      return new Response(
        JSON.stringify({ error: "garage_id, billing_period_start and billing_period_end are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the garage and its managing organization
    const { data: garage, error: garageError } = await supabase
      .from("garages")
      .select("id, name, organization_id, garage_capabilities")
      .eq("id", garage_id)
      .maybeSingle();

    if (garageError) throw garageError;
    if (!garage) {
      return new Response(
        JSON.stringify({ error: "Garage not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all active sub-clients managed by this garage
    const { data: subClients, error: subClientsError } = await supabase
      .from("organizations")
      .select("id, name, monthly_fee_per_vehicle, monthly_fee_per_driver, payment_option, fuel_payment_terms, fuel_payment_interest_rate")
      .eq("managing_garage_id", garage_id)
      .eq("is_garage_managed", true)
      .eq("status", "active");

    if (subClientsError) throw subClientsError;
    if (!subClients || subClients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active managed sub-clients found for this garage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate consolidated invoice for this garage + period
    const { data: existing } = await supabase
      .from("garage_fee_invoices")
      .select("id, invoice_number")
      .eq("garage_id", garage_id)
      .eq("billing_period_start", billing_period_start)
      .eq("billing_period_end", billing_period_end)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: `Invoice ${existing.invoice_number} already exists for this period` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Accumulate line items per sub-client
    const lineItems: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      item_type: string;
      sub_client_org_id: string;
      sub_client_name: string;
    }> = [];

    let subtotal = 0;

    for (const client of subClients) {
      const feePerVehicle = parseFloat(String(client.monthly_fee_per_vehicle || 0));
      const feePerDriver = parseFloat(String(client.monthly_fee_per_driver || 0));

      const { count: vehicleCount } = await supabase
        .from("vehicles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", client.id)
        .eq("status", "active")
        .is("deleted_at", null);

      const { count: driverCount } = await supabase
        .from("drivers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", client.id)
        .eq("status", "active")
        .is("deleted_at", null);

      const activeVehicles = vehicleCount || 0;
      const activeDrivers = driverCount || 0;

      if (activeVehicles > 0 && feePerVehicle > 0) {
        const lineTotal = Math.round(activeVehicles * feePerVehicle * 100) / 100;
        lineItems.push({
          description: `${client.name} – Vehicle management fee (${activeVehicles} vehicle${activeVehicles !== 1 ? 's' : ''} × R${feePerVehicle.toFixed(2)})`,
          quantity: activeVehicles,
          unit_price: feePerVehicle,
          line_total: lineTotal,
          item_type: "Vehicle Fee",
          sub_client_org_id: client.id,
          sub_client_name: client.name,
        });
        subtotal += lineTotal;
      }

      if (activeDrivers > 0 && feePerDriver > 0) {
        const lineTotal = Math.round(activeDrivers * feePerDriver * 100) / 100;
        lineItems.push({
          description: `${client.name} – Driver management fee (${activeDrivers} driver${activeDrivers !== 1 ? 's' : ''} × R${feePerDriver.toFixed(2)})`,
          quantity: activeDrivers,
          unit_price: feePerDriver,
          line_total: lineTotal,
          item_type: "Driver Fee",
          sub_client_org_id: client.id,
          sub_client_name: client.name,
        });
        subtotal += lineTotal;
      }
    }

    subtotal = Math.round(subtotal * 100) / 100;

    if (subtotal === 0 || lineItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No billable items: no active vehicles/drivers or no fee rates set for any sub-client" }),
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

    // Create consolidated garage fee invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("garage_fee_invoices")
      .insert({
        garage_id,
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
        status: "issued",
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Insert line items
    const lineItemRows = lineItems.map((item, idx) => ({
      invoice_id: invoice.id,
      line_number: idx + 1,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      item_type: item.item_type,
      sub_client_org_id: item.sub_client_org_id,
      sub_client_name: item.sub_client_name,
    }));

    const { error: lineItemError } = await supabase.from("garage_fee_invoice_line_items").insert(lineItemRows);
    if (lineItemError) throw lineItemError;

    return new Response(
      JSON.stringify({
        success: true,
        invoice_number: invoiceNumber,
        garage: garage.name,
        sub_client_count: subClients.length,
        line_item_count: lineItems.length,
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
