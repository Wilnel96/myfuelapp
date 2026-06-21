import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createShellRobertsonUser() {
  try {
    const email = 'shell.robertson@test.com';
    const password = 'Shell123!';
    const organizationId = '72443dcd-f70b-4a8b-8104-a96bac959458';

    console.log('Creating user account...');

    // Create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: 'Shell',
        surname: 'Robertson'
      }
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return;
    }

    console.log('User created:', authData.user.id);

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        role: 'garage_user',
        name: 'Shell',
        surname: 'Robertson'
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
    } else {
      console.log('Profile created');
    }

    // Create organization_users record
    const { error: orgUserError } = await supabase
      .from('organization_users')
      .insert({
        organization_id: organizationId,
        user_id: authData.user.id,
        role: 'garage_user',
        title: 'Garage Administrator',
        mobile_phone: null,
        office_phone: null,
        is_main_user: true,
        can_manage_users: true,
        can_manage_vehicles: true,
        can_manage_drivers: true,
        can_view_reports: true,
        can_manage_fuel_cards: true,
        can_view_invoices: true
      });

    if (orgUserError) {
      console.error('Error creating organization_users:', orgUserError);
    } else {
      console.log('Organization user created');
    }

    console.log('\n=================================');
    console.log('Shell Robertson Login Credentials:');
    console.log('=================================');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('=================================\n');

  } catch (error) {
    console.error('Error:', error);
  }
}

createShellRobertsonUser();
