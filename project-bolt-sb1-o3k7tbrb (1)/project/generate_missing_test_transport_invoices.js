import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file
const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateMissingInvoices() {
  console.log('Generating missing invoices for Test Transport...\n');

  // Transaction IDs that need invoices
  const transactionIds = [
    'd9e0da81-8514-4834-921a-c8ff5980a54a',
    '8ed609b4-455c-4309-a058-1a5cb0bfffe6'
  ];

  for (const transactionId of transactionIds) {
    console.log(`Generating invoice for transaction ${transactionId}...`);

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-fuel-transaction-invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fuelTransactionId: transactionId
        })
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✓ Invoice generated successfully: ${result.invoice.invoice_number}`);
        console.log(`  Vehicle: ${result.invoice.vehicle_registration}`);
        console.log(`  Amount: R ${result.invoice.total_amount}`);
        console.log(`  Date: ${new Date(result.invoice.transaction_date).toLocaleDateString('en-ZA')}\n`);
      } else {
        console.error(`✗ Failed to generate invoice: ${result.error}\n`);
      }
    } catch (error) {
      console.error(`✗ Error: ${error.message}\n`);
    }
  }

  console.log('Done!');
}

generateMissingInvoices();
