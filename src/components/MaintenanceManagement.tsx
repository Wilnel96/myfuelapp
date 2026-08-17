import { useState, useEffect } from 'react';
import { Wrench, Plus, Trash2, X, Search, ArrowLeft, DollarSign, Calendar, Truck, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Vehicle {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  last_service_date?: string;
  service_interval_km?: number;
  last_service_km_reading?: number;
  next_service_km?: number;
}

interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_type: 'service' | 'other';
  description: string;
  maintenance_date: string;
  odometer_reading: number | null;
  cost: number;
  workshop: string | null;
  maintenance_items?: string[] | null;
  created_at: string;
}

interface MaintenanceManagementProps {
  onNavigate?: (view: string | null) => void;
}

const SERVICE_ITEMS = [
  'Minor Service',
  'Major Service',
  'Oil Change',
  'Oil Filter Replacement',
  'Air Filter Replacement',
  'Fuel Filter Replacement',
  'Cabin Filter Replacement',
  'Spark Plug Replacement',
  'Coolant Flush',
  'Brake Fluid Change',
  'Transmission Fluid Change',
  'Differential Fluid Change',
  'General Inspection',
];

const OTHER_ITEMS = [
  'Tire Replacement',
  'Tire Rotation',
  'Wheel Alignment',
  'Brake Pads',
  'Brake Discs',
  'Brake Calipers',
  'Battery Replacement',
  'Alternator Repair',
  'Starter Motor Repair',
  'Clutch Replacement',
  'Shock Absorbers',
  'Exhaust Repair',
  'Engine Repair',
  'Gearbox Repair',
  'Differential Repair',
  'Electrical Fault',
  'Bodywork / Panel Beating',
  'Windscreen Replacement',
  'Air Conditioning Service',
  'Tow Bar Fitment',
  'Other',
];

