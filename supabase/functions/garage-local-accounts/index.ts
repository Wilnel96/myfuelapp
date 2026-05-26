import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    const { action, garageEmail, garagePassword, accountId, accountData, organizationId, orgData } = body;

    let authenticatedGarage: { id: string; name: string; contact_persons?: any[] } | null = null;
    let currentContact: any = null;

    // Try Supabase Auth first
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
            .select('id, name, contact_persons, status')
            .eq('organization_id', orgUser.organization_id)
            .eq('status', 'active')
            .maybeSingle();

          if (garage) authenticatedGarage = garage;
        }
      }
    }

    // Fall back to email/password auth
    if (!authenticatedGarage && garageEmail && garagePassword) {
      const { data: garages } = await supabase
        .from('garages')
        .select('id, name, contact_persons, status');

      for (const garage of garages || []) {
        if (garage.status !== 'active') continue;
        const contacts = (garage.contact_persons as any[]) || [];
        const match = contacts.find(
          (c: any) =>
            c.email?.toLowerCase() === garageEmail?.toLowerCase() &&
            c.password === garagePassword
        );
        if (match) {
          authenticatedGarage = garage;
          currentContact = match;
          break;
        }
      }
    }

    if (!authenticatedGarage) {
      return new Response(
        JSON.stringify({ error: 'Invalid garage credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper: resolve current contact permissions (primary = all permissions)
    const getPermissions = () => {
      if (!currentContact) {
        // Authenticated via Supabase Auth — treat as full access (garage_user role)
        return {
          can_change_account_numbers: true,
          can_edit_client_info: true,
          can_view_invoices: true,
          can_create_invoices: true,
          can_manage_statements: true,
          can_manage_payments: true,
          can_add_clients: true,
          can_view_reports: true,
        };
      }
      if (currentContact.is_primary) {
        return {
          can_change_account_numbers: true,
          can_edit_client_info: true,
          can_view_invoices: true,
          can_create_invoices: true,
          can_manage_statements: true,
          can_manage_payments: true,
          can_add_clients: true,
          can_view_reports: true,
        };
      }
      return currentContact;
    };

    switch (action) {
      case 'list': {
        const { data, error } = await supabase
          .from('organization_garage_accounts')
          .select('id, organization_id, is_active, notes, account_number, monthly_spend_limit, deposit_amount')
          .eq('garage_id', authenticatedGarage.id);
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create': {
        const { data, error } = await supabase
          .from('organization_garage_accounts')
          .insert({ ...accountData, garage_id: authenticatedGarage.id })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        // Verify account belongs to this garage
        const { data: existingAccount, error: checkError } = await supabase
          .from('organization_garage_accounts')
          .select('garage_id')
          .eq('id', accountId)
          .single();
        if (checkError) throw checkError;

        if (existingAccount.garage_id !== authenticatedGarage.id) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: account does not belong to this garage' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Enforce account number permission
        if ('account_number' in accountData) {
          const perms = getPermissions();
          if (!perms.can_change_account_numbers) {
            return new Response(
              JSON.stringify({ error: 'You do not have permission to change account numbers. Contact the primary garage user.' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const { data, error } = await supabase
          .from('organization_garage_accounts')
          .update(accountData)
          .eq('id', accountId)
          .eq('garage_id', authenticatedGarage.id)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-org-info': {
        // Edit managed client organisation details
        const perms = getPermissions();
        if (!perms.can_edit_client_info) {
          return new Response(
            JSON.stringify({ error: 'You do not have permission to edit client information.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify org is managed by this garage
        const { data: org, error: orgCheckError } = await supabase
          .from('organizations')
          .select('id, managing_garage_id, is_garage_managed')
          .eq('id', organizationId)
          .maybeSingle();

        if (orgCheckError) throw orgCheckError;
        if (!org || org.managing_garage_id !== authenticatedGarage.id || !org.is_garage_managed) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: organisation not managed by this garage' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Only allow safe fields to be updated
        const allowed = ['name', 'vat_number', 'company_registration_number', 'address_line_1', 'address_line_2', 'city', 'province', 'postal_code', 'country', 'phone_number'];
        const safeData: Record<string, any> = {};
        for (const key of allowed) {
          if (key in orgData) safeData[key] = orgData[key];
        }

        const { data: updatedOrg, error: updateError } = await supabase
          .from('organizations')
          .update(safeData)
          .eq('id', organizationId)
          .select()
          .single();
        if (updateError) throw updateError;

        return new Response(JSON.stringify({ data: updatedOrg }), {
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
