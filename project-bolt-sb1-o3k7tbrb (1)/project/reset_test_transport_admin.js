import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetPassword() {
  try {
    // Get the user
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('Error listing users:', userError);
      return;
    }

    const user = users.users.find(u => u.email === 'admin@test-transport.co.za');

    if (!user) {
      console.error('User not found');
      return;
    }

    console.log('Found user:', user.email, 'ID:', user.id);

    // Reset password to TestTransport2024!
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: 'TestTransport2024!' }
    );

    if (error) {
      console.error('Error resetting password:', error);
      return;
    }

    console.log('✓ Password reset successfully for', user.email);
    console.log('New password: TestTransport2024!');

    // Also update in organization_users table
    const { error: orgError } = await supabase
      .from('organization_users')
      .update({ password: 'TestTransport2024!' })
      .eq('user_id', user.id);

    if (orgError) {
      console.error('Error updating organization_users:', orgError);
    } else {
      console.log('✓ Updated password in organization_users table');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

resetPassword();
