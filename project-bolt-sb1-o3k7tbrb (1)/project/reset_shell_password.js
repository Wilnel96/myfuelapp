import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function resetPassword() {
  try {
    // Find the user
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    const user = users.find(u => u.email === 'shell.robertson@test.com');

    if (!user) {
      console.error('User not found');
      return;
    }

    console.log('Found user:', user.id, user.email);

    // Update password
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: 'Test1234!' }
    );

    if (error) {
      console.error('Error updating password:', error);
      return;
    }

    console.log('Password updated successfully!');
    console.log('Email: shell.robertson@test.com');
    console.log('Password: Test1234!');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

resetPassword();
