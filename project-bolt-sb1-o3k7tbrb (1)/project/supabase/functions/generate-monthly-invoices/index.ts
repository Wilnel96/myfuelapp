import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceGenerationRequest {
  billing_period_start: string;
  billing_period_end: string;
  payment_terms?: string;
  payment_due_days?: number;
}

interface VehicleCount {
  organization_id: string;
  organization_name: string;
  vehicle_count: number;
  monthly_fee_per_vehicle: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: InvoiceGenerationRequest = await req.json();
    const {
      billing_period_start,
      billing_period_end,
      payment_terms = "30-Days",
      payment_due_days = 30
    } = requestData;

    if (!billing_period_start || !billing_period_end) {
      throw new Error("billing_period_start and billing_period_end are required");
    }

    const invoiceDate = new Date().toISOString().split('T')[0];

    // Calculate payment due date as last day of the month following the billing period end
    const billingEndDate = new Date(billing_period_end);
    const paymentDueDate = new Date(billingEndDate.getFullYear(), billingEndDate.getMonth() + 2, 0);
    const paymentDueDateStr = paymentDueDate.toISOString().split('T')[0];

    const VAT_RATE = 0.15;

    // Get all client organizations (not management org, not garage-managed — those are billed via their garage)
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, monthly_fee_per_vehicle, parent_org_id, payment_option, fuel_payment_terms, fuel_payment_interest_rate')
      .eq('status', 'active')
      .eq('organization_type', 'client')
      .eq('is_garage_managed', false);

    if (orgError) throw orgError;

    if (!organizations || organizations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No client organizations found to invoice",
          invoices_generated: 0,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const invoicesGenerated = [];
    const errors = [];

    for (const org of organizations) {
      try {
        // Check if invoice already exists for this period
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('id, invoice_number')
          .eq('organization_id', org.id)
          .eq('billing_period_start', billing_period_start)
          .eq('billing_period_end', billing_period_end)
          .maybeSingle();

        if (existingInvoice) {
          errors.push({
            organization: org.name,
            error: `Invoice already exists: ${existingInvoice.invoice_number}`
          });
          continue;
        }

        // Count active vehicles for this organization
        const { count: vehicleCount, error: countError } = await supabase
          .from('vehicles')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('status', 'active')
          .is('deleted_at', null);

        if (countError) throw countError;

        const activeVehicles = vehicleCount || 0;

        if (activeVehicles === 0 || !org.monthly_fee_per_vehicle) {
          errors.push({
            organization: org.name,
            error: activeVehicles === 0
              ? "No active vehicles"
              : "No monthly fee per vehicle set"
          });
          continue;
        }

        // Calculate amounts — round to 2dp at each step to satisfy the
        // valid_amounts check constraint (total_amount = subtotal + vat_amount)
        const feePerVehicle = parseFloat(String(org.monthly_fee_per_vehicle));
        const subtotal = Math.round(activeVehicles * feePerVehicle * 100) / 100;
        const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
        const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;

        // Get next invoice number from global sequence
        const { data: invoiceNumberData, error: seqError } = await supabase
          .rpc('get_next_invoice_number');

        if (seqError) throw seqError;

        const invoiceNumber = invoiceNumberData as string;

        // Create invoice with payment option details
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            organization_id: org.id,
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
            status: 'issued',
            issued_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Create invoice line item
        const { error: lineItemError } = await supabase
          .from('invoice_line_items')
          .insert({
            invoice_id: invoice.id,
            line_number: 1,
            description: `Monthly fleet management fee - ${activeVehicles} vehicle(s)`,
            quantity: activeVehicles,
            unit_price: org.monthly_fee_per_vehicle,
            line_total: subtotal,
            item_type: 'Vehicle Fee',
          });

        if (lineItemError) throw lineItemError;

        invoicesGenerated.push({
          organization: org.name,
          invoice_number: invoiceNumber,
          vehicle_count: activeVehicles,
          subtotal,
          vat_amount: vatAmount,
          total_amount: totalAmount,
        });

      } catch (error: any) {
        errors.push({
          organization: org.name,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        billing_period: {
          start: billing_period_start,
          end: billing_period_end,
        },
        invoice_date: invoiceDate,
        payment_due_date: paymentDueDateStr,
        invoices_generated: invoicesGenerated.length,
        invoices: invoicesGenerated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});