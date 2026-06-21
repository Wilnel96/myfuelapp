const SUPABASE_URL = 'https://dhklqlqpowrwjplrkfzz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoa2xxbHFwb3dyd2pwbHJrZnp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NTE5OTksImV4cCI6MjA4MTIyNzk5OX0.BIQWNP7CbcTVgFRBXwELg7LschBVHklyblR3cnZedUI';

const transactionIds = [
  'a936504f-d602-40a3-8a7b-c3c56e3c4928', // Dec 28 - Missing invoice
  '9082f2e4-7c37-4a2e-93b0-c8164be09f7e', // Most recent - Dec 27
  'b8158385-9593-4828-b07d-2dc85de80893', // Dec 25
  '1f102417-4c5c-4d4e-aba5-c8fd626950a3', // Dec 25
  '037f619c-619c-43a9-a6e2-96be2115b7f0', // Dec 19
  '9be701ef-3d70-484b-8999-f81b74de5318', // Dec 19
];

async function generateInvoice(transactionId) {
  const url = `${SUPABASE_URL}/functions/v1/generate-fuel-transaction-invoice`;

  try {
    console.log(`Generating invoice for transaction: ${transactionId}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fuelTransactionId: transactionId }),
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ Invoice generated: ${data.invoice.invoice_number}`);
      console.log(`   Amount: R ${data.invoice.total_amount}`);
      console.log(`   Vehicle: ${data.invoice.vehicle_registration}`);
      console.log(`   Driver: ${data.invoice.driver_name}\n`);
    } else {
      console.error(`❌ Failed: ${data.error}\n`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
    return { error: error.message };
  }
}

async function generateAllInvoices() {
  console.log('Generating missing fuel invoices for Willem...\n');

  for (const transactionId of transactionIds) {
    await generateInvoice(transactionId);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✅ All invoices generated!');
}

generateAllInvoices().catch(console.error);
