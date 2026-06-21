import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UserPayload {
  email: string;
  password: string;
  name: string;
  surname: string;
  phone_office?: string;
  phone_mobile?: string;
  is_main_user: boolean;
  role: string;
  title?: string;
  can_add_vehicles?: boolean;
  can_edit_vehicles?: boolean;
  can_delete_vehicles?: boolean;
  can_add_drivers?: boolean;
  can_edit_drivers?: boolean;
  can_delete_drivers?: boolean;
  can_view_reports?: boolean;
  can_edit_organization_info?: boolean;
  can_view_fuel_transactions?: boolean;
  can_create_reports?: boolean;
  can_view_custom_reports?: boolean;
  can_manage_users?: boolean;
  can_view_financial_data?: boolean;
}

interface OrgPayload {
  name: string;
  entity_type?: string | null;
  entity_type_other?: string | null;
  company_registration_number?: string | null;
  vat_number?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  website?: string | null;
  monthly_fee_per_vehicle?: number;
  monthly_fee_per_driver?: number;
  month_end_day?: number;
  year_end_month?: number;
  year_end_day?: number;
  daily_spending_limit?: number | null;
  monthly_spending_limit?: number | null;
  payment_option?: string | null;
  fuel_payment_terms?: string | null;
  fuel_payment_interest_rate?: number | null;
  organization_type: string;
  is_management_org: boolean;
  status: string;
  managing_garage_id?: string | null;
  is_garage_managed?: boolean;
}

interface RequestBody {
  organization: OrgPayload;
  users: UserPayload[];
  garage_account_number?: string | null;
  // When true (individual public signup), the single main user is also inserted as Billing User
  create_billing_user_from_main?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const { organization, users, garage_account_number, create_billing_user_from_main }: RequestBody = await req.json();

    if (!organization?.name) throw new Error('Organization name is required');
    if (!users || users.length === 0) throw new Error('At least one user is required');

    // Validate all users have required fields before doing any work
    for (const userData of users) {
      if (!userData.email || !userData.email.trim()) throw new Error('Email address is required');
      if (!userData.password || userData.password.length < 6) throw new Error('Password must be at least 6 characters');
      if (!userData.name || !userData.name.trim()) throw new Error('Name is required');
      if (!userData.surname || !userData.surname.trim()) throw new Error('Surname is required');
    }

    // Check for duplicate org name
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', organization.name)
      .maybeSingle();

    if (existing) {
      throw new Error(`An organization with the name "${organization.name}" already exists.`);
    }

    // Apply global default fees if not provided
    if (organization.monthly_fee_per_vehicle == null || organization.monthly_fee_per_vehicle === 0) {
      const { data: vFee } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'monthly_fee_per_vehicle')
        .maybeSingle();
      if (vFee?.value) organization.monthly_fee_per_vehicle = parseFloat(vFee.value) || 0;
    }
    if (organization.monthly_fee_per_driver == null || organization.monthly_fee_per_driver === 0) {
      const { data: dFee } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'monthly_fee_per_driver')
        .maybeSingle();
      if (dFee?.value) organization.monthly_fee_per_driver = parseFloat(dFee.value) || 0;
    }

    // Create the organization
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert(organization)
      .select()
      .single();

    if (orgError) {
      if (orgError.code === '23505') throw new Error(`An organization with the name "${organization.name}" already exists.`);
      throw orgError;
    }
    if (!newOrg) throw new Error('Failed to create organization');

    // If this org was created by a garage, create the garage account link immediately
    if (organization.managing_garage_id) {
      const { error: accountError } = await supabase
        .from('organization_garage_accounts')
        .insert({
          organization_id: newOrg.id,
          garage_id: organization.managing_garage_id,
          is_active: true,
          account_number: garage_account_number || null,
        });

      if (accountError) {
        await supabase.from('organizations').delete().eq('id', newOrg.id);
        throw new Error(`Failed to create garage account link: ${accountError.message}`);
      }
    }

    const createdUsers = [];

    for (const userData of users) {
      // Check duplicate email in this org
      const { data: existingOrgUser } = await supabase
        .from('organization_users')
        .select('id')
        .eq('organization_id', newOrg.id)
        .eq('email', userData.email)
        .maybeSingle();

      if (existingOrgUser) {
        throw new Error(`A user with email ${userData.email} already exists in this organization`);
      }

      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name,
          surname: userData.surname,
          organization_id: newOrg.id,
        },
      });

      if (signUpError) throw new Error(`Failed to create user: ${signUpError.message}`);
      if (!authData.user) throw new Error('Failed to create user account');

      const permissions = userData.is_main_user ? {
        can_add_vehicles: true,
        can_edit_vehicles: true,
        can_delete_vehicles: true,
        can_add_drivers: true,
        can_edit_drivers: true,
        can_delete_drivers: true,
        can_view_reports: true,
        can_edit_organization_info: true,
        can_view_fuel_transactions: true,
        can_create_reports: true,
        can_view_custom_reports: true,
        can_manage_users: true,
        can_view_financial_data: true,
      } : {
        can_add_vehicles: userData.can_add_vehicles ?? false,
        can_edit_vehicles: userData.can_edit_vehicles ?? false,
        can_delete_vehicles: userData.can_delete_vehicles ?? false,
        can_add_drivers: userData.can_add_drivers ?? false,
        can_edit_drivers: userData.can_edit_drivers ?? false,
        can_delete_drivers: userData.can_delete_drivers ?? false,
        can_view_reports: userData.can_view_reports ?? false,
        can_edit_organization_info: userData.can_edit_organization_info ?? false,
        can_view_fuel_transactions: userData.can_view_fuel_transactions ?? false,
        can_create_reports: userData.can_create_reports ?? false,
        can_view_custom_reports: userData.can_view_custom_reports ?? false,
        can_manage_users: userData.can_manage_users ?? false,
        can_view_financial_data: userData.can_view_financial_data ?? false,
      };

      const title = userData.title || (userData.is_main_user ? 'Main User' : 'User');

      const { error: orgUserError } = await supabase
        .from('organization_users')
        .insert({
          user_id: authData.user.id,
          email: userData.email,
          first_name: userData.name,
          surname: userData.surname,
          title,
          password: userData.password,
          phone_office: userData.phone_office || null,
          phone_mobile: userData.phone_mobile || null,
          organization_id: newOrg.id,
          is_main_user: userData.is_main_user,
          is_active: true,
          ...permissions,
        });

      if (orgUserError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create organization user: ${orgUserError.message}`);
      }

      // For individual signups: also insert a Billing User row referencing the same person
      if (create_billing_user_from_main && userData.is_main_user) {
        await supabase
          .from('organization_users')
          .insert({
            user_id: authData.user.id,
            email: userData.email,
            first_name: userData.name,
            surname: userData.surname,
            title: 'Billing User',
            phone_office: userData.phone_office || null,
            phone_mobile: userData.phone_mobile || null,
            organization_id: newOrg.id,
            is_main_user: false,
            is_active: true,
            ...permissions,
          });
        // Non-fatal: if billing row fails it won't block signup
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          organization_id: newOrg.id,
          full_name: `${userData.name} ${userData.surname}`,
          role: userData.role,
        });

      if (profileError) {
        await supabase.from('organization_users').delete().eq('user_id', authData.user.id);
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      createdUsers.push({ user_id: authData.user.id, email: userData.email });
    }

    return new Response(
      JSON.stringify({ success: true, organization_id: newOrg.id, users: createdUsers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('client-self-signup error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Signup failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
