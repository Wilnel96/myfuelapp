const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  try {
    console.log('Testing Test Transport login...\n');
    console.log('Attempting login with: admin@test-transport.co.za\n');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@test-transport.co.za',
      password: 'TestTransport2024!',
    });

    if (error) {
      console.error('❌ Login failed:', error.message);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('✅ Login successful!');
    console.log('User ID:', data.user?.id);
    console.log('Email:', data.user?.email);
    console.log('Session token:', data.session?.access_token ? 'Present' : 'Missing');
    console.log('');

    // Check profile
    console.log('Checking profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('❌ Profile error:', profileError);
    } else if (profile) {
      console.log('✅ Profile found:');
      console.log('Role:', profile.role);
      console.log('');
    } else {
      console.log('⚠️ No profile found - THIS IS THE ISSUE!');
      console.log('');
    }

    // Check organization_users
    console.log('Checking organization_users...');
    const { data: orgUser, error: orgUserError } = await supabase
      .from('organization_users')
      .select('*, organizations(name)')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (orgUserError) {
      console.error('❌ Organization user error:', orgUserError);
    } else if (orgUser) {
      console.log('✅ Organization user entry:');
      console.log('Active:', orgUser.is_active);
      console.log('Is Main User:', orgUser.is_main_user);
      console.log('Organization:', orgUser.organizations?.name);
    } else {
      console.log('⚠️ No organization user entry found');
    }

    await supabase.auth.signOut();
    console.log('\n✅ Signed out successfully');
  } catch (err) {
    console.error('❌ Exception:', err.message);
    console.error(err);
  }
}

testLogin();
