import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dhklqlqpowrwjplrkfzz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoa2xxbHFwb3dyd2pwbHJrZnp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NTE5OTksImV4cCI6MjA4MTIyNzk5OX0.BIQWNP7CbcTVgFRBXwELg7LschBVHklyblR3cnZedUI';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testClientLogin() {
  console.log('Testing client login for john@fleet.com...\n');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'john@fleet.com',
      password: 'Fleet2024!',
    });

    if (error) {
      console.error('❌ Login failed:', error.message);
      console.error('Error details:', error);
      return;
    }

    console.log('✅ Login successful!');
    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    console.log('Session token:', data.session?.access_token ? 'Present' : 'Missing');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('\n❌ Profile fetch failed:', profileError.message);
      return;
    }

    if (!profile) {
      console.error('\n❌ No profile found for user');
      return;
    }

    console.log('\n✅ Profile found:');
    console.log('Role:', profile.role);
    console.log('Organization ID:', profile.organization_id);

    if (profile.organization_id) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .maybeSingle();

      if (orgError) {
        console.error('\n❌ Organization fetch failed:', orgError.message);
        return;
      }

      if (!org) {
        console.error('\n❌ No organization found');
        return;
      }

      console.log('\n✅ Organization:');
      console.log('Name:', org.name);
    }

    const { data: orgUser, error: orgUserError } = await supabase
      .from('organization_users')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (orgUserError) {
      console.log('\n⚠️ Organization user check:', orgUserError.message);
    } else if (orgUser) {
      console.log('\n✅ Organization user entry:');
      console.log('Active:', orgUser.is_active);
      console.log('Is Main User:', orgUser.is_main_user);
    } else {
      console.log('\n⚠️ No organization_users entry found');
    }

    await supabase.auth.signOut();
    console.log('\n✅ Signed out successfully');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testClientLogin();
