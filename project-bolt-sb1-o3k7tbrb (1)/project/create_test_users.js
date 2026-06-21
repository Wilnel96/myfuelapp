import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUsers() {
  console.log('Creating test users...\n');

  // Get the NELMARK TRADING organization ID
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', 'NELMARK TRADING')
    .single();

  if (!org) {
    console.error('NELMARK TRADING organization not found');
    return;
  }

  const orgId = org.id;
  console.log(`Found organization: NELMARK TRADING (${orgId})\n`);

  // Create Super Admin user
  console.log('1. Creating Super Admin: willem@fleetfuel.com');
  const { data: superAdmin, error: superAdminError } = await supabase.auth.admin.createUser({
    email: 'willem@fleetfuel.com',
    password: 'FleetFuel2024!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Willem van der Merwe'
    }
  });

  if (superAdminError) {
    console.error('Error creating super admin:', superAdminError.message);
  } else {
    console.log('✓ Super Admin user created in auth.users');

    // Create profile for super admin
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: superAdmin.user.id,
        organization_id: null, // Super admin doesn't belong to one org
        full_name: 'Willem van der Merwe',
        role: 'super_admin'
      });

    if (profileError) {
      console.error('Error creating super admin profile:', profileError.message);
    } else {
      console.log('✓ Super Admin profile created');
      console.log('  Email: willem@fleetfuel.com');
      console.log('  Password: FleetFuel2024!\n');
    }
  }

  // Create Client Admin user
  console.log('2. Creating Client Admin: john@fleet.com');
  const { data: clientAdmin, error: clientAdminError } = await supabase.auth.admin.createUser({
    email: 'john@fleet.com',
    password: 'Fleet2024!',
    email_confirm: true,
    user_metadata: {
      full_name: 'John Smith',
      organization_id: orgId
    }
  });

  if (clientAdminError) {
    console.error('Error creating client admin:', clientAdminError.message);
  } else {
    console.log('✓ Client Admin user created in auth.users');

    // Create profile for client admin
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: clientAdmin.user.id,
        organization_id: orgId,
        full_name: 'John Smith',
        role: 'admin'
      });

    if (profileError) {
      console.error('Error creating client admin profile:', profileError.message);
    } else {
      console.log('✓ Client Admin profile created');
      console.log('  Email: john@fleet.com');
      console.log('  Password: Fleet2024!');
      console.log('  Organization: NELMARK TRADING\n');
    }
  }

  console.log('\n========================================');
  console.log('Test Users Created Successfully!');
  console.log('========================================');
  console.log('\nYou can now log in with:');
  console.log('\nSuper Admin:');
  console.log('  Email: willem@fleetfuel.com');
  console.log('  Password: FleetFuel2024!');
  console.log('\nClient Admin:');
  console.log('  Email: john@fleet.com');
  console.log('  Password: Fleet2024!');
}

createTestUsers().catch(console.error);
