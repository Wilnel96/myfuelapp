import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testLogin() {
  try {
    console.log('Testing login for shell.robertson@test.com...');

    // Try to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'shell.robertson@test.com',
      password: 'Test1234!',
    });

    if (error) {
      console.error('Login error:', error);
      return;
    }

    console.log('Login successful!');
    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    console.log('Session:', !!data.session);

    // Check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id, organizations(name, payment_option)')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile error:', profileError);
      return;
    }

    console.log('Profile:', profile);

    // Check organization_users
    const { data: orgUser, error: orgUserError } = await supabase
      .from('organization_users')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (orgUserError) {
      console.error('Organization users error:', orgUserError);
      return;
    }

    console.log('Organization user:', orgUser);

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testLogin();
