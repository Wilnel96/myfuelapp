import { createClient } from 'npm:@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface LoginRequest {
  firstName: string;
  dateOfBirth: string;
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

    const { firstName, dateOfBirth }: LoginRequest = await req.json();

    if (!firstName || !dateOfBirth) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .ilike('first_name', firstName)
      .eq('date_of_birth', dateOfBirth)
      .eq('status', 'active')
      .maybeSingle();

    if (driverError || !driver) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8);

    const { error: sessionError } = await supabase
      .from('driver_sessions')
      .insert({
        driver_id: driver.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      throw sessionError;
    }

    await supabase
      .from('drivers')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', driver.id);

    const { data: paymentSettings } = await supabase
      .from('driver_payment_settings')
      .select('is_pin_active')
      .eq('driver_id', driver.id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        token,
        driver: {
          id: driver.id,
          firstName: driver.first_name,
          lastName: driver.surname,
          organizationId: driver.organization_id,
          hasPIN: paymentSettings?.is_pin_active || false,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
