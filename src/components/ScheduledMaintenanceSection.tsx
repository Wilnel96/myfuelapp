import { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, X, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type MaintenanceType = 'service' | 'other' | 'license_renewal' | 'insurance';

interface ScheduledMaintenance {
  id: string;
  maintenance_type: MaintenanceType;
  description: string;
  scheduled_date: string;
  workshop: string | null;
}

interface ScheduledMaintenanceSectionProps {
  vehicleId: string;
  organizationId: string;
}

const TYPE_LABELS: Record<MaintenanceType, string> = {
  service: 'Service',
  other: 'Other Maintenance',
  license_renewal: 'License Renewal',
  insurance: 'Insurance',
};

const toLocalIsoDate = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

const tomorrowIso = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toLocalIsoDate(date);
};

const emptyForm = () => ({
  maintenance_type: 'service' as MaintenanceType,
  description: '',
  scheduled_date: tomorrowIso(),
  workshop: '',
});

const formatDate = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ScheduledMaintenanceSection({ vehicleId, organizationId }: ScheduledMaintenanceSectionProps) {
  const [items, setItems] = useState<ScheduledMaintenance[]>([]);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadScheduled = useCallback(async () => {
    const { data, error } = await supabase
      .from('vehicle_scheduled_maintenance')
      .select('id, maintenance_type, description, scheduled_date, workshop')
      .eq('vehicle_id', vehicleId)
      .eq('status', 'scheduled')
      .order('scheduled_date');

    if (error) {
      setLoadError('Could not load scheduled maintenance.');
      return;
    }
    setLoadError('');
    setItems(data || []);
  }, [vehicleId]);

  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  const closeForm = () => {
    setShowForm(false);
    setFormData(emptyForm());
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const description = formData.description.trim();
    if (!description || !formData.scheduled_date) return;
    if (formData.scheduled_date < tomorrowIso()) {
      alert('Scheduled maintenance must be on a future date.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('vehicle_scheduled_maintenance')
        .insert({
          vehicle_id: vehicleId,
          organization_id: organizationId,
          maintenance_type: formData.maintenance_type,
          description,
          scheduled_date: formData.scheduled_date,
          workshop: formData.workshop.trim() || null,
          created_by: user?.id ?? null,
        });

      if (error) {
        alert(`Failed to schedule maintenance: ${error.message}`);
        return;
      }

      closeForm();
      await loadScheduled();
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDone = async (id: string) => {
    const { error } = await supabase
      .from('vehicle_scheduled_maintenance')
      .update({ status: 'completed' })
      .eq('id', id);

    if (error) {
      alert(`Failed to update: ${error.message}`);
      return;
    }
    await loadScheduled();
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this scheduled maintenance? No reminder will be sent for it.')) return;

    const { error } = await supabase
      .from('vehicle_scheduled_maintenance')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Failed to remove: ${error.message}`);
      return;
    }
    await loadScheduled();
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 mb-6">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-blue-600" />
          Scheduled Maintenance
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule
        </button>
      </div>

      {loadError ? (
        <p className="p-6 text-sm text-red-600">{loadError}</p>
      ) : items.length === 0 ? (
        <p className="p-6 text-sm text-gray-500">
          Nothing scheduled. Use "Schedule" to book a future service or job; the client is emailed the day before.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <li key={item.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{formatDate(item.scheduled_date)}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {TYPE_LABELS[item.maintenance_type]}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1 truncate">{item.description}</p>
                {item.workshop && <p className="text-xs text-gray-500 mt-0.5">{item.workshop}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMarkDone(item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark done
                </button>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove scheduled maintenance"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Schedule Maintenance</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSchedule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Type</label>
                <select
                  value={formData.maintenance_type}
                  onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value as MaintenanceType })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {(Object.keys(TYPE_LABELS) as MaintenanceType[]).map((type) => (
                    <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
                <input
                  type="date"
                  required
                  min={tomorrowIso()}
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value.toUpperCase() })}
                  placeholder="e.g. 45,000 KM SERVICE"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workshop / Service Provider</label>
                <input
                  type="text"
                  value={formData.workshop}
                  onChange={(e) => setFormData({ ...formData, workshop: e.target.value.toUpperCase() })}
                  placeholder="e.g. ABC MOTORS"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {saving ? 'Saving...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
