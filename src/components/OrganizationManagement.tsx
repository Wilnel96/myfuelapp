import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, CreditCard as Edit2, Save, X, AlertCircle, CheckCircle } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  billing_contact_email: string;
  phone_number: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  company_registration_number: string;
  vat_number: string;
}

interface OrganizationManagementProps {
  onBack?: () => void;
}

export default function OrganizationManagement({ onBack }: OrganizationManagementProps = {}) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isManagementOrg, setIsManagementOrg] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Organization>>({});

  useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) throw new Error('No organization found');

      const { data, error: fetchError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (data) {
        setOrganization(data);
        setIsManagementOrg(data.name === 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD');
      }
    } catch (err: any) {
      console.error('Error loading organization:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (organization) {
      setEditForm(organization);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!organization) return;

    try {
      setError('');
      setSuccess('');

      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          billing_contact_email: editForm.billing_contact_email,
          phone_number: editForm.phone_number,
          address_line_1: editForm.address_line_1,
          address_line_2: editForm.address_line_2,
          city: editForm.city,
          province: editForm.province,
          postal_code: editForm.postal_code,
          country: editForm.country,
          company_registration_number: editForm.company_registration_number,
          vat_number: editForm.vat_number,
        })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      setSuccess('Organization information updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      setIsEditing(false);
      setEditForm({});
      loadOrganization();
    } catch (err: any) {
      console.error('Error saving organization:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No organization information found</p>
      </div>
    );
  }

  return (
    <div className="-my-6">
      <div className="sticky top-0 z-30 bg-white -mx-4 px-4 py-3 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              {isManagementOrg ? 'Management Organization Information' : 'Client Organization Information'}
            </h2>
          </div>
          {isEditing ? (
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
            onBack && (
              <button
                onClick={onBack}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 px-2 py-1"
              >
                ← Back to Management Organization Info
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-6">
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

        <div className="bg-white border border-gray-200 rounded-lg p-6">
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Email Address</label>
                <input
                  type="email"
                  value={editForm.billing_contact_email || ''}
                  onChange={(e) => setEditForm({ ...editForm, billing_contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="info@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input
                  type="text"
                  value={editForm.company_registration_number || ''}
                  onChange={(e) => setEditForm({ ...editForm, company_registration_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                <input
                  type="text"
                  value={editForm.vat_number || ''}
                  onChange={(e) => setEditForm({ ...editForm, vat_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Office Number</label>
                <input
                  type="text"
                  value={editForm.phone_number || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={editForm.address_line_1 || ''}
                  onChange={(e) => setEditForm({ ...editForm, address_line_1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={editForm.address_line_2 || ''}
                  onChange={(e) => setEditForm({ ...editForm, address_line_2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={editForm.city || ''}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={editForm.postal_code || ''}
                  onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                <select
                  value={editForm.province || ''}
                  onChange={(e) => setEditForm({ ...editForm, province: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={editForm.country || ''}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{organization.name}</h3>
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Company Email Address</p>
                <p className="text-gray-900">{organization.billing_contact_email || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Office Number</p>
                <p className="text-gray-900">{organization.phone_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Registration Number</p>
                <p className="text-gray-900">{organization.company_registration_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">VAT Number</p>
                <p className="text-gray-900">{organization.vat_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Address Line 1</p>
                <p className="text-gray-900">{organization.address_line_1 || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Address Line 2</p>
                <p className="text-gray-900">{organization.address_line_2 || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">City</p>
                <p className="text-gray-900">{organization.city || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Postal Code</p>
                <p className="text-gray-900">{organization.postal_code || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Province</p>
                <p className="text-gray-900">{organization.province || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Country</p>
                <p className="text-gray-900">{organization.country || '-'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
