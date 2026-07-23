import { useState, useEffect } from 'react';
import { Truck, Plus, CreditCard as Edit2, Trash2, X, Search, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Trailer {
  id: string;
  registration_number: string;
  description: string;
  gvm_weight: number;
  status: string;
  organization_id: string;
  organizations?: { name: string };
}

interface Organization {
  id: string;
  name: string;
}

interface TrailerManagementProps {
  onNavigate?: (view: string | null) => void;
}

export default function TrailerManagement({ onNavigate }: TrailerManagementProps = {}) {
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [filteredTrailers, setFilteredTrailers] = useState<Trailer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTrailer, setEditingTrailer] = useState<Trailer | null>(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Trailer | null>(null);

  const [formData, setFormData] = useState({
    registration_number: '',
    description: '',
    gvm_weight: 750,
    organization_id: '',
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId !== 'none') {
      loadTrailers();
    }
  }, [selectedOrgId]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredTrailers(trailers);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = trailers.filter(t =>
        t.registration_number.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      );
      setFilteredTrailers(filtered);
    }
  }, [searchTerm, trailers]);

  const loadOrganizations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingOrganizations(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      setUserRole(profile.role);

      const isSuper = profile.role === 'super_admin';

      const { data: userOrg } = await supabase
        .from('organizations')
        .select('is_management_org, organization_type')
        .eq('id', profile.organization_id)
        .maybeSingle();

      const isManagementUser = userOrg?.is_management_org === true && userOrg?.organization_type === 'management';

      if (isSuper || isManagementUser) {
        const { data } = await supabase
          .from('organizations')
          .select('id, name, is_management_org')
          .eq('organization_type', 'client')
          .order('name');

        if (data) {
          setOrganizations(data);
          setShowOrgSelector(true);
        }
      } else {
        const { data: ownOrg } = await supabase
          .from('organizations')
          .select('id, name, is_management_org')
          .eq('id', profile.organization_id)
          .maybeSingle();

        const allOrgs = ownOrg ? [ownOrg] : [];
        setOrganizations(allOrgs);

        if (allOrgs.length === 1) {
          setSelectedOrgId(allOrgs[0].id);
          setShowOrgSelector(false);
        } else {
          setShowOrgSelector(true);
        }
      }
    }
    setLoadingOrganizations(false);
  };

  const loadTrailers = async () => {
    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('trailers')
        .select('*, organizations(name)')
        .order('registration_number');

      if (selectedOrgId !== 'all') {
        query = query.eq('organization_id', selectedOrgId);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      if (data) {
        setTrailers(data);
        setFilteredTrailers(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load trailers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        registration_number: formData.registration_number.toUpperCase().trim(),
        description: formData.description.trim(),
        gvm_weight: formData.gvm_weight,
        organization_id: formData.organization_id,
      };

      if (editingTrailer) {
        const { error: updateError } = await supabase
          .from('trailers')
          .update({
            registration_number: payload.registration_number,
            description: payload.description,
            gvm_weight: payload.gvm_weight,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTrailer.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('trailers')
          .insert(payload);

        if (insertError) throw insertError;
      }

      setShowForm(false);
      setEditingTrailer(null);
      setFormData({ registration_number: '', description: '', gvm_weight: 750, organization_id: selectedOrgId !== 'all' ? selectedOrgId : '' });
      await loadTrailers();
    } catch (err: any) {
      setError(err.message || 'Failed to save trailer');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (trailer: Trailer) => {
    setEditingTrailer(trailer);
    setFormData({
      registration_number: trailer.registration_number,
      description: trailer.description || '',
      gvm_weight: trailer.gvm_weight,
      organization_id: trailer.organization_id,
    });
    setShowForm(true);
  };

  const handleDelete = async (trailer: Trailer) => {
    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('trailers')
        .update({
          status: 'inactive',
          deleted_at: new Date().toISOString(),
        })
        .eq('id', trailer.id);

      if (deleteError) throw deleteError;

      setShowDeleteConfirm(null);
      await loadTrailers();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate trailer');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingTrailer(null);
    setFormData({
      registration_number: '',
      description: '',
      gvm_weight: 750,
      organization_id: selectedOrgId !== 'all' ? selectedOrgId : organizations[0]?.id || '',
    });
    setShowForm(true);
  };

  const isSuperAdmin = userRole === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onNavigate && (
            <button
              onClick={() => onNavigate(null)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <Truck className="w-6 h-6 text-orange-600" />
          <h2 className="text-2xl font-bold text-gray-900">Trailer Management</h2>
        </div>
        <button
          onClick={openAddForm}
          disabled={loadingOrganizations || organizations.length === 0}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Trailer
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {showOrgSelector && (
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Organization</label>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="all">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by registration or description..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            <p className="text-gray-600 mt-2">Loading trailers...</p>
          </div>
        ) : filteredTrailers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No trailers found. Click "Add Trailer" to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GVM (kg)</th>
                  {showOrgSelector && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTrailers.map((trailer) => (
                  <tr key={trailer.id} className={`hover:bg-gray-50 ${trailer.status === 'inactive' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p className="text-sm font-semibold text-gray-900">{trailer.registration_number}</p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {trailer.description || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {trailer.gvm_weight.toLocaleString()}
                    </td>
                    {showOrgSelector && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trailer.organizations?.name || '-'}
                      </td>
                    )}
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        trailer.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {trailer.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(trailer)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {trailer.status === 'active' && (
                          <button
                            onClick={() => setShowDeleteConfirm(trailer)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTrailer ? 'Edit Trailer' : 'Add New Trailer'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditingTrailer(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {isSuperAdmin && showOrgSelector && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                  <select
                    value={formData.organization_id}
                    onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                    required
                    disabled={!!editingTrailer}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  >
                    <option value="">Select organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input
                  type="text"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })}
                  required
                  placeholder="e.g., TRAILER01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-gray-400 text-xs">(Make/Model)</span>
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Box trailer, Flatbed, Car carrier"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GVM Weight (kg)</label>
                <input
                  type="number"
                  value={formData.gvm_weight}
                  onChange={(e) => setFormData({ ...formData, gvm_weight: parseInt(e.target.value) || 0 })}
                  required
                  min="0"
                  placeholder="e.g., 750"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Trailers up to 750 kg can be towed with Code B. Over 750 kg requires Code EB or higher.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-semibold hover:bg-orange-700 disabled:bg-gray-300 transition-colors"
                >
                  {loading ? 'Saving...' : editingTrailer ? 'Update Trailer' : 'Add Trailer'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingTrailer(null); }}
                  className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Deactivate Trailer?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to deactivate trailer <strong>{showDeleteConfirm.registration_number}</strong>?
              It will no longer be available for selection during vehicle draws. Existing trip records will be preserved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={loading}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 transition-colors"
              >
                {loading ? 'Deactivating...' : 'Deactivate'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}