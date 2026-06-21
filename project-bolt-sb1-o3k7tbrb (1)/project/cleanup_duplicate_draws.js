import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf-8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return envVars;
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanupDuplicateDraws() {
  console.log('Starting cleanup of duplicate unreturned vehicle draws...\n');

  const { data: unreturnedDraws, error: drawsError } = await supabase
    .from('vehicle_transactions')
    .select(`
      id,
      vehicle_id,
      driver_id,
      organization_id,
      odometer_reading,
      created_at,
      vehicles (registration_number),
      drivers (first_name, surname)
    `)
    .eq('transaction_type', 'draw')
    .is('related_transaction_id', null)
    .order('vehicle_id')
    .order('created_at', { ascending: false });

  if (drawsError) {
    console.error('Error fetching unreturned draws:', drawsError);
    return;
  }

  console.log(`Found ${unreturnedDraws.length} total unreturned draws\n`);

  const vehicleGroups = {};
  for (const draw of unreturnedDraws) {
    if (!vehicleGroups[draw.vehicle_id]) {
      vehicleGroups[draw.vehicle_id] = [];
    }
    vehicleGroups[draw.vehicle_id].push(draw);
  }

  const vehiclesWithDuplicates = Object.entries(vehicleGroups).filter(([_, draws]) => draws.length > 1);

  if (vehiclesWithDuplicates.length === 0) {
    console.log('No vehicles found with multiple unreturned draws. Data is clean!');
    return;
  }

  console.log(`Found ${vehiclesWithDuplicates.length} vehicles with multiple unreturned draws:\n`);

  let totalClosed = 0;
  let totalKept = 0;

  for (const [vehicleId, draws] of vehiclesWithDuplicates) {
    const vehicle = draws[0].vehicles.registration_number;
    const mostRecentDraw = draws[0];
    const olderDraws = draws.slice(1);

    console.log(`Vehicle: ${vehicle}`);
    console.log(`  - Total unreturned draws: ${draws.length}`);
    console.log(`  - Most recent draw: ${new Date(mostRecentDraw.created_at).toLocaleString()} by ${mostRecentDraw.drivers.first_name} ${mostRecentDraw.drivers.surname}`);
    console.log(`  - Older draws to close: ${olderDraws.length}`);

    const returnOdometerReading = mostRecentDraw.odometer_reading;

    for (const oldDraw of olderDraws) {
      const driverName = `${oldDraw.drivers.first_name} ${oldDraw.drivers.surname}`;
      const drawDate = new Date(oldDraw.created_at).toLocaleString();

      console.log(`    - Closing draw from ${drawDate} by ${driverName}...`);

      const { error: insertError } = await supabase
        .from('vehicle_transactions')
        .insert({
          organization_id: oldDraw.organization_id,
          vehicle_id: oldDraw.vehicle_id,
          driver_id: oldDraw.driver_id,
          transaction_type: 'return',
          odometer_reading: returnOdometerReading,
          location: 'Auto-closed by cleanup script',
          related_transaction_id: oldDraw.id,
          created_at: new Date(mostRecentDraw.created_at).toISOString()
        });

      if (insertError) {
        console.error(`      ERROR: Failed to close draw: ${insertError.message}`);
      } else {
        console.log(`      ✓ Successfully closed`);
        totalClosed++;
      }
    }

    totalKept++;
    console.log('');
  }

  console.log('\n=== CLEANUP SUMMARY ===');
  console.log(`Vehicles processed: ${totalKept}`);
  console.log(`Old draws closed: ${totalClosed}`);
  console.log(`Active draws remaining: ${totalKept}`);
  console.log('\nCleanup complete!');
}

cleanupDuplicateDraws().catch(console.error);
