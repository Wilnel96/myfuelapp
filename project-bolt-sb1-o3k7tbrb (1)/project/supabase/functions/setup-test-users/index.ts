import { createClient } from 'npm:@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the NELMARK TRADING organization ID
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', 'NELMARK TRADING')
      .single();

    if (!org) {
      throw new Error('NELMARK TRADING organization not found');
    }

    const orgId = org.id;
    const results = [];

    // Create Super Admin user
    const { data: superAdmin, error: superAdminError } = await supabase.auth.admin.createUser({
      email: 'willem@fleetfuel.com',
      password: 'FleetFuel2024!',
      email_confirm: true,
      user_metadata: {
        full_name: 'Willem van der Merwe'
      }
    });

    if (superAdminError && !superAdminError.message.includes('already registered')) {
      throw superAdminError;
    }

    if (superAdmin?.user) {
      // Create profile for super admin
      await supabase
        .from('profiles')
        .upsert({
          id: superAdmin.user.id,
          organization_id: null,
          full_name: 'Willem van der Merwe',
          role: 'super_admin'
        });

      results.push({
        email: 'willem@fleetfuel.com',
        password: 'FleetFuel2024!',
        role: 'Super Admin',
        status: 'created'
      });
    }

    // Create Client Admin user
    const { data: clientAdmin, error: clientAdminError } = await supabase.auth.admin.createUser({
      email: 'john@fleet.com',
      password: 'Fleet2024!',
      email_confirm: true,
      user_metadata: {
        full_name: 'John Smith',
        organization_id: orgId
      }
    });

    if (clientAdminError && !clientAdminError.message.includes('already registered')) {
      throw clientAdminError;
    }

    if (clientAdmin?.user) {
      // Create profile for client admin
      await supabase
        .from('profiles')
        .upsert({
          id: clientAdmin.user.id,
          organization_id: orgId,
          full_name: 'John Smith',
          role: 'admin'
        });

      results.push({
        email: 'john@fleet.com',
        password: 'Fleet2024!',
        role: 'Client Admin',
        organization: 'NELMARK TRADING',
        status: 'created'
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test users created successfully',
        users: results
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
