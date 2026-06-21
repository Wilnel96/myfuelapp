import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GarageSale {
  transaction_id: string;
  organization_name: string;
  registration_number: string;
  make: string;
  model: string;
  fuel_type: string;
  liters: number;
  price_per_liter: number;
  rand_value: number;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;
  odometer_reading: number;
}

interface GarageReport {
  garage_id: string;
  garage_name: string;
  garage_email: string;
  sales: GarageSale[];
  total_liters: number;
  total_rand: number;
  total_commission: number;
  total_net: number;
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

    const today = new Date().toISOString().split('T')[0];

    // Run invoice integrity check first
    console.log("Running invoice integrity check...");
    const integrityCheckUrl = `${supabaseUrl}/functions/v1/check-invoice-integrity`;
    const integrityResponse = await fetch(integrityCheckUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
    });

    const integrityResult = await integrityResponse.json();
    console.log("Invoice integrity check result:", integrityResult);

    const { data: sales, error } = await supabase
      .from('garage_daily_sales')
      .select('*')
      .eq('sale_date', today);

    if (error) throw error;

    const garageReports: { [key: string]: GarageReport } = {};

    sales?.forEach((sale: any) => {
      if (!garageReports[sale.garage_id]) {
        garageReports[sale.garage_id] = {
          garage_id: sale.garage_id,
          garage_name: sale.garage_name,
          garage_email: sale.garage_email,
          sales: [],
          total_liters: 0,
          total_rand: 0,
          total_commission: 0,
          total_net: 0,
        };
      }

      const report = garageReports[sale.garage_id];
      report.sales.push({
        transaction_id: sale.transaction_id,
        organization_name: sale.organization_name,
        registration_number: sale.registration_number,
        make: sale.make,
        model: sale.model,
        fuel_type: sale.fuel_type,
        liters: parseFloat(sale.liters),
        price_per_liter: parseFloat(sale.price_per_liter),
        rand_value: parseFloat(sale.rand_value),
        commission_rate: parseFloat(sale.commission_rate),
        commission_amount: parseFloat(sale.commission_amount),
        net_amount: parseFloat(sale.net_amount),
        odometer_reading: sale.odometer_reading,
      });

      report.total_liters += parseFloat(sale.liters);
      report.total_rand += parseFloat(sale.rand_value);
      report.total_commission += parseFloat(sale.commission_amount);
      report.total_net += parseFloat(sale.net_amount);
    });

    const emailsSent = [];

    for (const garageId in garageReports) {
      const report = garageReports[garageId];

      if (!report.garage_email) {
        console.log(`No email address for garage ${report.garage_name}`);
        continue;
      }

      const emailBody = generateEmailBody(report, today);

      emailsSent.push({
        garage: report.garage_name,
        email: report.garage_email,
        total_sales: report.sales.length,
        total_amount: report.total_rand,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        garages_processed: Object.keys(garageReports).length,
        emails_sent: emailsSent.length,
        reports: emailsSent,
        invoice_integrity: integrityResult,
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

function generateEmailBody(report: GarageReport, date: string): string {
  let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          .total-row { background-color: #f2f2f2; font-weight: bold; }
          .header { background-color: #2196F3; color: white; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Daily Sales Report - ${report.garage_name}</h1>
          <p>Date: ${date}</p>
        </div>

        <h2>Transaction Details</h2>
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Vehicle</th>
              <th>Fuel Type</th>
              <th>Liters</th>
              <th>Price/L</th>
              <th>Amount (R)</th>
              <th>Commission (R)</th>
              <th>Net (R)</th>
              <th>Odometer</th>
            </tr>
          </thead>
          <tbody>
  `;

  report.sales.forEach(sale => {
    html += `
      <tr>
        <td>${sale.organization_name}</td>
        <td>${sale.registration_number} (${sale.make} ${sale.model})</td>
        <td>${sale.fuel_type}</td>
        <td>${sale.liters.toFixed(2)}</td>
        <td>${sale.price_per_liter.toFixed(2)}</td>
        <td>${sale.rand_value.toFixed(2)}</td>
        <td>${sale.commission_amount.toFixed(2)}</td>
        <td>${sale.net_amount.toFixed(2)}</td>
        <td>${sale.odometer_reading}</td>
      </tr>
    `;
  });

  html += `
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3">TOTALS</td>
              <td>${report.total_liters.toFixed(2)}</td>
              <td></td>
              <td>R ${report.total_rand.toFixed(2)}</td>
              <td>R ${report.total_commission.toFixed(2)}</td>
              <td>R ${report.total_net.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <p style="margin-top: 30px; color: #666;">
          This is an automated report from FleetFuel Management System.<br>
          Payment will be processed shortly.
        </p>
      </body>
    </html>
  `;

  return html;
}