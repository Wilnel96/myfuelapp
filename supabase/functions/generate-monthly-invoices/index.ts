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

    // Send email notification for each generated invoice
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    for (const inv of invoicesGenerated) {
      const orgId = (organizations as any[]).find((o) => o.name === inv.organization)?.id;
      if (!orgId) continue;

      const { data: orgUsers } = await supabase
        .from("organization_users")
        .select("email")
        .eq("organization_id", orgId)
        .eq("is_main_user", true)
        .eq("active", true);

      const recipientEmail = orgUsers?.[0]?.email;
      if (!recipientEmail) {
        console.log(`No main user email for ${inv.organization}, skipping email`);
        continue;
      }

      if (!resendApiKey) {
        console.log("RESEND_API_KEY not configured, skipping invoice email");
        break;
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">MyFuelApp</h1>
            <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Monthly Invoice Generated</p>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; font-size: 20px; margin-top: 0;">Invoice ${inv.invoice_number}</h2>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
              A new monthly invoice has been generated for <strong>${inv.organization}</strong>.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Invoice Number:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inv.invoice_number}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Vehicles:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inv.vehicle_count}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Subtotal:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">R ${inv.subtotal.toFixed(2)}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">VAT (15%):</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">R ${inv.vat_amount.toFixed(2)}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; font-size: 18px;">Total:</td><td style="padding: 8px; font-weight: bold; font-size: 18px; color: #2563eb;">R ${inv.total_amount.toFixed(2)}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
              Please log in to your MyFuelApp portal to view the full invoice details and make payment.
            </p>
          </div>
        </div>
      `;

      const fromAddresses = [
        "MyFuelApp <noreply@myfuelapp.net>",
        "MyFuelApp <onboarding@resend.dev>",
      ];

      for (const fromAddr of fromAddresses) {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [recipientEmail],
            subject: `Invoice ${inv.invoice_number} - ${inv.organization}`,
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          console.log(`Invoice email sent to ${recipientEmail} for ${inv.organization}`);
          break;
        }

        const errBody = await emailResponse.text();
        console.error(`Failed to send invoice email from ${fromAddr}:`, errBody);
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