import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface VehiclePayload {
  registration_number: string;
  make: string;
  model: string;
  year: number;
  vehicle_type: string;
  fuel_type: string;
  license_code_required: string;
  license_disk_expiry: string;
  vin_number?: string;
  vehicle_number?: string;
  prdp_required?: boolean;
  tank_capacity?: number;
  initial_odometer_reading?: number;
  average_fuel_consumption_per_100km?: number;
}

interface DriverPayload {
  first_name: string;
  surname: string;
  id_number?: string;
  phone_number?: string;
  email?: string;
  license_number?: string;
  license_type?: string;
  license_expiry_date?: string;
  has_prdp?: boolean;
  prdp_type?: string;
  prdp_expiry_date?: string;
  status?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    const body = await req.json();
    const {
      action,
      garageEmail,
      garagePassword,
      organizationId,
      vehicles,
      drivers,
    }: {
      action: string;
      garageEmail: string;
      garagePassword: string;
      organizationId: string;
      vehicles?: VehiclePayload[];
      drivers?: DriverPayload[];
    } = body;

    // ── Authenticate garage ───────────────────────────────────────────────────
    let authenticatedGarageId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (user && !userError) {
        const { data: orgUser } = await supabase
          .from('organization_users')
          .select('organization_id, role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (orgUser && orgUser.role === 'garage_user') {
          const { data: garage } = await supabase
            .from('garages')
            .select('id, status')
            .eq('organization_id', orgUser.organization_id)
            .eq('status', 'active')
            .maybeSingle();
          if (garage) authenticatedGarageId = garage.id;
        }
      }
    }

    if (!authenticatedGarageId && garageEmail && garagePassword) {
      const { data: garages } = await supabase
        .from('garages')
        .select('id, contact_persons, status');
      for (const garage of garages || []) {
        if (garage.status !== 'active') continue;
        const contacts = (garage.contact_persons as any[]) || [];
        const match = contacts.find(
          (c: any) =>
            c.email?.toLowerCase() === garageEmail?.toLowerCase() &&
            c.password === garagePassword
        );
        if (match) { authenticatedGarageId = garage.id; break; }
      }
    }

    if (!authenticatedGarageId) {
      return new Response(
        JSON.stringify({ error: 'Invalid garage credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Verify the org is managed by this garage ──────────────────────────────
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, managing_garage_id, is_garage_managed')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError) throw orgError;
    if (!org || org.managing_garage_id !== authenticatedGarageId || !org.is_garage_managed) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: organisation not managed by this garage' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Handle actions ────────────────────────────────────────────────────────
    switch (action) {

      case 'add-vehicles': {
        if (!vehicles || vehicles.length === 0) {
          return new Response(JSON.stringify({ data: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const rows = vehicles.map(v => ({
          registration_number: (v.registration_number || '').toUpperCase().replace(/\s+/g, ''),
          make: v.make || '',
          model: v.model || '',
          year: v.year || new Date().getFullYear(),
          vehicle_type: v.vehicle_type || 'ULP',
          fuel_type: v.fuel_type || 'ULP-95',
          license_code_required: v.license_code_required || 'Code B',
          license_disk_expiry: v.license_disk_expiry || null,
          vin_number: v.vin_number || null,
          vehicle_number: v.vehicle_number || null,
          prdp_required: v.prdp_required || false,
          tank_capacity: v.tank_capacity || 0,
          initial_odometer_reading: v.initial_odometer_reading || 0,
          average_fuel_consumption_per_100km: v.average_fuel_consumption_per_100km || 10,
          status: 'active',
          organization_id: organizationId,
        }));

        const { data, error } = await supabase
          .from('vehicles')
          .insert(rows)
          .select('id, registration_number, make, model');

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'add-drivers': {
        if (!drivers || drivers.length === 0) {
          return new Response(JSON.stringify({ data: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const rows = drivers.map(d => ({
          first_name: d.first_name || '',
          surname: d.surname || '',
          id_number: d.id_number || null,
          phone_number: d.phone_number || null,
          email: d.email || null,
          license_number: d.license_number || null,
          license_type: d.license_type || null,
          license_expiry_date: d.license_expiry_date || null,
          has_prdp: d.has_prdp || false,
          prdp_type: d.has_prdp ? (d.prdp_type || null) : null,
          prdp_expiry_date: d.has_prdp ? (d.prdp_expiry_date || null) : null,
          status: d.status || 'active',
          organization_id: organizationId,
        }));

        const { data, error } = await supabase
          .from('drivers')
          .insert(rows)
          .select('id, first_name, surname');

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-setup-data': {
        // Return existing vehicles and drivers for this org (for review step)
        const [vRes, dRes] = await Promise.all([
          supabase.from('vehicles').select('id, registration_number, make, model, year, status').eq('organization_id', organizationId).eq('status', 'active'),
          supabase.from('drivers').select('id, first_name, surname, status').eq('organization_id', organizationId).eq('status', 'active'),
        ]);
        return new Response(JSON.stringify({ vehicles: vRes.data || [], drivers: dRes.data || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
