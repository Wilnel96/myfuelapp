import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Plus, CreditCard as Edit2, Save, X, AlertCircle, CheckCircle, Search, Trash2 } from 'lucide-react';

interface ClientOrganization {
  id: string;
  name: string;
  company_registration_number: string | null;
  vat_number: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  phone_number: string | null;
  address: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  entity_type: string | null;
  entity_type_other: string | null;
  billing_email: string | null;
  website: string | null;
  status: string | null;
  month_end_day: number | null;
  year_end_month: number | null;
  year_end_day: number | null;
  monthly_fee_per_vehicle: number | null;
  parent_org_id: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  bank_account_type: string | null;
  bank_name_2: string | null;
  bank_account_holder_2: string | null;
  bank_account_number_2: string | null;
  bank_branch_code_2: string | null;
  bank_account_type_2: string | null;
}

interface FormData {
  name: string;
  entity_type: string;
  entity_type_other: string;
  company_registration_number: string;
  vat_number: string;
  contact_person: string;
  email: string;
  phone_number: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  billing_email: string;
  website: string;
  status: string;
  month_end_day: string;
  year_end_month: string;
  year_end_day: string;
  monthly_fee_per_vehicle: string;
  bank_name: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_account_type: string;
  bank_name_2: string;
  bank_account_holder_2: string;
  bank_account_number_2: string;
  bank_branch_code_2: string;
  bank_account_type_2: string;
  managing_user_email: string;
  managing_user_name: string;
  managing_user_surname: string;
  managing_user_password: string;
  managing_user_phone_office: string;
  managing_user_phone_mobile: string;
  admin_user_email: string;
  admin_user_name: string;
  admin_user_surname: string;
  admin_user_password: string;
  admin_user_phone_office: string;
  admin_user_phone_mobile: string;
  billing_user_email: string;
  billing_user_name: string;
  billing_user_surname: string;
  billing_user_password: string;
  billing_user_phone_office: string;
  billing_user_phone_mobile: string;
}

interface ExistingUser {
  id: string;
  email: string;
  name: string;
  surname: string;
  title: string;
  phone_office: string | null;
  phone_mobile: string | null;
  is_main_user: boolean;
  is_active: boolean;
  can_add_vehicles: boolean;
  can_edit_vehicles: boolean;
  can_delete_vehicles: boolean;
  can_add_drivers: boolean;
  can_edit_drivers: boolean;
  can_delete_drivers: boolean;
  can_view_reports: boolean;
  can_edit_organization_info: boolean;
  can_view_fuel_transactions: boolean;
  can_create_reports: boolean;
  can_view_custom_reports: boolean;
  can_manage_users: boolean;
  can_view_financial_data: boolean;
}

