import { useState, useEffect } from 'react';
import { Truck, Plus, CreditCard as Edit2, Trash2, X, Search, RotateCcw, ArrowLeft, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Vehicle {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  year: number;
  license_disk_expiry: string;
  status: string;
  initial_odometer_reading: number;
  average_fuel_consumption_per_100km: number;
  tank_capacity?: number;
  vin_number?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_code_required?: string;
  prdp_required?: boolean;
  prdp_categories?: string[];
  last_service_date?: string;
  service_interval_km?: number;
  last_service_km_reading?: number;
  organization_id: string;
  deleted_at?: string | null;
  organizations?: {
    name: string;
  };
}

interface Organization {
  id: string;
  name: string;
}

interface VehicleManagementProps {
  onNavigate?: (view: string | null) => void;
}

export default function VehicleManagement({ onNavigate }: VehicleManagementProps = {}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [canAddVehicle, setCanAddVehicle] = useState(false);
  const [canEditVehicle, setCanEditVehicle] = useState(false);
  const [canDeleteVehicle, setCanDeleteVehicle] = useState(false);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [showLicenseExplanation, setShowLicenseExplanation] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(50);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState({
    registration_number: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    license_disk_expiry: '',
    vin_number: '',
    vehicle_type: 'ULP',
    vehicle_number: '',
    fuel_type: 'ULP-95',
    license_code_required: 'Code B',
    prdp_required: false,
    prdp_categories: [] as string[],
    status: 'active',
    initial_odometer_reading: 0,
    average_fuel_consumption_per_100km: 10,
    tank_capacity: 0,
    last_service_date: '',
    service_interval_km: 0,
    last_service_km_reading: 0,
    organization_id: '',
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    loadVehicles(1, searchTerm);
  }, [selectedOrgId]);

  useEffect(() => {
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }

    const timeout = setTimeout(() => {
      if (selectedOrgId !== 'none') {
        setCurrentPage(1);
        loadVehicles(1, searchTerm);
      }
    }, 300);

    setSearchDebounce(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchTerm]);

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
      .single();

    if (profile) {
      setUserRole(profile.role);

      const isSuper = profile.role === 'super_admin';

      // Load vehicle-specific permissions for non-super-admin users
      if (!isSuper) {
        const { data: orgUser } = await supabase
          .from('organization_users')
          .select('is_main_user, is_secondary_main_user, can_add_vehicles, can_edit_vehicles, can_delete_vehicles')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        const full = orgUser?.is_main_user || orgUser?.is_secondary_main_user || false;
        setCanAddVehicle(full || orgUser?.can_add_vehicles || false);
        setCanEditVehicle(full || orgUser?.can_edit_vehicles || false);
        setCanDeleteVehicle(full || orgUser?.can_delete_vehicles || false);
      } else {
        setCanAddVehicle(true);
        setCanEditVehicle(true);
        setCanDeleteVehicle(true);
      }

      // Check if user is in management organization
      const { data: userOrg } = await supabase
        .from('organizations')
        .select('is_management_org, organization_type')
        .eq('id', profile.organization_id)
        .maybeSingle();

      const isManagementUser = userOrg?.is_management_org === true && userOrg?.organization_type === 'management';

      if (isSuper) {
        // Super admins see ALL organizations
        const { data } = await supabase
          .from('organizations')
          .select('id, name, is_management_org')
          .eq('organization_type', 'client')
          .order('name');

        if (data) {
          setOrganizations(data);
          setShowOrgSelector(true);
        }
      } else if (isManagementUser) {
        // Management users see ALL client organizations
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
        // Client users only see their own organization
        const { data: ownOrg } = await supabase
          .from('organizations')
          .select('id, name, is_management_org')
          .eq('id', profile.organization_id)
          .maybeSingle();

        const allOrgs = ownOrg ? [ownOrg] : [];
        setOrganizations(allOrgs);

        // Client user only has their own organization, auto-select and hide selector
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

  const loadVehicles = async (page: number = currentPage, search: string = searchTerm) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profile) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      if (selectedOrgId === 'all' && profile.role === 'super_admin') {
        let query = supabase
          .from('vehicles')
          .select('*, organizations(name)', { count: 'exact' })
          .order('registration_number')
          .range(from, to);

        if (search.trim()) {
          query = query.or(`registration_number.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%`);
        }

        const { data, count } = await query;

        if (data) {
          setVehicles(data);
          setFilteredVehicles(data);
        }
        if (count !== null) setTotalCount(count);
      } else if (selectedOrgId === 'all') {
        // Client users only see vehicles from their own organization
        const orgIds = [profile.organization_id];

        let query = supabase
          .from('vehicles')
          .select('*, organizations(name)', { count: 'exact' })
          .in('organization_id', orgIds)
          .order('registration_number')
          .range(from, to);

        if (search.trim()) {
          query = query.or(`registration_number.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%`);
        }

        const { data, count } = await query;

        if (data) {
          setVehicles(data);
          setFilteredVehicles(data);
        }
        if (count !== null) setTotalCount(count);
      } else {
        let query = supabase
          .from('vehicles')
          .select('*, organizations(name)', { count: 'exact' })
          .eq('organization_id', selectedOrgId)
          .order('registration_number')
          .range(from, to);

        if (search.trim()) {
          query = query.or(`registration_number.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%`);
        }

        const { data, count } = await query;

        if (data) {
          setVehicles(data);
          setFilteredVehicles(data);
        }
        if (count !== null) setTotalCount(count);
      }
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      // Validate VIN is provided
      if (!formData.vin_number || formData.vin_number.trim() === '') {
        throw new Error('VIN Number is required for vehicle verification');
      }

      // Validate PrDP requirements
      if (formData.prdp_required && (!formData.prdp_categories || formData.prdp_categories.length === 0)) {
        throw new Error('At least one PrDP category must be selected when PrDP is required');
      }

      // Prepare vehicle data
      const vehicleData = {
        ...formData,
        fuel_type: formData.vehicle_type === 'Electric' ? null : formData.fuel_type,
      };

      if (editingVehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', editingVehicle.id);

        if (error) throw error;
      } else {
        const orgId = formData.organization_id || profile.organization_id;
        if (!orgId) throw new Error('Organization is required');

        const { error } = await supabase
          .from('vehicles')
          .insert({
            ...vehicleData,
            organization_id: orgId,
          });

        if (error) throw error;
      }

      resetForm();
      loadVehicles();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      registration_number: vehicle.registration_number,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      license_disk_expiry: vehicle.license_disk_expiry,
      vin_number: vehicle.vin_number || '',
      vehicle_type: vehicle.vehicle_type || 'ULP',
      vehicle_number: vehicle.vehicle_number || '',
      fuel_type: (vehicle as any).fuel_type || 'ULP-95',
      license_code_required: vehicle.license_code_required || 'Code B',
      prdp_required: vehicle.prdp_required || false,
      prdp_categories: vehicle.prdp_categories || [],
      status: vehicle.status,
      initial_odometer_reading: vehicle.initial_odometer_reading,
      average_fuel_consumption_per_100km: vehicle.average_fuel_consumption_per_100km,
      tank_capacity: vehicle.tank_capacity || 0,
      last_service_date: vehicle.last_service_date || '',
      service_interval_km: vehicle.service_interval_km || 0,
      last_service_km_reading: vehicle.last_service_km_reading || 0,
      organization_id: vehicle.organization_id,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle? Note: The vehicle will remain in the system database for audit and reporting purposes.')) return;

    const { data, error } = await supabase
      .rpc('soft_delete_vehicle', { vehicle_id: id });

    if (error) {
      alert('Error deleting vehicle: ' + error.message);
    } else if (data && !data.success) {
      alert('Error: ' + (data.error || 'Failed to delete vehicle'));
    } else {
      loadVehicles();
    }
  };

  const handleReactivate = async (id: string) => {
    if (!confirm('Are you sure you want to reactivate this vehicle?')) return;

    const { data, error } = await supabase
      .rpc('reactivate_vehicle', { vehicle_id: id });

    if (error) {
      alert('Error reactivating vehicle: ' + error.message);
    } else if (data && !data.success) {
      alert('Error: ' + (data.error || 'Failed to reactivate vehicle'));
    } else {
      loadVehicles();
    }
  };

  const resetForm = () => {
    setFormData({
      registration_number: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      license_disk_expiry: '',
      vin_number: '',
      vehicle_type: 'ULP',
      vehicle_number: '',
      fuel_type: 'ULP-95',
      license_code_required: 'Code B',
      prdp_required: false,
      prdp_categories: [],
      status: 'active',
      initial_odometer_reading: 0,
      average_fuel_consumption_per_100km: 10,
      tank_capacity: 0,
      last_service_date: '',
      service_interval_km: 0,
      last_service_km_reading: 0,
      organization_id: selectedOrgId !== 'all' ? selectedOrgId : '',
    });
    setEditingVehicle(null);
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="w-6 h-6 text-gray-700" />
          <h1 className="text-xl font-bold text-gray-900">Vehicles</h1>
        </div>
        <div className="flex items-center gap-2">
          {canAddVehicle && (
          <button
            onClick={() => {
              setFormData({ ...formData, organization_id: selectedOrgId });
              setShowForm(true);
            }}
            disabled={selectedOrgId === 'all'}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
            title={selectedOrgId === 'all' ? 'Please select a specific organization first' : ''}
          >
            <Plus className="w-4 h-4" />
            Add Vehicle
          </button>
          )}
          {onNavigate && (
            <button
              onClick={() => onNavigate(null)}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-3 py-1.5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Main Menu
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div key={editingVehicle?.id || 'new'} className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="vehicle-form"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
                >
                  {loading ? 'Saving...' : editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                </button>
              </div>
            </div>

            <form id="vehicle-form" onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {!editingVehicle && formData.organization_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Adding vehicle to:</span> {organizations.find(org => org.id === formData.organization_id)?.name}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-1">Vehicle Identification</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={formData.registration_number}
                      onChange={(e) => setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm uppercase"
                      placeholder="ABC 123 GP"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      VIN Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.vin_number || ''}
                      onChange={(e) => setFormData({ ...formData, vin_number: e.target.value.toUpperCase() })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm uppercase"
                      placeholder="1HGBH41JXMN109186"
                      minLength={11}
                      maxLength={17}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Vehicle Number (for Local Account)
                    </label>
                    <input
                      type="text"
                      value={formData.vehicle_number || ''}
                      onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="Vehicle account number"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">VIN required for fuel purchase authentication (11-17 characters). Vehicle Number used for Garage Local Account.</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-1">Vehicle Details</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Make</label>
                    <input
                      type="text"
                      value={formData.make}
                      onChange={(e) => setFormData({ ...formData, make: e.target.value.toUpperCase() })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm uppercase"
                      placeholder="Toyota"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Model</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value.toUpperCase() })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm uppercase"
                      placeholder="Hilux"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Year</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-1">License & Fuel Details</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      License Disk Expiry
                    </label>
                    <input
                      type="date"
                      value={formData.license_disk_expiry}
                      onChange={(e) => setFormData({ ...formData, license_disk_expiry: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      min={new Date().toISOString().split('T')[0]}
                      max={`${new Date().getFullYear() + 1}-12-31`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Vehicle Type</label>
                    <select
                      value={formData.vehicle_type}
                      onChange={(e) => {
                        const newVehicleType = e.target.value;
                        let defaultFuelType = '';

                        if (newVehicleType === 'ULP' || newVehicleType === 'HYBRID-ULP') {
                          defaultFuelType = 'ULP-95';
                        } else if (newVehicleType === 'DIESEL' || newVehicleType === 'HYBRID-DIESEL') {
                          defaultFuelType = 'Diesel-50';
                        }

                        setFormData({
                          ...formData,
                          vehicle_type: newVehicleType,
                          fuel_type: defaultFuelType
                        });
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      required
                    >
                      <option value="ULP">ULP (Petrol)</option>
                      <option value="DIESEL">DIESEL</option>
                      <option value="HYBRID-ULP">HYBRID-ULP (Hybrid Petrol)</option>
                      <option value="HYBRID-DIESEL">HYBRID-DIESEL (Hybrid Diesel)</option>
                      <option value="ELECTRIC">ELECTRIC</option>
                    </select>
                  </div>
                  {formData.vehicle_type !== 'ELECTRIC' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Fuel Type</label>
                      <select
                        value={formData.fuel_type}
                        onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                        required
                      >
                        {(formData.vehicle_type === 'ULP' || formData.vehicle_type === 'HYBRID-ULP') && (
                          <>
                            <option value="ULP-93">ULP-93 Octane</option>
                            <option value="ULP-95">ULP-95 Octane</option>
                          </>
                        )}
                        {(formData.vehicle_type === 'DIESEL' || formData.vehicle_type === 'HYBRID-DIESEL') && (
                          <>
                            <option value="Diesel-10">Diesel-10 PPM</option>
                            <option value="Diesel-50">Diesel-50 PPM</option>
                            <option value="Diesel-500">Diesel-500 PPM</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-1">Status & Requirements</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">License Code Required</label>
                    <select
                      value={formData.license_code_required}
                      onChange={(e) => setFormData({ ...formData, license_code_required: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      required
                    >
                      <option value="Code A1">Code A1 (Light Motorcycle &lt; 125cc)</option>
                      <option value="Code A">Code A (Motorcycle &gt; 125cc)</option>
                      <option value="Code B">Code B (Light Vehicle + Trailer &lt; 750kg GVM)</option>
                      <option value="Code EB">Code EB (Light Vehicle + Trailer &gt; 750kg GVM)</option>
                      <option value="Code C1">Code C1 (Vehicle &lt; 16000kg GVM + Trailer &lt; 750kg GVM)</option>
                      <option value="Code EC1">Code EC1 (Vehicle &lt; 16000kg GVM + Trailer &gt; 750kg GVM)</option>
                      <option value="Code C">Code C (Vehicle &gt; 16000kg GVM + Trailer &lt; 750kg GVM)</option>
                      <option value="Code EC">Code EC (Any Size Vehicle + Trailer &gt; 750kg GVM)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowLicenseExplanation(true)}
                      className="mt-1 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Info size={14} />
                      License Code Detail Explanation
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-1">Professional Driving Permit (PrDP)</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="prdp_required"
                      checked={formData.prdp_required}
                      onChange={(e) => {
                        const isRequired = e.target.checked;
                        setFormData({
                          ...formData,
                          prdp_required: isRequired,
                          prdp_categories: isRequired ? formData.prdp_categories : []
                        });
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="prdp_required" className="text-sm font-medium text-gray-700">
                      Select if Professional Driving Permit (PrDP) is Required
                    </label>
                  </div>

                  {formData.prdp_required && (
                    <div className="ml-6 space-y-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        PrDP Category <span className="text-red-500">*</span> (Select one or more)
                      </label>
                      <div className="space-y-2">
                        {['PrDP - Passengers', 'PrDP - Goods', 'PrDP - Dangerous Goods'].map((category) => (
                          <div key={category} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={category}
                              checked={formData.prdp_categories.includes(category)}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setFormData({
                                  ...formData,
                                  prdp_categories: isChecked
                                    ? [...formData.prdp_categories, category]
                                    : formData.prdp_categories.filter(c => c !== category)
                                });
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor={category} className="text-sm text-gray-700">
                              {category}
                            </label>
                          </div>
                        ))}
                      </div>
                      {formData.prdp_required && formData.prdp_categories.length === 0 && (
                        <p className="text-xs text-red-600 mt-1">At least one PrDP category must be selected</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-1">Performance Metrics</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Initial Odometer (km)
                    </label>
                    <input
                      type="number"
                      value={formData.initial_odometer_reading}
                      onChange={(e) => setFormData({ ...formData, initial_odometer_reading: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="50000"
                      min="0"
                      step="0.1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Fuel Consumption (L/100km)
                    </label>
                    <input
                      type="number"
                      value={formData.average_fuel_consumption_per_100km}
                      onChange={(e) => setFormData({ ...formData, average_fuel_consumption_per_100km: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="10.5"
                      min="0"
                      step="0.1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Tank Capacity (Liters)
                    </label>
                    <input
                      type="number"
                      value={formData.tank_capacity}
                      onChange={(e) => setFormData({ ...formData, tank_capacity: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="60"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-1">Maintenance</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Last Service Date
                    </label>
                    <input
                      type="date"
                      value={formData.last_service_date}
                      onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Last Service KM Reading
                    </label>
                    <input
                      type="number"
                      value={formData.last_service_km_reading}
                      onChange={(e) => setFormData({ ...formData, last_service_km_reading: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="50000"
                      min="0"
                      step="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Service Interval (km)
                    </label>
                    <input
                      type="number"
                      value={formData.service_interval_km}
                      onChange={(e) => setFormData({ ...formData, service_interval_km: parseInt(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="10000"
                      min="0"
                      step="1000"
                    />
                  </div>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by Make & Model or Registration"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {showOrgSelector && (
          <div>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vehicle
              </th>
              {userRole === 'super_admin' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Year
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                License Expiry
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading || loadingOrganizations ? (
              <tr>
                <td colSpan={userRole === 'super_admin' ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                  Loading vehicles...
                </td>
              </tr>
            ) : filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan={userRole === 'super_admin' ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                  {searchTerm ? 'No vehicles found matching your search.' : 'No vehicles added yet.'}
                </td>
              </tr>
            ) : (
              filteredVehicles.map((vehicle) => (
              <tr key={vehicle.id} className={`hover:bg-gray-50 ${vehicle.deleted_at ? 'bg-gray-50 opacity-60' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className={`font-medium uppercase ${vehicle.deleted_at ? 'text-gray-500' : 'text-gray-900'}`}>
                    {vehicle.registration_number}
                    {vehicle.deleted_at && <span className="ml-2 text-xs text-red-600">(Deleted)</span>}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className={`text-sm uppercase ${vehicle.deleted_at ? 'text-gray-500' : 'text-gray-900'}`}>{vehicle.make} {vehicle.model}</p>
                </td>
                {userRole === 'super_admin' && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className={`text-sm ${vehicle.deleted_at ? 'text-gray-500' : 'text-gray-700'}`}>{vehicle.organizations?.name || 'N/A'}</p>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {vehicle.year}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(vehicle.license_disk_expiry).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {vehicle.deleted_at ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      Inactive
                    </span>
                  ) : (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      vehicle.status === 'active' ? 'bg-green-100 text-green-800' :
                      vehicle.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {vehicle.status}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    {vehicle.deleted_at ? (
                      <button
                        onClick={() => handleReactivate(vehicle.id)}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                        title="Reactivate Vehicle"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reactivate
                      </button>
                    ) : (
                      <>
                        {canEditVehicle && (
                        <button
                          onClick={() => handleEdit(vehicle)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        )}
                        {canDeleteVehicle && (
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {totalCount > pageSize && (
          <div className="px-6 py-4 flex items-center justify-between border-t">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
              <span className="font-medium">{totalCount}</span> vehicles
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  setCurrentPage(newPage);
                  loadVehicles(newPage, searchTerm);
                }}
                disabled={currentPage === 1}
                className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {currentPage} of {Math.ceil(totalCount / pageSize)}
              </span>
              <button
                onClick={() => {
                  const newPage = Math.min(Math.ceil(totalCount / pageSize), currentPage + 1);
                  setCurrentPage(newPage);
                  loadVehicles(newPage, searchTerm);
                }}
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showLicenseExplanation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-900">License Code Detail Explanation</h2>
              <button
                onClick={() => setShowLicenseExplanation(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2">License Hierarchy</h3>
                <p className="text-sm text-blue-800 mb-2">
                  Higher-level licenses generally include the privileges of lower-level licenses within their category:
                </p>
                <ul className="text-sm text-blue-800 list-disc pl-5 space-y-1">
                  <li><strong>Code C</strong> holders can drive vehicles requiring Code C1 and Code B</li>
                  <li><strong>Code EC</strong> holders can drive vehicles requiring Code EC1, Code C, Code C1, Code EB, and Code B</li>
                  <li>Motorcycle licenses (Code A, A1) are separate and do not overlap with vehicle licenses</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 border-b-2 border-blue-500 pb-2">Motorcycle Licences</h3>

                <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded">
                  <h4 className="font-semibold text-gray-900 mb-1">Code A1</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>What you may drive:</strong> Motorcycles up to 125cc, Power output ≤ 11 kW
                  </p>
                  <p className="text-sm text-gray-600 mb-1">Light scooters and small commuter bikes. Minimum age: 16</p>
                  <p className="text-xs text-gray-500">
                    <strong>Includes:</strong> Delivery scooters, light courier bikes
                  </p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded">
                  <h4 className="font-semibold text-gray-900 mb-1">Code A</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>What you may drive:</strong> All motorcycles, any engine size or power
                  </p>
                  <p className="text-sm text-gray-600 mb-1">Minimum age: 18</p>
                  <p className="text-xs text-gray-500">
                    <strong>Includes:</strong> Touring bikes, large-capacity motorcycles
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 border-b-2 border-green-500 pb-2">Light Motor Vehicles</h3>

                <div className="border-l-4 border-green-500 pl-4 py-2 bg-green-50 rounded">
                  <h4 className="font-semibold text-gray-900 mb-1">Code B</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>What you may drive:</strong> Motor vehicles ≤ 3,500 kg GVM, Maximum 8 passengers + driver, Towing a light trailer ≤ 750 kg (GVM)
                  </p>
                  <p className="text-sm text-gray-600 mb-1">Minimum age: 18</p>
                  <p className="text-xs text-gray-500 mb-2">
                    <strong>Includes:</strong> Sedans, Bakkies, SUVs, Small delivery vans
                  </p>
                  <p className="text-xs text-red-600 font-semibold">
                    Important: If the trailer exceeds 750 kg, Code B is NOT sufficient.
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4 py-2 bg-green-50 rounded">
                  <h4 className="font-semibold text-gray-900 mb-1">Code EB</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>What you may drive:</strong> Same as Code B but may tow heavy trailers & caravans &gt; 750 kg (GVM)
                  </p>
                  <p className="text-sm text-gray-600 mb-1">Minimum age: 18</p>
                  <p className="text-xs text-gray-500 mb-1">
                    <strong>Includes:</strong> Double-axle trailers, Caravans, Boat trailers
                  </p>
                  <p className="text-xs text-blue-600">
                    <strong>Note:</strong> Required for towing equipment or cargo trailers
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 border-b-2 border-orange-500 pb-2">Minibus & Medium Vehicles</h3>

                <div className="border-l-4 border-orange-500 pl-4 py-2 bg-orange-50 rounded">
                  <h4 className="font-semibold text-gray-900 mb-1">Code C1</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>What you may drive:</strong> Vehicles 3,500 kg – 16,000 kg GVM, ≤ 16 passengers, Trailer ≤ 750 kg
                  </p>
                  <p className="text-sm text-gray-600 mb-1">Minimum age: 18</p>
                  <p className="text-xs text-gray-500 mb-1">
                    <strong>Includes:</strong> 15-seater minibuses, Medium delivery trucks, Small box trucks
                  </p>
                  <p className="text-xs text-blue-600">Common in logistics, shuttle services, construction</p>
                </div>

                <div className="border-l-4 border-orange-500 pl-4 py-2 bg-orange-50 rounded">
                  <h4 className="font-semibold text-gray-900 mb-1">Code EC1</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>What you may drive:</strong> Code C1 vehicle, Trailer &gt; 750 kg
                  </p>
                  <p className="text-sm text-gray-600 mb-1">Minimum age: 18</p>
                  <p className="text-xs text-gray-500">
                    <strong>Includes:</strong> Medium trucks towing equipment or machinery
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 border-b-2 border-red-500 pb-2">Heavy Vehicles</h3>

                <div className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded">
                  <h4 className="font-semibold text-gray-900 mb-1">Code C</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>What you may drive:</strong> Vehicles over 16,000 kg GVM, Trailer ≤ 750 kg
                  </p>
                  <p className="text-sm text-gray-600 mb-1">Minimum age: 21. Requires professional driving competence</p>
                  <p className="text-xs text-gray-500">
                    <strong>Includes:</strong> Large rigid trucks, Refuse trucks, Fire engines
                  </p>
                </div>

                <div className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded">
                  <h4 className="font-semibold text-gray-900 mb-1">Code EC (Highest Code)</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>What you may drive:</strong> Any vehicle combination, Articulated trucks, Horse-and-trailer / interlink rigs
                  </p>
                  <p className="text-sm text-gray-600 mb-1">Minimum age: 21. Requires professional driving competence</p>
                  <p className="text-xs text-gray-500">
                    <strong>Includes:</strong> Semi-trailers, Tankers, Abnormal loads (with permits)
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 mb-3">Quick Comparison Table</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="px-2 py-1 text-left">Code</th>
                        <th className="px-2 py-1 text-left">Max Weight</th>
                        <th className="px-2 py-1 text-left">Trailer</th>
                        <th className="px-2 py-1 text-left">Typical Vehicles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr><td className="px-2 py-1">A1</td><td className="px-2 py-1">≤125cc</td><td className="px-2 py-1">-</td><td className="px-2 py-1">Scooters</td></tr>
                      <tr><td className="px-2 py-1">A</td><td className="px-2 py-1">All bikes</td><td className="px-2 py-1">-</td><td className="px-2 py-1">Any bike</td></tr>
                      <tr><td className="px-2 py-1">B</td><td className="px-2 py-1">≤3,500 kg</td><td className="px-2 py-1">≤750 kg</td><td className="px-2 py-1">Cars, bakkies</td></tr>
                      <tr><td className="px-2 py-1">EB</td><td className="px-2 py-1">≤3,500 kg</td><td className="px-2 py-1">&gt;750 kg</td><td className="px-2 py-1">Car + trailer</td></tr>
                      <tr><td className="px-2 py-1">C1</td><td className="px-2 py-1">≤16,000 kg</td><td className="px-2 py-1">≤750 kg</td><td className="px-2 py-1">Minibus, medium truck</td></tr>
                      <tr><td className="px-2 py-1">EC1</td><td className="px-2 py-1">≤16,000 kg</td><td className="px-2 py-1">&gt;750 kg</td><td className="px-2 py-1">Medium truck + trailer</td></tr>
                      <tr><td className="px-2 py-1">C</td><td className="px-2 py-1">&gt;16,000 kg</td><td className="px-2 py-1">≤750 kg</td><td className="px-2 py-1">Heavy rigid truck</td></tr>
                      <tr><td className="px-2 py-1">EC</td><td className="px-2 py-1">Any</td><td className="px-2 py-1">Any</td><td className="px-2 py-1">Articulated truck</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
                <h3 className="font-bold text-red-900 mb-2">Common Compliance Mistakes</h3>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>✗ Code B driving a 15-seater minibus → Illegal</li>
                  <li>✗ Code B towing a heavy trailer → Illegal</li>
                  <li>✗ Code C without EC pulling a semi-trailer → Illegal</li>
                  <li>✗ Insurance may be void if licence code is incorrect</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                <h3 className="font-bold text-green-900 mb-2">Fleet & Operations Guidance</h3>
                <p className="text-sm text-green-800 mb-2">For fleet compliance:</p>
                <ul className="text-sm text-green-800 list-disc pl-5 space-y-1">
                  <li>Cars / bakkies: Code B</li>
                  <li>Vehicles towing equipment: Code EB</li>
                  <li>15-seaters / medium trucks: Code C1</li>
                  <li>Heavy rigid trucks: Code C</li>
                  <li>Articulated / interlinks: Code EC</li>
                </ul>
              </div>

              <div className="border-t-4 border-purple-500 pt-4">
                <h3 className="text-xl font-bold text-purple-900 mb-3">Professional Driving Permit (PrDP)</h3>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <h4 className="font-bold text-purple-900 mb-2">What is a PrDP?</h4>
                  <p className="text-sm text-purple-800 mb-2">
                    A PrDP (Professional Driving Permit) is a mandatory legal endorsement added to a South African driver's licence
                    for anyone who drives certain vehicles professionally or transports people or goods for reward.
                  </p>
                  <p className="text-sm text-purple-900 font-semibold">
                    A driver can have the correct licence code and still be illegal to drive without a PrDP.
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  <h4 className="font-bold text-gray-900">Who MUST have a PrDP?</h4>

                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Passenger Transport</p>
                    <p className="text-xs text-blue-800">Minibus taxis, Staff transport, School transport, Shuttle services, Tour buses</p>
                    <p className="text-xs text-blue-700 mt-1">Even if passengers are employees (not paying)</p>
                  </div>

                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Goods Transport</p>
                    <p className="text-xs text-blue-800">Trucks or delivery vehicles over 3,500 kg GVM, Vehicles carrying goods for commercial purposes, Fleet vehicles used as part of a business</p>
                  </div>

                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Public / Commercial Services</p>
                    <p className="text-xs text-blue-800">Ride-hailing drivers (e.g. Uber, Bolt), Chauffeur services, Driving schools, Metered taxis</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-900 font-semibold mb-1">Even if:</p>
                  <ul className="text-xs text-amber-800 list-disc pl-5 space-y-1">
                    <li>The driver is not paid per trip</li>
                    <li>The vehicle is company-owned</li>
                    <li>The driver already holds Code C or CE</li>
                  </ul>
                  <p className="text-sm text-amber-900 font-bold mt-2">A PrDP is still required.</p>
                </div>

                <div className="space-y-3 mb-4">
                  <h4 className="font-bold text-gray-900">PrDP Categories</h4>

                  <div className="border-l-4 border-purple-500 pl-3 py-2 bg-purple-50">
                    <p className="text-sm font-semibold text-purple-900">PrDP-P (Passengers)</p>
                    <p className="text-xs text-purple-800">Required if transporting people: Minibus taxis, Buses, Staff shuttles, Tour vehicles</p>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-3 py-2 bg-purple-50">
                    <p className="text-sm font-semibold text-purple-900">PrDP-G (Goods)</p>
                    <p className="text-xs text-purple-800">Required if transporting goods: Trucks, Delivery vehicles &gt;3,500 kg, Logistics and freight vehicles</p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-3 py-2 bg-red-50">
                    <p className="text-sm font-semibold text-red-900">PrDP-D (Dangerous Goods)</p>
                    <p className="text-xs text-red-800">Required if transporting: Fuel, Chemicals, Gas, Explosives</p>
                    <p className="text-xs text-red-700 font-semibold mt-1">Requires special HazMat training and certification</p>
                  </div>
                </div>

                <div className="bg-gray-100 rounded-lg p-3 mb-4">
                  <h4 className="font-bold text-gray-900 mb-2 text-sm">PrDP Application Requirements</h4>
                  <ol className="text-xs text-gray-800 space-y-1 list-decimal pl-5">
                    <li><strong>Hold the correct licence code</strong> (Code C1/C/EC or relevant category)</li>
                    <li><strong>Medical Certificate</strong> (Valid for 24 months)</li>
                    <li><strong>Criminal Record Check</strong> (Fingerprints taken at traffic department or SAPS)</li>
                    <li><strong>Age Requirements:</strong> PrDP-G: 18, PrDP-P: 21, PrDP-D: 21</li>
                    <li><strong>Valid ID / Proof of Residence</strong></li>
                  </ol>
                </div>

                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
                  <h4 className="font-bold text-yellow-900 mb-1 text-sm">Validity Periods</h4>
                  <p className="text-xs text-yellow-800">PrDP-P & PrDP-G: 24 months | PrDP-D: 12 months</p>
                  <p className="text-xs text-yellow-900 font-semibold mt-1">A standard driver's licence validity does NOT extend the PrDP.</p>
                </div>

                <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
                  <h4 className="font-bold text-red-900 mb-2">Legal & Insurance Consequences</h4>
                  <p className="text-sm text-red-800 mb-2">Driving without a required PrDP:</p>
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>✗ Is a criminal offence</li>
                    <li>✗ Can result in vehicle impoundment</li>
                    <li>✗ Invalidates insurance claims</li>
                    <li>✗ Exposes employer to vicarious liability</li>
                  </ul>
                  <p className="text-xs text-red-900 font-semibold mt-2">
                    In fleet audits, missing PrDPs are one of the most common compliance failures.
                  </p>
                </div>

                <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                  <h4 className="font-bold text-green-900 mb-2 text-sm">Fleet Compliance Best Practice</h4>
                  <ul className="text-xs text-green-800 list-disc pl-5 space-y-1">
                    <li>Maintain a PrDP expiry register</li>
                    <li>Renew at least 60 days before expiry</li>
                    <li>Keep medical certificates on file</li>
                    <li>Match vehicle GVM + use case → licence + PrDP</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded">
                <p className="text-sm text-gray-900 font-bold mb-1">
                  Critical Reminder:
                </p>
                <p className="text-sm text-gray-700">
                  Always verify that drivers have the appropriate license code AND PrDP (if required) for the vehicles they will operate.
                  Operating a vehicle without the proper credentials is illegal and may void insurance coverage in the event of an accident.
                </p>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowLicenseExplanation(false)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
