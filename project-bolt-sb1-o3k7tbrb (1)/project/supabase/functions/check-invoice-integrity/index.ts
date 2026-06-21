import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IntegrityCheckResult {
  totalTransactionsChecked: number;
  missingInvoices: number;
  invoicesGenerated: number;
  failures: Array<{
    transactionId: string;
    error: string;
  }>;
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

    console.log("Starting invoice integrity check...");

    // Find all fuel transactions without invoices
    const { data: transactionsWithoutInvoices, error: queryError } = await supabase
      .from("fuel_transactions")
      .select("id, transaction_date, vehicle_id, garage_id, total_amount")
      .is("invoice_id", null)
      .order("transaction_date", { ascending: true });

    if (queryError) {
      console.error("Error querying transactions:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query transactions", details: queryError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result: IntegrityCheckResult = {
      totalTransactionsChecked: transactionsWithoutInvoices?.length || 0,
      missingInvoices: transactionsWithoutInvoices?.length || 0,
      invoicesGenerated: 0,
      failures: [],
    };

    console.log(`Found ${result.missingInvoices} transactions without invoices`);

    // Generate invoices for each missing transaction
    if (transactionsWithoutInvoices && transactionsWithoutInvoices.length > 0) {
      for (const transaction of transactionsWithoutInvoices) {
        try {
          console.log(`Generating invoice for transaction ${transaction.id}...`);

          const invoiceApiUrl = `${supabaseUrl}/functions/v1/generate-fuel-transaction-invoice`;
          const invoiceResponse = await fetch(invoiceApiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fuelTransactionId: transaction.id,
            }),
          });

          const invoiceResult = await invoiceResponse.json();

          if (invoiceResult.success) {
            result.invoicesGenerated++;
            console.log(`✓ Generated invoice ${invoiceResult.invoice.invoice_number} for transaction ${transaction.id}`);
          } else {
            result.failures.push({
              transactionId: transaction.id,
              error: invoiceResult.error || "Unknown error",
            });
            console.error(`✗ Failed to generate invoice for transaction ${transaction.id}:`, invoiceResult.error);
          }
        } catch (error) {
          result.failures.push({
            transactionId: transaction.id,
            error: error.message,
          });
          console.error(`✗ Error generating invoice for transaction ${transaction.id}:`, error);
        }

        // Add a small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log("Invoice integrity check complete:", result);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invoice integrity check completed",
        result,
        summary: `Checked ${result.totalTransactionsChecked} transactions. Generated ${result.invoicesGenerated} missing invoices. ${result.failures.length} failures.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: "Invoice integrity check failed",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});