export default function ClientOrganizations() {
  const [organizations, setOrganizations] = useState<ClientOrganization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<ClientOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [managementOrgId, setManagementOrgId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewingPermissionsUserId, setViewingPermissionsUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    entity_type: '',
    entity_type_other: '',
    company_registration_number: '',
    vat_number: '',
    contact_person: '',
    email: '',
    phone_number: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'South Africa',
    billing_email: '',
    website: '',
    status: 'active',
    month_end_day: '25',
    year_end_month: '2',
    year_end_day: '28',
    monthly_fee_per_vehicle: '0.00',
    bank_name: '',
    bank_account_holder: '',
    bank_account_number: '',
    bank_branch_code: '',
    bank_account_type: 'cheque',
    bank_name_2: '',
    bank_account_holder_2: '',
    bank_account_number_2: '',
    bank_branch_code_2: '',
    bank_account_type_2: '',
    managing_user_email: '',
    managing_user_name: '',
    managing_user_surname: '',
    managing_user_password: '',
    managing_user_phone_office: '',
    managing_user_phone_mobile: '',
    admin_user_email: '',
    admin_user_name: '',
    admin_user_surname: '',
    admin_user_password: '',
    admin_user_phone_office: '',
    admin_user_phone_mobile: '',
    billing_user_email: '',
    billing_user_name: '',
    billing_user_surname: '',
    billing_user_password: '',
    billing_user_phone_office: '',
    billing_user_phone_mobile: ''
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredOrganizations(organizations);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = organizations.filter((org) =>
        org.name.toLowerCase().includes(term) ||
        (org.company_registration_number || '').toLowerCase().includes(term) ||
        (org.vat_number || '').toLowerCase().includes(term) ||
        (org.contact_person || '').toLowerCase().includes(term) ||
        (org.email || '').toLowerCase().includes(term) ||
        (org.phone_number || '').toLowerCase().includes(term)
      );
      setFilteredOrganizations(filtered);
    }
  }, [searchTerm, organizations]);

  const loadOrganizations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        setLoading(false);
        return;
      }

      console.log('Loading organizations for user:', user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }

      console.log('Profile:', profile);

      if (profile) {
        setManagementOrgId(profile.organization_id);

        // Management users see ALL client organizations (no parent link needed)
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('organization_type', 'client')
          .order('name');

        if (error) {
          console.error('Organizations error:', error);
          throw error;
        }

        console.log('Loaded organizations:', data);
        setOrganizations(data || []);
      }
    } catch (err) {
      console.error('Load organizations error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    console.log('Form submission started', { editingId, formData });

    try {
      const orgData = {
        name: formData.name,
        entity_type: formData.entity_type || null,
        entity_type_other: formData.entity_type === 'Other' ? (formData.entity_type_other || null) : null,
        company_registration_number: formData.company_registration_number || null,
        vat_number: formData.vat_number || null,
        address_line_1: formData.address_line_1 || null,
        address_line_2: formData.address_line_2 || null,
        city: formData.city || null,
        province: formData.province || null,
        postal_code: formData.postal_code || null,
        country: formData.country || null,
        website: formData.website || null,
        status: formData.status || 'active',
        month_end_day: formData.month_end_day ? parseInt(formData.month_end_day) : null,
        year_end_month: formData.year_end_month ? parseInt(formData.year_end_month) : null,
        year_end_day: formData.year_end_day ? parseInt(formData.year_end_day) : null,
        monthly_fee_per_vehicle: formData.monthly_fee_per_vehicle ? parseFloat(formData.monthly_fee_per_vehicle) : null,
        bank_name: formData.bank_name || null,
        bank_account_holder: formData.bank_account_holder || null,
        bank_account_number: formData.bank_account_number || null,
        bank_branch_code: formData.bank_branch_code || null,
        bank_account_type: formData.bank_account_type || null,
        bank_name_2: formData.bank_name_2 || null,
        bank_account_holder_2: formData.bank_account_holder_2 || null,
        bank_account_number_2: formData.bank_account_number_2 || null,
        bank_branch_code_2: formData.bank_branch_code_2 || null,
        bank_account_type_2: formData.bank_account_type_2 || null,
        organization_type: 'client',
        is_management_org: false
      };

      if (editingId) {
        const { error } = await supabase
          .from('organizations')
          .update(orgData)
          .eq('id', editingId);

        if (error) throw error;

        const usersToCreate = [];
        let hasUsers = false;

        const managingEmail = formData.managing_user_email?.trim();
        const managingPassword = formData.managing_user_password?.trim();
        if (managingEmail && managingPassword) {
          const emailExists = existingUsers.some(u => u.email.toLowerCase() === managingEmail.toLowerCase());
          if (emailExists) {
            throw new Error('A main user with this email already exists for this organization');
          }
          usersToCreate.push({
            email: managingEmail,
            password: managingPassword,
            name: formData.managing_user_name?.trim() || '',
            surname: formData.managing_user_surname?.trim() || '',
            phone_office: formData.managing_user_phone_office?.trim() || null,
            phone_mobile: formData.managing_user_phone_mobile?.trim() || null,
            is_main_user: true,
            role: 'main_user'
          });
          hasUsers = true;
        }

        const adminEmail = formData.admin_user_email?.trim();
        const adminPassword = formData.admin_user_password?.trim();
        if (adminEmail && adminPassword) {
          const emailExists = existingUsers.some(u => u.email.toLowerCase() === adminEmail.toLowerCase());
          if (emailExists) {
            throw new Error('An admin user with this email already exists for this organization');
          }
          usersToCreate.push({
            email: adminEmail,
            password: adminPassword,
            name: formData.admin_user_name?.trim() || '',
            surname: formData.admin_user_surname?.trim() || '',
            phone_office: formData.admin_user_phone_office?.trim() || null,
            phone_mobile: formData.admin_user_phone_mobile?.trim() || null,
            is_main_user: false,
            role: 'admin_user'
          });
          hasUsers = true;
        }

        const billingEmail = formData.billing_user_email?.trim();
        const billingPassword = formData.billing_user_password?.trim();
        if (billingEmail && billingPassword) {
          const emailExists = existingUsers.some(u => u.email.toLowerCase() === billingEmail.toLowerCase());
          if (emailExists) {
            throw new Error('A billing user with this email already exists for this organization');
          }
          usersToCreate.push({
            email: billingEmail,
            password: billingPassword,
            name: formData.billing_user_name?.trim() || '',
            surname: formData.billing_user_surname?.trim() || '',
            phone_office: formData.billing_user_phone_office?.trim() || null,
            phone_mobile: formData.billing_user_phone_mobile?.trim() || null,
            is_main_user: false,
            role: 'billing_user'
          });
          hasUsers = true;
        }

        if (hasUsers) {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          if (!token) {
            throw new Error('No authentication token available');
          }

          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization-users`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              organization_id: editingId,
              users: usersToCreate
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create users');
          }

          await loadExistingUsers(editingId);

          setFormData({
            ...formData,
            managing_user_email: '',
            managing_user_name: '',
            managing_user_surname: '',
            managing_user_password: '',
            managing_user_phone_office: '',
            managing_user_phone_mobile: '',
            admin_user_email: '',
            admin_user_name: '',
            admin_user_surname: '',
            admin_user_password: '',
            admin_user_phone_office: '',
            admin_user_phone_mobile: '',
            billing_user_email: '',
            billing_user_name: '',
            billing_user_surname: '',
            billing_user_password: '',
            billing_user_phone_office: '',
            billing_user_phone_mobile: ''
          });

          setSuccess(`Organization updated and ${usersToCreate.length} user(s) added successfully`);
          setTimeout(() => setSuccess(''), 5000);
        } else {
          setSuccess('Client organization updated successfully');
          setTimeout(() => setSuccess(''), 5000);
        }
      } else {
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert([orgData])
          .select()
          .single();

        if (orgError) throw orgError;

        const usersToCreate = [];

        if (formData.managing_user_email && formData.managing_user_password) {
          usersToCreate.push({
            email: formData.managing_user_email,
            password: formData.managing_user_password,
            name: formData.managing_user_name,
            surname: formData.managing_user_surname,
            phone_office: formData.managing_user_phone_office,
            phone_mobile: formData.managing_user_phone_mobile,
            is_main_user: true,
            role: 'managing_user'
          });
        }

        if (formData.admin_user_email && formData.admin_user_password) {
          usersToCreate.push({
            email: formData.admin_user_email,
            password: formData.admin_user_password,
            name: formData.admin_user_name,
            surname: formData.admin_user_surname,
            phone_office: formData.admin_user_phone_office,
            phone_mobile: formData.admin_user_phone_mobile,
            is_main_user: false,
            role: 'admin_user'
          });
        }

        if (formData.billing_user_email && formData.billing_user_password) {
          usersToCreate.push({
            email: formData.billing_user_email,
            password: formData.billing_user_password,
            name: formData.billing_user_name,
            surname: formData.billing_user_surname,
            phone_office: formData.billing_user_phone_office,
            phone_mobile: formData.billing_user_phone_mobile,
            is_main_user: false,
            role: 'billing_user'
          });
        }

        console.log('Users to create:', usersToCreate);

        if (usersToCreate.length > 0) {
          const { data: { session } } = await supabase.auth.getSession();

          if (!session) {
            throw new Error('Not authenticated');
          }

          console.log('Calling Edge Function to create users...');
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization-users`;

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              organization_id: newOrg.id,
              users: usersToCreate
            })
          });

          console.log('Edge Function response status:', response.status);

          if (!response.ok) {
            const error = await response.json();
            console.error('Edge Function error:', error);
            throw new Error(error.error || 'Failed to create users');
          }

          const result = await response.json();
          console.log('Users created successfully:', result);
        } else {
          console.warn('No users to create - form may not have user data');
        }

        setSuccess('Client organization and users created successfully');
        setTimeout(() => setSuccess(''), 5000);
      }

      await loadOrganizations();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save organization');
    }
  };

  const handleEdit = async (org: ClientOrganization) => {
    try {
      const { data: freshOrg, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', org.id)
        .maybeSingle();

      if (error) throw error;

      const orgToUse = freshOrg || org;

      setFormData({
        name: orgToUse.name,
        entity_type: orgToUse.entity_type || '',
        entity_type_other: orgToUse.entity_type_other || '',
        company_registration_number: orgToUse.company_registration_number || '',
        vat_number: orgToUse.vat_number || '',
        contact_person: orgToUse.contact_person || '',
        email: orgToUse.email || '',
        phone_number: orgToUse.phone_number || '',
        address_line_1: orgToUse.address_line_1 || '',
        address_line_2: orgToUse.address_line_2 || '',
        city: orgToUse.city || '',
        province: orgToUse.province || '',
        postal_code: orgToUse.postal_code || '',
        country: orgToUse.country || 'South Africa',
        billing_email: orgToUse.billing_email || '',
        website: orgToUse.website || '',
        status: orgToUse.status || 'active',
        month_end_day: orgToUse.month_end_day?.toString() || '25',
        year_end_month: orgToUse.year_end_month?.toString() || '2',
        year_end_day: orgToUse.year_end_day?.toString() || '28',
        monthly_fee_per_vehicle: orgToUse.monthly_fee_per_vehicle?.toString() || '0.00',
        bank_name: orgToUse.bank_name || '',
        bank_account_holder: orgToUse.bank_account_holder || '',
        bank_account_number: orgToUse.bank_account_number || '',
        bank_branch_code: orgToUse.bank_branch_code || '',
        bank_account_type: orgToUse.bank_account_type || 'cheque',
        bank_name_2: orgToUse.bank_name_2 || '',
        bank_account_holder_2: orgToUse.bank_account_holder_2 || '',
        bank_account_number_2: orgToUse.bank_account_number_2 || '',
        bank_branch_code_2: orgToUse.bank_branch_code_2 || '',
        bank_account_type_2: orgToUse.bank_account_type_2 || '',
        managing_user_email: '',
        managing_user_name: '',
        managing_user_surname: '',
        managing_user_password: '',
        managing_user_phone_office: '',
        managing_user_phone_mobile: '',
        admin_user_email: '',
        admin_user_name: '',
        admin_user_surname: '',
        admin_user_password: '',
        admin_user_phone_office: '',
        admin_user_phone_mobile: '',
        billing_user_email: '',
        billing_user_name: '',
        billing_user_surname: '',
        billing_user_password: '',
        billing_user_phone_office: '',
        billing_user_phone_mobile: ''
      });
      setEditingId(org.id);

      await loadExistingUsers(org.id);
    } catch (err) {
      console.error('Error loading organization:', err);
      setError('Failed to load organization data');
    }

    setShowForm(true);
  };

  const loadExistingUsers = async (orgId: string) => {
    setLoadingUsers(true);
    setError('');

    const timeoutId = setTimeout(() => {
      setLoadingUsers(false);
      setError('Loading users timed out. Please check your connection and try again.');
    }, 10000);

    try {
      console.log('=== Loading existing users for organization:', orgId);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Auth error:', userError);
        throw new Error(`Authentication error: ${userError.message}`);
      }
      if (!user) {
        throw new Error('No authenticated user found. Please log in again.');
      }
      console.log('✓ Current user:', user.id, user.email);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile error:', profileError);
        throw new Error(`Failed to load profile: ${profileError.message}`);
      }
      console.log('✓ User profile:', profile);

      const { data, error } = await supabase
        .from('organization_users')
        .select('*')
        .eq('organization_id', orgId)
        .order('is_main_user', { ascending: false })
        .order('name');

      if (error) {
        console.error('Error loading users:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      console.log('✓ Loaded users count:', data?.length || 0);
      console.log('✓ Users data:', data);

      clearTimeout(timeoutId);
      setExistingUsers(data || []);

      if (!data || data.length === 0) {
        console.warn('No users found for this organization. This may be expected for newly created organizations.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('✗ Failed to load existing users:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load existing users: ${errorMessage}`);
      setExistingUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      company_registration_number: '',
      vat_number: '',
      contact_person: '',
      email: '',
      phone_number: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      province: '',
      postal_code: '',
      country: 'South Africa',
      billing_email: '',
      website: '',
      status: 'active',
      month_end_day: '25',
      year_end_month: '2',
      year_end_day: '28',
      monthly_fee_per_vehicle: '0.00',
      managing_user_email: '',
      managing_user_name: '',
      managing_user_surname: '',
      managing_user_password: '',
      managing_user_phone_office: '',
      managing_user_phone_mobile: '',
      admin_user_email: '',
      admin_user_name: '',
      admin_user_surname: '',
      admin_user_password: '',
      admin_user_phone_office: '',
      admin_user_phone_mobile: '',
      billing_user_email: '',
      billing_user_name: '',
      billing_user_surname: '',
      billing_user_password: '',
      billing_user_phone_office: '',
      billing_user_phone_mobile: '',
      bank_name: '',
      bank_account_holder: '',
      bank_account_number: '',
      bank_branch_code: '',
      bank_account_type: 'cheque',
      bank_name_2: '',
      bank_account_holder_2: '',
      bank_account_number_2: '',
      bank_branch_code_2: '',
      bank_account_type_2: ''
    });
    setEditingId(null);
    setExistingUsers([]);
    setShowForm(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Organizations</h1>
          <p className="text-gray-600">Manage client organizations using the system</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Client Organization
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{success}</span>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {editingId ? 'Edit Client Organization' : 'New Client Organization'}
            </h2>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-5 h-5" />
                {editingId ? 'Update Organization' : 'Create Organization'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Registration Number
                  </label>
                  <input
                    type="text"
                    value={formData.company_registration_number}
                    onChange={(e) => setFormData({ ...formData, company_registration_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entity Type
                  </label>
                  <select
                    value={formData.entity_type}
                    onChange={(e) => setFormData({ ...formData, entity_type: e.target.value, entity_type_other: '' })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select --</option>
                    <option value="Company">Company</option>
                    <option value="Closed Corporation">Closed Corporation</option>
                    <option value="Trust">Trust</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {formData.entity_type === 'Other' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Please Specify
                    </label>
                    <input
                      type="text"
                      value={formData.entity_type_other}
                      onChange={(e) => setFormData({ ...formData, entity_type_other: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Non-profit Organisation"
                    />
                  </div>
                ) : <div />}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    VAT Number
                  </label>
                  <input
                    type="text"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Fee Per Vehicle (ZAR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthly_fee_per_vehicle}
                  onChange={(e) => setFormData({ ...formData, monthly_fee_per_vehicle: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Address Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={formData.address_line_1}
                    onChange={(e) => setFormData({ ...formData, address_line_1: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={formData.address_line_2}
                    onChange={(e) => setFormData({ ...formData, address_line_2: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Province
                  </label>
                  <select
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Province</option>
                    <option value="Eastern Cape">Eastern Cape</option>
                    <option value="Free State">Free State</option>
                    <option value="Gauteng">Gauteng</option>
                    <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                    <option value="Limpopo">Limpopo</option>
                    <option value="Mpumalanga">Mpumalanga</option>
                    <option value="Northern Cape">Northern Cape</option>
                    <option value="North West">North West</option>
                    <option value="Western Cape">Western Cape</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingId ? 'Organization Users' : 'User Accounts (Required for New Organization)'}
              </h3>
              {editingId ? (
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600">View existing users below. Clients can manage their own users (add, edit, delete, set permissions) through their User Management section in the Back Office.</p>
                  <p className="text-sm text-blue-600 font-medium">Note: To add users with custom permissions, the client organization should use their User Management interface.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mb-4">Create user accounts for managing this organization. At least one user is required.</p>
              )}

              {editingId && (
                <div className="mb-6 bg-gray-50 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Existing Users</h4>
                    <button
                      onClick={() => loadExistingUsers(editingId)}
                      className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Refresh Users
                    </button>
                  </div>
                  {loadingUsers ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                      <p className="text-gray-600 mt-2">Loading users...</p>
                    </div>
                  ) : existingUsers.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800 mb-2">No users found for this organization</p>
                          <p className="text-xs text-yellow-700 mb-3">
                            If you recently updated the system or just logged in, please log out and log back in to refresh your session.
                            Session settings have been updated and require a fresh login.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadExistingUsers(editingId)}
                              className="text-xs px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                            >
                              Try Again
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-2">
                    {existingUsers.map((user) => (
                      <div key={user.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <button
                          onClick={() => setViewingUserId(viewingUserId === user.id ? null : user.id)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300 rounded">{user.title}</span>
                            <span className="text-sm font-medium text-gray-900">{user.first_name} {user.surname}</span>
                            {user.is_active ? (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Inactive</span>
                            )}
                          </div>
                          <span className="text-gray-400">{viewingUserId === user.id ? '▼' : '▶'}</span>
                        </button>

                        {viewingUserId === user.id && (
                          <div className="border-t border-gray-200 p-6">
                            <div className="space-y-4">
                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                  <input
                                    type="email"
                                    value={user.email}
                                    disabled
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                  <input
                                    type="text"
                                    value="••••••••"
                                    disabled
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                                    placeholder="••••••••"
                                  />
                                </div>
                              </div>

                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                  <input
                                    type="text"
                                    value={user.first_name}
                                    disabled
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
                                  <input
                                    type="text"
                                    value={user.surname}
                                    disabled
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                                  />
                                </div>
                              </div>

                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Tel No-Office</label>
                                  <input
                                    type="tel"
                                    value={user.phone_office || ''}
                                    disabled
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                                    placeholder="e.g., 021 123 4567"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Tel No-Mobile</label>
                                  <input
                                    type="tel"
                                    value={user.phone_mobile || ''}
                                    disabled
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                                    placeholder="e.g., 082 123 4567"
                                  />
                                </div>
                              </div>

                              <div className="pt-4 border-t border-gray-200">
                                <button
                                  onClick={() => setViewingPermissionsUserId(viewingPermissionsUserId === user.id ? null : user.id)}
                                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                  {viewingPermissionsUserId === user.id ? 'Hide Permissions' : 'View Permissions'}
                                </button>
                              </div>

                              {viewingPermissionsUserId === user.id && (
                                <div className="pt-4">
                                  {user.is_main_user ? (
                                    <div className="text-sm text-green-600 font-medium text-center py-4">
                                      All Permissions Granted (Main User)
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <div className="border border-gray-200 rounded-lg p-3">
                                        <h5 className="text-sm font-semibold text-gray-800 mb-2">Organization Management</h5>
                                        <div className="grid md:grid-cols-2 gap-2">
                                          <div className={`text-sm ${user.can_edit_organization_info ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_edit_organization_info ? '✓' : '✗'} Can Edit Organization Info
                                          </div>
                                          <div className={`text-sm ${user.can_manage_users ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_manage_users ? '✓' : '✗'} Can Manage Users
                                          </div>
                                        </div>
                                      </div>

                                      <div className="border border-gray-200 rounded-lg p-3">
                                        <h5 className="text-sm font-semibold text-gray-800 mb-2">Vehicle Management</h5>
                                        <div className="grid md:grid-cols-2 gap-2">
                                          <div className={`text-sm ${user.can_add_vehicles ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_add_vehicles ? '✓' : '✗'} Can Add Vehicles
                                          </div>
                                          <div className={`text-sm ${user.can_edit_vehicles ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_edit_vehicles ? '✓' : '✗'} Can Edit Vehicles
                                          </div>
                                          <div className={`text-sm ${user.can_delete_vehicles ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_delete_vehicles ? '✓' : '✗'} Can Delete Vehicles
                                          </div>
                                        </div>
                                      </div>

                                      <div className="border border-gray-200 rounded-lg p-3">
                                        <h5 className="text-sm font-semibold text-gray-800 mb-2">Driver Management</h5>
                                        <div className="grid md:grid-cols-2 gap-2">
                                          <div className={`text-sm ${user.can_add_drivers ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_add_drivers ? '✓' : '✗'} Can Add Drivers
                                          </div>
                                          <div className={`text-sm ${user.can_edit_drivers ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_edit_drivers ? '✓' : '✗'} Can Edit Drivers
                                          </div>
                                          <div className={`text-sm ${user.can_delete_drivers ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_delete_drivers ? '✓' : '✗'} Can Delete Drivers
                                          </div>
                                        </div>
                                      </div>

                                      <div className="border border-gray-200 rounded-lg p-3">
                                        <h5 className="text-sm font-semibold text-gray-800 mb-2">Fuel Transactions</h5>
                                        <div className="grid md:grid-cols-2 gap-2">
                                          <div className={`text-sm ${user.can_view_fuel_transactions ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_view_fuel_transactions ? '✓' : '✗'} Can View Fuel Transactions
                                          </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 italic">Note: Fuel transactions are created only by drivers via the mobile app and cannot be edited or deleted by anyone to maintain data integrity</p>
                                      </div>

                                      <div className="border border-gray-200 rounded-lg p-3">
                                        <h5 className="text-sm font-semibold text-gray-800 mb-2">Reports & Data</h5>
                                        <div className="grid md:grid-cols-2 gap-2">
                                          <div className={`text-sm ${user.can_view_reports ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_view_reports ? '✓' : '✗'} Can View Reports
                                          </div>
                                          <div className={`text-sm ${user.can_create_reports ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_create_reports ? '✓' : '✗'} Can Create Reports
                                          </div>
                                          <div className={`text-sm ${user.can_view_custom_reports ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_view_custom_reports ? '✓' : '✗'} Can View Custom Reports
                                          </div>
                                          <div className={`text-sm ${user.can_view_financial_data ? 'text-green-600' : 'text-gray-400'}`}>
                                            {user.can_view_financial_data ? '✓' : '✗'} Can View Financial Data
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}

              {!editingId && (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Main User (Contact Person) *</h4>
                    <p className="text-xs text-gray-600 mb-3">Full access to all organization features and settings</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          required={!editingId}
                          value={formData.managing_user_name}
                          onChange={(e) => setFormData({ ...formData, managing_user_name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Surname *
                        </label>
                        <input
                          type="text"
                          required={!editingId}
                          value={formData.managing_user_surname}
                          onChange={(e) => setFormData({ ...formData, managing_user_surname: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required={!editingId}
                          value={formData.managing_user_email}
                          onChange={(e) => setFormData({ ...formData, managing_user_email: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          required={!editingId}
                          minLength={6}
                          value={formData.managing_user_password}
                          onChange={(e) => setFormData({ ...formData, managing_user_password: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Min. 6 characters"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Office
                        </label>
                        <input
                          type="tel"
                          value={formData.managing_user_phone_office}
                          onChange={(e) => setFormData({ ...formData, managing_user_phone_office: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 021 123 4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Mobile
                        </label>
                        <input
                          type="tel"
                          value={formData.managing_user_phone_mobile}
                          onChange={(e) => setFormData({ ...formData, managing_user_phone_mobile: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 082 123 4567"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Admin User (Optional)</h4>
                    <p className="text-xs text-gray-600 mb-3">Can manage vehicles, drivers, and view reports</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={formData.admin_user_name}
                          onChange={(e) => setFormData({ ...formData, admin_user_name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Surname
                        </label>
                        <input
                          type="text"
                          value={formData.admin_user_surname}
                          onChange={(e) => setFormData({ ...formData, admin_user_surname: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={formData.admin_user_email}
                          onChange={(e) => setFormData({ ...formData, admin_user_email: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          minLength={6}
                          value={formData.admin_user_password}
                          onChange={(e) => setFormData({ ...formData, admin_user_password: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Min. 6 characters"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Office
                        </label>
                        <input
                          type="tel"
                          value={formData.admin_user_phone_office}
                          onChange={(e) => setFormData({ ...formData, admin_user_phone_office: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 021 123 4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Mobile
                        </label>
                        <input
                          type="tel"
                          value={formData.admin_user_phone_mobile}
                          onChange={(e) => setFormData({ ...formData, admin_user_phone_mobile: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 082 123 4567"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Billing User (Optional)</h4>
                    <p className="text-xs text-gray-600 mb-3">Can access billing information and financial reports</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={formData.billing_user_name}
                          onChange={(e) => setFormData({ ...formData, billing_user_name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Surname
                        </label>
                        <input
                          type="text"
                          value={formData.billing_user_surname}
                          onChange={(e) => setFormData({ ...formData, billing_user_surname: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={formData.billing_user_email}
                          onChange={(e) => setFormData({ ...formData, billing_user_email: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          minLength={6}
                          value={formData.billing_user_password}
                          onChange={(e) => setFormData({ ...formData, billing_user_password: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Min. 6 characters"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Office
                        </label>
                        <input
                          type="tel"
                          value={formData.billing_user_phone_office}
                          onChange={(e) => setFormData({ ...formData, billing_user_phone_office: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 021 123 4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Mobile
                        </label>
                        <input
                          type="tel"
                          value={formData.billing_user_phone_mobile}
                          onChange={(e) => setFormData({ ...formData, billing_user_phone_mobile: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 082 123 4567"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {editingId && (
                <div className="space-y-6">
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-300 mb-6">
                    <p className="text-sm font-medium text-yellow-900">
                      ℹ️ Existing users are displayed above. Use the fields below ONLY to add NEW users to this organization.
                      Leave fields empty if you don't want to add new users.
                    </p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Add Main User (Contact Person)</h4>
                    <p className="text-xs text-gray-600 mb-3">Full access to all organization features and settings</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={formData.managing_user_name}
                          onChange={(e) => setFormData({ ...formData, managing_user_name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Surname
                        </label>
                        <input
                          type="text"
                          value={formData.managing_user_surname}
                          onChange={(e) => setFormData({ ...formData, managing_user_surname: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={formData.managing_user_email}
                          onChange={(e) => setFormData({ ...formData, managing_user_email: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          minLength={6}
                          value={formData.managing_user_password}
                          onChange={(e) => setFormData({ ...formData, managing_user_password: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Min. 6 characters"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Office
                        </label>
                        <input
                          type="tel"
                          value={formData.managing_user_phone_office}
                          onChange={(e) => setFormData({ ...formData, managing_user_phone_office: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 021 123 4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Mobile
                        </label>
                        <input
                          type="tel"
                          value={formData.managing_user_phone_mobile}
                          onChange={(e) => setFormData({ ...formData, managing_user_phone_mobile: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 082 123 4567"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Add Admin User</h4>
                    <p className="text-xs text-gray-600 mb-3">Can manage vehicles, drivers, and view reports</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={formData.admin_user_name}
                          onChange={(e) => setFormData({ ...formData, admin_user_name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Surname
                        </label>
                        <input
                          type="text"
                          value={formData.admin_user_surname}
                          onChange={(e) => setFormData({ ...formData, admin_user_surname: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={formData.admin_user_email}
                          onChange={(e) => setFormData({ ...formData, admin_user_email: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          minLength={6}
                          value={formData.admin_user_password}
                          onChange={(e) => setFormData({ ...formData, admin_user_password: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Min. 6 characters"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Office
                        </label>
                        <input
                          type="tel"
                          value={formData.admin_user_phone_office}
                          onChange={(e) => setFormData({ ...formData, admin_user_phone_office: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 021 123 4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Mobile
                        </label>
                        <input
                          type="tel"
                          value={formData.admin_user_phone_mobile}
                          onChange={(e) => setFormData({ ...formData, admin_user_phone_mobile: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 082 123 4567"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Add Billing User</h4>
                    <p className="text-xs text-gray-600 mb-3">Can access billing information and financial reports</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={formData.billing_user_name}
                          onChange={(e) => setFormData({ ...formData, billing_user_name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Surname
                        </label>
                        <input
                          type="text"
                          value={formData.billing_user_surname}
                          onChange={(e) => setFormData({ ...formData, billing_user_surname: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={formData.billing_user_email}
                          onChange={(e) => setFormData({ ...formData, billing_user_email: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          minLength={6}
                          value={formData.billing_user_password}
                          onChange={(e) => setFormData({ ...formData, billing_user_password: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Min. 6 characters"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Office
                        </label>
                        <input
                          type="tel"
                          value={formData.billing_user_phone_office}
                          onChange={(e) => setFormData({ ...formData, billing_user_phone_office: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 021 123 4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tel No-Mobile
                        </label>
                        <input
                          type="tel"
                          value={formData.billing_user_phone_mobile}
                          onChange={(e) => setFormData({ ...formData, billing_user_phone_mobile: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., 082 123 4567"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Year Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Month End Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.month_end_day}
                    onChange={(e) => setFormData({ ...formData, month_end_day: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year End Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={formData.year_end_month}
                    onChange={(e) => setFormData({ ...formData, year_end_month: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year End Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.year_end_day}
                    onChange={(e) => setFormData({ ...formData, year_end_day: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Details for Debit Orders</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Standard Bank, FNB, ABSA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={formData.bank_account_holder}
                    onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch Code
                  </label>
                  <input
                    type="text"
                    value={formData.bank_branch_code}
                    onChange={(e) => setFormData({ ...formData, bank_branch_code: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Type
                  </label>
                  <select
                    value={formData.bank_account_type}
                    onChange={(e) => setFormData({ ...formData, bank_account_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cheque">Current Account</option>
                    <option value="savings">Savings</option>
                    <option value="current">Current</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Secondary Bank Account (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={formData.bank_name_2}
                    onChange={(e) => setFormData({ ...formData, bank_name_2: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Standard Bank, FNB, ABSA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={formData.bank_account_holder_2}
                    onChange={(e) => setFormData({ ...formData, bank_account_holder_2: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.bank_account_number_2}
                    onChange={(e) => setFormData({ ...formData, bank_account_number_2: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch Code
                  </label>
                  <input
                    type="text"
                    value={formData.bank_branch_code_2}
                    onChange={(e) => setFormData({ ...formData, bank_branch_code_2: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Type
                  </label>
                  <select
                    value={formData.bank_account_type_2}
                    onChange={(e) => setFormData({ ...formData, bank_account_type_2: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select type...</option>
                    <option value="cheque">Current Account</option>
                    <option value="savings">Savings</option>
                    <option value="current">Current</option>
                  </select>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, registration, VAT, contact, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Organization Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registration Number
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrganizations.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  {searchTerm ? 'No organizations match your search.' : 'No client organizations yet. Click "Add Client Organization" to get started.'}
                </td>
              </tr>
            ) : (
              filteredOrganizations.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      <div className="font-medium text-gray-900">{org.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {org.company_registration_number || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(org)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
