import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dhklqlqpowrwjplrkfzz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoa2xxbHFwb3dyd2pwbHJrZnp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NTE5OTksImV4cCI6MjA4MTIyNzk5OX0.BIQWNP7CbcTVgFRBXwELg7LschBVHklyblR3cnZedUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log('Testing login with willem@fleetfuel.com...\n');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'willem@fleetfuel.com',
    password: 'FleetFuel2024!',
  });

  if (error) {
    console.error('❌ Login failed:', error.message);
    console.error('Error details:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Login successful!');
    console.log('User:', data.user.email);
    console.log('Session:', data.session ? 'Active' : 'None');
  }

  console.log('\n---\n');
  console.log('Testing login with john@fleet.com...\n');

  const { data: data2, error: error2 } = await supabase.auth.signInWithPassword({
    email: 'john@fleet.com',
    password: 'Fleet2024!',
  });

  if (error2) {
    console.error('❌ Login failed:', error2.message);
    console.error('Error details:', JSON.stringify(error2, null, 2));
  } else {
    console.log('✅ Login successful!');
    console.log('User:', data2.user.email);
    console.log('Session:', data2.session ? 'Active' : 'None');
  }
}

testLogin().catch(console.error);
