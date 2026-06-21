import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file
const envFile = readFileSync(join(__dirname, '.env'), 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetPassword() {
  try {
    console.log('Resetting password for Test Transport admin user...');

    const userId = '002738de-9cce-4885-a8fb-1aa4f6793b39';
    const newPassword = 'TestTransport2024!';

    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) {
      console.error('Error updating password:', error);
      process.exit(1);
    }

    // Also update the password in organization_users table
    const { error: orgError } = await supabase
      .from('organization_users')
      .update({ password: newPassword })
      .eq('user_id', userId);

    if (orgError) {
      console.error('Error updating organization_users password:', orgError);
    }

    console.log('\n✅ Password reset successfully!');
    console.log('\nTest Transport Login Credentials:');
    console.log('Email: admin@test-transport.co.za');
    console.log('Password: TestTransport2024!');
    console.log('\nYou can now log in using the Client Portal or System Admin option.');

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

resetPassword();
