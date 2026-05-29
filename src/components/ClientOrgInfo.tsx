import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, CreditCard as Edit2, Save, X, AlertCircle, CheckCircle, Search, ArrowLeft, Copy } from 'lucide-react';

interface ClientOrganization {
  id: string;
  name: string;
  company_registration_number: string | null;
  vat_number: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  entity_type: string | null;
  entity_type_other: string | null;
  website: string | null;
  status: string | null;
  payment_option: string | null;
  fuel_payment_terms: string | null;
  fuel_payment_interest_rate: number | null;
  phone_number: string | null;
  main_user_name?: string | null;
  main_user_surname?: string | null;
  main_user_email?: string | null;
  main_user_phone_office?: string | null;
  main_user_phone_mobile?: string | null;
  billing_user_name?: string | null;
  billing_user_surname?: string | null;
  billing_user_email?: string | null;
  billing_user_phone_office?: string | null;
  billing_user_phone_mobile?: string | null;
}

interface ClientOrgInfoProps {
  onNavigate?: (view: string) => void;
  /** When true, loads only the logged-in user's own organisation instead of the full list */
  clientSelfMode?: boolean;
}

export default function ClientOrgInfo({ onNavigate, clientSelfMode = false }: ClientOrgInfoProps) {
  const [organizations, setOrganizations] = useState<ClientOrganization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<ClientOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editForm, setEditForm] = useState<Partial<ClientOrganization>>({});
  const [cardConfigured, setCardConfigured] = useState<Record<string, boolean>>({});
  const [canEdit, setCanEdit] = useState(!clientSelfMode);

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
        (org.billing_user_email || '').toLowerCase().includes(term) ||
        (org.billing_user_name || '').toLowerCase().includes(term) ||
        (org.billing_user_surname || '').toLowerCase().includes(term)
      );
      setFilteredOrganizations(filtered);
    }
  }, [searchTerm, organizations]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);

      let query = supabase.from('organizations').select('*');

      if (clientSelfMode) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const { data: profile } = await supabase
          .from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        if (!profile?.organization_id) throw new Error('No organisation found for your account');
        query = query.eq('id', profile.organization_id);
      } else {
        query = query
          .eq('organization_type', 'client')
          .neq('name', 'My Organization')
          .neq('name', 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD')
          .order('name');
      }

      const { data: orgs, error: orgsError } = await query;

      if (orgsError) throw orgsError;

      // Fetch main user and billing user info for each organization
      const orgsWithUsers = await Promise.all((orgs || []).map(async (org) => {
        const { data: mainUser } = await supabase
          .from('organization_users')
          .select('first_name, surname, email, phone_office, phone_mobile')
          .eq('organization_id', org.id)
          .eq('is_main_user', true)
          .maybeSingle();

        const { data: billingUser } = await supabase
          .from('organization_users')
          .select('first_name, surname, email, phone_office, phone_mobile')
          .eq('organization_id', org.id)
          .eq('title', 'Billing User')
          .maybeSingle();

        return {
          ...org,
          main_user_name: mainUser?.first_name || null,
          main_user_surname: mainUser?.surname || null,
          main_user_email: mainUser?.email || null,
          main_user_phone_office: mainUser?.phone_office || null,
          main_user_phone_mobile: mainUser?.phone_mobile || null,
          billing_user_name: billingUser?.first_name || null,
          billing_user_surname: billingUser?.surname || null,
          billing_user_email: billingUser?.email || null,
          billing_user_phone_office: billingUser?.phone_office || null,
          billing_user_phone_mobile: billingUser?.phone_mobile || null,
        };
      }));

      setOrganizations(orgsWithUsers);
      setFilteredOrganizations(orgsWithUsers);

      // In clientSelfMode, automatically open the single org for viewing
      if (clientSelfMode && orgsWithUsers.length === 1) {
        setViewingId(orgsWithUsers[0].id);

        // Check if the user can edit
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: orgUser } = await supabase
            .from('organization_users')
            .select('is_main_user, is_secondary_main_user, can_edit_organization_info')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();
          const full = orgUser?.is_main_user || orgUser?.is_secondary_main_user || false;
          setCanEdit(full || orgUser?.can_edit_organization_info || false);
        }
      }

      // Check card configuration for organizations with Card Payment option
      if (orgs) {
        const cardPaymentOrgs = orgs.filter((org: ClientOrganization) => org.payment_option === 'Card Payment');
        const cardStatuses: Record<string, boolean> = {};

        for (const org of cardPaymentOrgs) {
          const { data: cards } = await supabase
            .from('organization_payment_cards')
            .select('id')
            .eq('organization_id', org.id)
            .eq('is_active', true)
            .limit(1);

          cardStatuses[org.id] = (cards && cards.length > 0) || false;
        }

        setCardConfigured(cardStatuses);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (orgId: string) => {
    if (viewingId === orgId) {
      setViewingId(null);
    } else {
      setViewingId(orgId);
      setEditingId(null);
    }
  };

  const handleEdit = (org: ClientOrganization) => {
    setEditingId(org.id);
    setViewingId(org.id);
    setEditForm(org);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!editingId) return;

    try {
      setError('');

      // Update organization details
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: editForm.name,
          entity_type: editForm.entity_type || null,
          entity_type_other: editForm.entity_type === 'Other' ? (editForm.entity_type_other || null) : null,
          company_registration_number: editForm.company_registration_number,
          vat_number: editForm.vat_number,
          address_line_1: editForm.address_line_1,
          address_line_2: editForm.address_line_2,
          city: editForm.city,
          province: editForm.province,
          postal_code: editForm.postal_code,
          country: editForm.country,
          website: editForm.website,
          status: editForm.status,
          payment_option: editForm.payment_option || null,
          fuel_payment_terms: null,
          fuel_payment_interest_rate: null,
          phone_number: editForm.phone_number,
        })
        .eq('id', editingId);

      if (updateError) throw updateError;

      // Update main user information in organization_users table
      const { error: mainUserError } = await supabase
        .from('organization_users')
        .update({
          first_name: editForm.main_user_name,
          surname: editForm.main_user_surname,
          phone_office: editForm.main_user_phone_office || null,
          phone_mobile: editForm.main_user_phone_mobile || null,
        })
        .eq('organization_id', editingId)
        .eq('is_main_user', true);

      if (mainUserError) throw mainUserError;

      // Update billing user information in organization_users table
      const { error: billingUserError } = await supabase
        .from('organization_users')
        .update({
          first_name: editForm.billing_user_name,
          surname: editForm.billing_user_surname,
          phone_office: editForm.billing_user_phone_office || null,
          phone_mobile: editForm.billing_user_phone_mobile || null,
        })
        .eq('organization_id', editingId)
        .eq('title', 'Billing User');

      if (billingUserError) throw billingUserError;

      setSuccess('Organization, main user, and billing user updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      const savedId = editingId;
      setEditingId(null);
      setEditForm({});
      await loadOrganizations();
      setViewingId(savedId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading organizations...</div>;
  }

  return (
    <div className="-my-6">
      <div className="sticky top-0 z-30 bg-white -mx-4 px-4 py-3 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              {editingId ? 'Edit Client Organization Info' : 'Client Organization Info'}
            </h2>
          </div>
          {editingId ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors font-medium"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          ) : (
            onNavigate && (
              <button
                onClick={() => onNavigate('client-organizations-menu')}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Menu
              </button>
            )
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-red-800 text-sm">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-green-800 text-sm">{success}</div>
        </div>
      )}

      {!clientSelfMode && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      <div className="space-y-2">
        {filteredOrganizations.map((org) => {
          if (editingId && editingId !== org.id) return null;
          const isExpanded = viewingId === org.id || editingId === org.id;

          return (
          <div key={org.id} className="bg-white border border-gray-200 rounded-lg p-3">
            {editingId === org.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      {editForm.entity_type === 'Individual' ? 'Full Name' : 'Organization Name'}
                    </label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Entity Type</label>
                    <select
                      value={editForm.entity_type || ''}
                      onChange={(e) => setEditForm({ ...editForm, entity_type: e.target.value, entity_type_other: '' })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    >
                      <option value="">-- Select --</option>
                      <option value="Individual">Individual</option>
                      <option value="Company">Company</option>
                      <option value="Closed Corporation">Closed Corporation</option>
                      <option value="Trust">Trust</option>
                      <option value="Partnership">Partnership</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {editForm.entity_type === 'Other' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Please Specify</label>
                      <input
                        type="text"
                        value={editForm.entity_type_other || ''}
                        onChange={(e) => setEditForm({ ...editForm, entity_type_other: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                        placeholder="e.g., Non-profit Organisation"
                      />
                    </div>
                  )}
                  {editForm.entity_type !== 'Individual' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Registration Number</label>
                      <input
                        type="text"
                        value={editForm.company_registration_number || ''}
                        onChange={(e) => setEditForm({ ...editForm, company_registration_number: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  )}
                  {editForm.entity_type !== 'Individual' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">VAT Number</label>
                      <input
                        type="text"
                        value={editForm.vat_number || ''}
                        onChange={(e) => setEditForm({ ...editForm, vat_number: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Website</label>
                    <input
                      type="url"
                      value={editForm.website || ''}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 1</label>
                    <input
                      type="text"
                      value={editForm.address_line_1 || ''}
                      onChange={(e) => setEditForm({ ...editForm, address_line_1: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Address Line 2</label>
                    <input
                      type="text"
                      value={editForm.address_line_2 || ''}
                      onChange={(e) => setEditForm({ ...editForm, address_line_2: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">City</label>
                    <input
                      type="text"
                      value={editForm.city || ''}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Province</label>
                    <select
                      value={editForm.province || ''}
                      onChange={(e) => setEditForm({ ...editForm, province: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
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
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Postal Code</label>
                    <input
                      type="text"
                      value={editForm.postal_code || ''}
                      onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Country</label>
                    <input
                      type="text"
                      value={editForm.country || ''}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      placeholder="South Africa"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Status</label>
                    <select
                      value={editForm.status || 'active'}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-2 mt-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Main User / Contact Person</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">First Name</label>
                      <input
                        type="text"
                        value={editForm.main_user_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, main_user_name: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Surname</label>
                      <input
                        type="text"
                        value={editForm.main_user_surname || ''}
                        onChange={(e) => setEditForm({ ...editForm, main_user_surname: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Email Address</label>
                      <input
                        type="email"
                        value={editForm.main_user_email || ''}
                        onChange={(e) => setEditForm({ ...editForm, main_user_email: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                        placeholder="main@example.com"
                        disabled
                      />
                      <p className="text-xs text-gray-500 mt-0.5">Email cannot be changed</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Mobile Phone</label>
                      <input
                        type="text"
                        value={editForm.main_user_phone_mobile || ''}
                        onChange={(e) => setEditForm({ ...editForm, main_user_phone_mobile: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Office Phone</label>
                      <input
                        type="text"
                        value={editForm.main_user_phone_office || ''}
                        onChange={(e) => setEditForm({ ...editForm, main_user_phone_office: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-2 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">Billing User</h4>
                    <button
                      type="button"
                      onClick={() => setEditForm({
                        ...editForm,
                        billing_user_name: editForm.main_user_name,
                        billing_user_surname: editForm.main_user_surname,
                        billing_user_phone_mobile: editForm.main_user_phone_mobile,
                        billing_user_phone_office: editForm.main_user_phone_office,
                      })}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Same as Main User
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">First Name</label>
                      <input
                        type="text"
                        value={editForm.billing_user_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, billing_user_name: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Surname</label>
                      <input
                        type="text"
                        value={editForm.billing_user_surname || ''}
                        onChange={(e) => setEditForm({ ...editForm, billing_user_surname: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Email Address</label>
                      <input
                        type="email"
                        value={editForm.billing_user_email || ''}
                        onChange={(e) => setEditForm({ ...editForm, billing_user_email: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                        placeholder="billing@example.com"
                        disabled
                      />
                      <p className="text-xs text-gray-500 mt-0.5">Email cannot be changed</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Mobile Phone</label>
                      <input
                        type="text"
                        value={editForm.billing_user_phone_mobile || ''}
                        onChange={(e) => setEditForm({ ...editForm, billing_user_phone_mobile: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Office Phone</label>
                      <input
                        type="text"
                        value={editForm.billing_user_phone_office || ''}
                        onChange={(e) => setEditForm({ ...editForm, billing_user_phone_office: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-2 mt-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Payment Configuration</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Fuel Payment Option</label>
                      <select
                        value={editForm.payment_option || ''}
                        onChange={(e) => setEditForm({
                          ...editForm,
                          payment_option: e.target.value,
                          fuel_payment_terms: null,
                          fuel_payment_interest_rate: null,
                        })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      >
                        <option value="">-- Select --</option>
                        <option value="Card Payment">Credit/Debit Card Payment</option>
                        <option value="Local Account">Local Account</option>
                      </select>
                    </div>

                    {editForm.payment_option === 'Card Payment' && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <p className="text-xs text-blue-900 font-medium">
                          Client uses their own debit/credit card to pay for fuel purchases directly.
                        </p>
                      </div>
                    )}

                    {editForm.payment_option === 'Local Account' && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2">
                        <p className="text-xs text-amber-900 font-medium">
                          Client makes their own arrangements with the garage and pays the garage directly as agreed between client and garage.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div
                  className="flex items-start justify-between"
                >
                  <div
                    onClick={() => handleView(org.id)}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{org.name}</h3>
                      {org.entity_type && (
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                          org.entity_type === 'Individual'
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {org.entity_type}
                        </span>
                      )}
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                          org.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {org.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      {org.payment_option && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          org.payment_option === 'Card Payment' ? 'bg-blue-100 text-blue-800' :
                          org.payment_option === 'Local Account' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {org.payment_option === 'Card Payment' ? 'Credit/Debit Card' : org.payment_option}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {org.entity_type === 'Individual'
                        ? `Individual Account`
                        : `Reg No: ${org.company_registration_number || 'N/A'}`}
                      {!org.payment_option && <span className="text-red-600 font-medium ml-2">⚠ Payment not configured</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      onClick={() => handleView(org.id)}
                      className="text-xs text-blue-600 cursor-pointer"
                    >
                      {isExpanded ? 'Click to collapse' : 'Click to view details'}
                    </span>
                    {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(org);
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">
                          {org.entity_type === 'Individual' ? 'Full Name' : 'Organization Name'}
                        </label>
                        <p className="text-gray-900">{org.name}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Entity Type</label>
                        <p className="text-gray-900">
                          {org.entity_type
                            ? org.entity_type === 'Other'
                              ? `Other${org.entity_type_other ? ` — ${org.entity_type_other}` : ''}`
                              : org.entity_type
                            : 'N/A'}
                        </p>
                      </div>
                      {org.entity_type !== 'Individual' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Registration Number</label>
                          <p className="text-gray-900">{org.company_registration_number || 'N/A'}</p>
                        </div>
                      )}
                      {org.entity_type !== 'Individual' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">VAT Number</label>
                          <p className="text-gray-900">{org.vat_number || 'N/A'}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Website</label>
                        <p className="text-gray-900">{org.website || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Address Line 1</label>
                        <p className="text-gray-900">{org.address_line_1 || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Address Line 2</label>
                        <p className="text-gray-900">{org.address_line_2 || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">City</label>
                        <p className="text-gray-900">{org.city || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Province</label>
                        <p className="text-gray-900">{org.province || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Postal Code</label>
                        <p className="text-gray-900">{org.postal_code || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Country</label>
                        <p className="text-gray-900">{org.country || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-0.5">Status</label>
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                          org.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {org.status || 'Active'}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 border-t pt-3 mt-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Main User / Contact Person</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">First Name</label>
                          <p className="text-gray-900">{org.main_user_name || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Surname</label>
                          <p className="text-gray-900">{org.main_user_surname || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Email Address</label>
                          <p className="text-gray-900">{org.main_user_email || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Mobile Phone</label>
                          <p className="text-gray-900">{org.main_user_phone_mobile || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Office Phone</label>
                          <p className="text-gray-900">{org.main_user_phone_office || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 border-t pt-3 mt-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Billing User</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">First Name</label>
                          <p className="text-gray-900">{org.billing_user_name || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Surname</label>
                          <p className="text-gray-900">{org.billing_user_surname || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Email Address</label>
                          <p className="text-gray-900">{org.billing_user_email || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Mobile Phone</label>
                          <p className="text-gray-900">{org.billing_user_phone_mobile || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Office Phone</label>
                          <p className="text-gray-900">{org.billing_user_phone_office || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 border-t pt-3 mt-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Payment Configuration</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-0.5">Fuel Payment Option</label>
                          <div className="space-y-1">
                            {org.payment_option ? (
                              <>
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                  org.payment_option === 'Card Payment' ? 'bg-blue-100 text-blue-800' :
                                  org.payment_option === 'Local Account' ? 'bg-amber-100 text-amber-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {org.payment_option === 'Card Payment' ? 'Credit/Debit Card Payment' : org.payment_option}
                                </span>
                                {org.payment_option === 'Card Payment' && (
                                  <div className="mt-1">
                                    {cardConfigured[org.id] ? (
                                      <span className="text-xs text-green-600 font-medium">✓ Card Configured</span>
                                    ) : (
                                      <span className="text-xs text-red-600 font-medium">⚠ Card Not Configured</span>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-red-600 text-sm font-medium">Not configured</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}

        {filteredOrganizations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No organizations found
          </div>
        )}
      </div>
    </div>
  );
}
