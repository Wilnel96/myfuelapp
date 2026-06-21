const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  try {
    console.log('=== Test Transport Login Test ===\n');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@test-transport.co.za',
      password: 'TestTransport2024!',
    });

    if (error) {
      console.error('❌ Login failed:', error.message);
      return;
    }

    console.log('✅ Login successful - User ID:', data.user?.id);
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile) {
      console.log('✅ Profile exists - Role:', profile.role);
    } else {
      console.log('❌ NO PROFILE FOUND - This causes the hang!');
    }

    await supabase.auth.signOut();
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

testLogin();
