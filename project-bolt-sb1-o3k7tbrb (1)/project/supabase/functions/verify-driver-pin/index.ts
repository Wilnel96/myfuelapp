import { createClient } from 'npm:@supabase/supabase-js@2.83.0';
import bcrypt from 'npm:bcryptjs@2.4.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface VerifyPINRequest {
  driverId: string;
  pin: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { driverId, pin }: VerifyPINRequest = await req.json();

    if (!driverId || !pin) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from('driver_payment_settings')
      .select('pin_hash, is_pin_active, failed_pin_attempts, locked_until')
      .eq('driver_id', driverId)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    if (!settings) {
      return new Response(
        JSON.stringify({ error: 'No PIN set up for this driver', requiresSetup: true }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_pin_active) {
      return new Response(
        JSON.stringify({ error: 'PIN is not active for this driver', requiresSetup: true }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (settings.locked_until && new Date(settings.locked_until) > new Date()) {
      return new Response(
        JSON.stringify({
          error: 'Account is temporarily locked due to too many failed attempts',
          lockedUntil: settings.locked_until
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pinValid = await bcrypt.compare(pin, settings.pin_hash);

    if (!pinValid) {
      const newFailedAttempts = (settings.failed_pin_attempts || 0) + 1;
      const shouldLock = newFailedAttempts >= 3;

      const updateData: any = {
        failed_pin_attempts: newFailedAttempts,
      };

      if (shouldLock) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);
        updateData.locked_until = lockUntil.toISOString();
      }

      await supabase
        .from('driver_payment_settings')
        .update(updateData)
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({
          error: 'Incorrect PIN',
          attemptsRemaining: Math.max(0, 3 - newFailedAttempts),
          locked: shouldLock
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('driver_payment_settings')
      .update({
        failed_pin_attempts: 0,
        locked_until: null,
      })
      .eq('driver_id', driverId);

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('PIN verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});