export default function MaintenanceManagement({ onNavigate }: MaintenanceManagementProps = {}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [totalMaintenanceCost, setTotalMaintenanceCost] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string>('');

  const [formData, setFormData] = useState({
    maintenance_type: 'service' as 'service' | 'other',
    description: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    odometer_reading: '',
    cost: '',
    workshop: '',
    maintenance_items: [] as string[],
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) return;
      setOrgId(profile.organization_id);

      let query = supabase
        .from('vehicles')
        .select('id, registration_number, make, model, last_service_date, service_interval_km, last_service_km_reading, next_service_km')
        .is('deleted_at', null)
        .order('registration_number');

      if (profile.role !== 'super_admin') {
        query = query.eq('organization_id', profile.organization_id);
      }

      const { data } = await query;
      if (data) {
        setVehicles(data);
        setFilteredVehicles(data);
      }
    } catch (err) {
      console.error('Error loading vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const filtered = vehicles.filter(v =>
      v.registration_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.make || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.model || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredVehicles(filtered);
  }, [searchTerm, vehicles]);

  const loadRecords = async (vehicleId: string) => {
    const { data, error } = await supabase
      .from('vehicle_maintenance_records')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('maintenance_date', { ascending: false });

    if (error) {
      console.error('Error loading maintenance records:', error);
      return;
    }

    setRecords(data || []);
    const total = (data || []).reduce((sum, r) => sum + parseFloat(String(r.cost || 0)), 0);
    setTotalMaintenanceCost(total);
  };

  const handleVehicleClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setRecords([]);
    setTotalMaintenanceCost(0);
    loadRecords(vehicle.id);
  };

  const handleBack = () => {
    setSelectedVehicle(null);
    setRecords([]);
    setTotalMaintenanceCost(0);
    setShowAddForm(false);
  };

  const toggleItem = (item: string) => {
    setFormData(prev => {
      const items = prev.maintenance_items.includes(item)
        ? prev.maintenance_items.filter(i => i !== item)
        : [...prev.maintenance_items, item];
      return { ...prev, maintenance_items: items };
    });
  };

  const availableItems = formData.maintenance_type === 'service' ? SERVICE_ITEMS : OTHER_ITEMS;

  const handleTypeChange = (type: 'service' | 'other') => {
    setFormData(prev => ({
      ...prev,
      maintenance_type: type,
      maintenance_items: [],
    }));
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !formData.maintenance_date) return;

    const description = formData.description.trim() ||
      (formData.maintenance_items.length > 0 ? formData.maintenance_items.join(', ') : '');
    if (!description) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const insertData: Record<string, unknown> = {
        vehicle_id: selectedVehicle.id,
        organization_id: orgId,
        maintenance_type: formData.maintenance_type,
        description,
        maintenance_date: formData.maintenance_date,
        cost: parseFloat(formData.cost) || 0,
        workshop: formData.workshop.trim() || null,
      };

      if (formData.odometer_reading) {
        insertData.odometer_reading = parseInt(formData.odometer_reading);
      }

      if (formData.maintenance_items.length > 0) {
        insertData.maintenance_items = formData.maintenance_items;
      }

      if (user) {
        insertData.created_by = user.id;
      }

      const { error } = await supabase
        .from('vehicle_maintenance_records')
        .insert(insertData);

      if (error) {
        alert(`Failed to save record: ${error.message}`);
        return;
      }

      setShowAddForm(false);
      setFormData({
        maintenance_type: 'service',
        description: '',
        maintenance_date: new Date().toISOString().split('T')[0],
        odometer_reading: '',
        cost: '',
        workshop: '',
        maintenance_items: [],
      });
      await loadRecords(selectedVehicle.id);
      await loadVehicles();
      const updated = vehicles.find(v => v.id === selectedVehicle.id);
      if (updated) setSelectedVehicle(updated);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Delete this maintenance record? This cannot be undone.')) return;

    const { error } = await supabase
      .from('vehicle_maintenance_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      alert(`Failed to delete: ${error.message}`);
      return;
    }

    if (selectedVehicle) {
      await loadRecords(selectedVehicle.id);
    }
  };

  const formatCurrency = (amount: number) => `R ${amount.toFixed(2)}`;
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ---- Detail view for a single vehicle ----
  if (selectedVehicle) {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Maintenance
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {selectedVehicle.registration_number}
                </h1>
                <p className="text-sm text-gray-600">
                  {selectedVehicle.make} {selectedVehicle.model}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Log Maintenance
            </button>
          </div>
        </div>

        {/* Service summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Last Service</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {formatDate(selectedVehicle.last_service_date || '')}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Last Service KM</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {selectedVehicle.last_service_km_reading ? selectedVehicle.last_service_km_reading.toLocaleString() : '-'}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Next Service KM</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {selectedVehicle.next_service_km ? selectedVehicle.next_service_km.toLocaleString() : '-'}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-700 font-medium uppercase flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Total Maintenance Cost
            </p>
            <p className="text-lg font-bold text-blue-900 mt-1">{formatCurrency(totalMaintenanceCost)}</p>
          </div>
        </div>

        {/* Maintenance history table */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Maintenance History</h2>
          </div>
          {records.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Wrench className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No maintenance records yet. Click "Log Maintenance" to add the first one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Odometer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workshop</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDate(record.maintenance_date)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.maintenance_type === 'service'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {record.maintenance_type === 'service' ? 'Service' : 'Other'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                        {record.maintenance_items && record.maintenance_items.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {record.maintenance_items.map((item, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs whitespace-nowrap">
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{record.description}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                        {record.odometer_reading ? record.odometer_reading.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{record.workshop || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 whitespace-nowrap">{formatCurrency(parseFloat(String(record.cost || 0)))}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr className="font-semibold">
                    <td colSpan={6} className="px-4 py-3 text-sm text-gray-900 text-right">Total:</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(totalMaintenanceCost)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Add maintenance record modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">Log Maintenance Record</h3>
                <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddRecord} className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Type</label>
                  <select
                    value={formData.maintenance_type}
                    onChange={(e) => handleTypeChange(e.target.value as 'service' | 'other')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="service">Service</option>
                    <option value="other">Other Maintenance</option>
                  </select>
                </div>

                {/* Selectable maintenance items */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maintenance Items
                    <span className="text-gray-400 font-normal ml-1">(select all that apply)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {availableItems.map((item) => {
                      const selected = formData.maintenance_items.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleItem(item)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition-colors ${
                            selected
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                          }`}
                        >
                          {selected
                            ? <CheckSquare className="w-4 h-4 flex-shrink-0" />
                            : <Square className="w-4 h-4 flex-shrink-0 text-gray-400" />
                          }
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>
                  {formData.maintenance_items.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.maintenance_items.length} item{formData.maintenance_items.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.maintenance_date}
                    onChange={(e) => setFormData({ ...formData, maintenance_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                    <span className="text-gray-400 font-normal ml-1">
                      {formData.maintenance_items.length > 0 ? '(auto-filled from items if left blank)' : '*'}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g. 90,000 km major service"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Odometer (km)</label>
                    <input
                      type="number"
                      value={formData.odometer_reading}
                      onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                      placeholder="e.g. 125000"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost (R) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Workshop / Service Provider</label>
                  <input
                    type="text"
                    value={formData.workshop}
                    onChange={(e) => setFormData({ ...formData, workshop: e.target.value })}
                    placeholder="e.g. ABC Motors"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex gap-3 pt-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {saving ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Vehicle list view ----
  return (
    <div>
      <div className="mb-6">
        {onNavigate && (
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Main Menu
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Wrench className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
            <p className="text-sm text-gray-600">Log and track service and maintenance records for your vehicles</p>
          </div>
        </div>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by registration, make, or model..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Truck className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">No vehicles found.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => (
            <button
              key={vehicle.id}
              onClick={() => handleVehicleClick(vehicle)}
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{vehicle.registration_number}</h3>
                  <p className="text-xs text-gray-500">{vehicle.make} {vehicle.model}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Last Service: {formatDate(vehicle.last_service_date || '')}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Next Service KM: {vehicle.next_service_km ? vehicle.next_service_km.toLocaleString() : '-'}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


export default MaintenanceManagement