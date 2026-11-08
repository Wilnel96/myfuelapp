import { useState, useEffect, useCallback } from 'react';
import { CalendarClock, Plus, X, Trash2, CheckCircle2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  MAINTENANCE_TYPE_OPTIONS,
  getMaintenanceItems,
  type MaintenanceType,
} from '../lib/maintenanceItems';

interface ScheduledMaintenance {
  id: string;
  maintenance_type: MaintenanceType;
  description: string;
  scheduled_date: string;
  workshop: string | null;
  maintenance_items: string[] | null;
}

interface ScheduledMaintenanceSectionProps {
  vehicleId: string;
  organizationId: string;
}

const TYPE_LABELS = Object.fromEntries(
  MAINTENANCE_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<MaintenanceType, string>;

const toLocalIsoDate = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

const tomorrowIso = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toLocalIsoDate(date);
};

const emptyForm = () => ({
  maintenance_type: 'service' as MaintenanceType,
  maintenance_items: [] as string[],
  custom_item_description: '',
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
      .select('id, maintenance_type, description, scheduled_date, workshop, maintenance_items')
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

  const handleTypeChange = (type: MaintenanceType) => {
    setFormData(prev => ({ ...prev, maintenance_type: type, maintenance_items: [], custom_item_description: '' }));
  };

  const toggleItem = (item: string) => {
    setFormData(prev => ({
      ...prev,
      maintenance_items: prev.maintenance_items.includes(item)
        ? prev.maintenance_items.filter(i => i !== item)
        : [...prev.maintenance_items, item],
    }));
  };

  const availableItems = getMaintenanceItems(formData.maintenance_type);
  const isOtherSelected = formData.maintenance_items.includes('Other');

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.scheduled_date) return;
    if (formData.scheduled_date < tomorrowIso()) {
      alert('Scheduled maintenance must be on a future date.');
      return;
    }

    const itemsForSave = [...formData.maintenance_items];
    if (itemsForSave.includes('Other') && formData.custom_item_description.trim()) {
      itemsForSave[itemsForSave.indexOf('Other')] = `Other: ${formData.custom_item_description.trim()}`;
    }

    const description = formData.description.trim() || itemsForSave.join(', ');
    if (!description) {
      alert('Select at least one maintenance item or enter a description.');
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
          maintenance_items: itemsForSave.length > 0 ? itemsForSave : null,
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
                {item.maintenance_items && item.maintenance_items.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.maintenance_items.map((name) => (
                      <span key={name} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs whitespace-nowrap">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Schedule Maintenance</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSchedule} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Type</label>
                <select
                  value={formData.maintenance_type}
                  onChange={(e) => handleTypeChange(e.target.value as MaintenanceType)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {MAINTENANCE_TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

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
                {isOtherSelected && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Describe "Other"</label>
                    <input
                      type="text"
                      value={formData.custom_item_description}
                      onChange={(e) => setFormData({ ...formData, custom_item_description: e.target.value.toUpperCase() })}
                      placeholder="Enter a description for the custom maintenance item"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                  <span className="text-gray-400 font-normal ml-1">
                    {formData.maintenance_items.length > 0 ? '(auto-filled from items if left blank)' : '*'}
                  </span>
                </label>
                <input
                  type="text"
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
              <div className="flex gap-3 pt-2 flex-shrink-0">
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
