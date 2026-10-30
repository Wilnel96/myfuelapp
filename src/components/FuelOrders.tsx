import { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, X, AlertCircle, CheckCircle, Ban, Fuel, ArrowLeft, Mail, Printer, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildFuelOrderPdf, type FuelOrderPdfData } from '../lib/fuelOrderPdf';
import GarageSearchSelect from './GarageSearchSelect';
import EmailFuelOrderModal from './EmailFuelOrderModal';

interface Vehicle {
  id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  fuel_type: string | null;
}

interface Garage {
  id: string;
  name: string;
  city: string | null;
  fuel_prices: Record<string, number> | null;
}

interface FuelOrder {
  id: string;
  system_order_number: string;
  client_order_number: string | null;
  vehicle_id: string;
  garage_id: string;
  fuel_type: string;
  item_type: 'fuel' | 'oil' | 'other';
  item_description: string | null;
  order_type: 'single' | 'multiple';
  liters_ordered: number;
  liters_used: number;
  price_per_liter: number;
  status: 'open' | 'fulfilled' | 'cancelled';
  exceeded: boolean;
  created_at: string;
}

interface FuelOrdersProps {
  onNavigate?: (view: string) => void;
}

const STATUS_STYLES: Record<FuelOrder['status'], { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-green-100 text-green-800' },
  fulfilled: { label: 'Fulfilled', className: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-200 text-gray-700' },
};

const ORDER_TYPE_LABELS: Record<FuelOrder['order_type'], string> = {
  single: 'Single refuel',
  multiple: 'Multiple refuel',
};

export default function FuelOrders({ onNavigate }: FuelOrdersProps) {
  const [orgId, setOrgId] = useState('');
  const [orders, setOrders] = useState<FuelOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingOrder, setEditingOrder] = useState<FuelOrder | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [emailTarget, setEmailTarget] = useState<FuelOrderPdfData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.organization_id) throw new Error('No organization found');
      setOrgId(profile.organization_id);

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .maybeSingle();
      if (orgError) throw orgError;
      setOrganizationName(org?.name || '');

      const [ordersRes, vehiclesRes, garagesRes] = await Promise.all([
        supabase
          .from('fuel_orders')
          .select('id, system_order_number, client_order_number, vehicle_id, garage_id, fuel_type, item_type, item_description, order_type, liters_ordered, liters_used, price_per_liter, status, exceeded, created_at')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('vehicles')
          .select('id, registration_number, make, model, fuel_type')
          .eq('organization_id', profile.organization_id)
          .is('deleted_at', null)
          .order('registration_number'),
        supabase
          .from('garages')
          .select('id, name, city, fuel_prices')
          .order('name'),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (garagesRes.error) throw garagesRes.error;

      setOrders((ordersRes.data || []) as FuelOrder[]);
      setVehicles((vehiclesRes.data || []) as Vehicle[]);
      setGarages((garagesRes.data || []) as Garage[]);
    } catch (err: any) {
      console.error('Error loading fuel orders:', err);
      setError(err.message || 'Failed to load fuel orders');
    } finally {
      setLoading(false);
    }
  };

  const vehicleLabel = (vehicleId: string) => {
    const v = vehicles.find(x => x.id === vehicleId);
    if (!v) return 'Unknown vehicle';
    return [v.registration_number, v.make, v.model].filter(Boolean).join(' - ');
  };

  const garageLabel = (garageId: string) => {
    const g = garages.find(x => x.id === garageId);
    if (!g) return 'Unknown garage';
    return g.city ? `${g.name} - ${g.city}` : g.name;
  };

  const buildOrderData = (order: FuelOrder): FuelOrderPdfData => ({
    systemOrderNumber: order.system_order_number,
    clientOrderNumber: order.client_order_number,
    organizationName,
    vehicleLabel: vehicleLabel(order.vehicle_id),
    garageLabel: garageLabel(order.garage_id),
    fuelType: order.fuel_type,
    orderType: order.order_type,
    litersOrdered: Number(order.liters_ordered),
    litersUsed: Number(order.liters_used),
    pricePerLiter: Number(order.price_per_liter),
    status: order.status,
    createdAt: order.created_at,
  });

  const handlePrint = (order: FuelOrder) => {
    const pdfUrl = URL.createObjectURL(buildFuelOrderPdf(buildOrderData(order)).output('blob'));
    const printWindow = window.open(pdfUrl, '_blank');
    if (!printWindow) {
      URL.revokeObjectURL(pdfUrl);
      setError('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      return;
    }
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 500);
    };
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  };

  const handleCancel = async (order: FuelOrder) => {
    if (!window.confirm(`Cancel order ${order.client_order_number || order.system_order_number}?`)) return;
    try {
      setCancellingId(order.id);
      setError('');
      const { data, error: cancelError } = await supabase
        .from('fuel_orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)
        .eq('status', 'open')
        .select('id')
        .maybeSingle();

      if (cancelError) throw cancelError;
      if (!data) throw new Error('This order can no longer be cancelled');

      setSuccessMessage(`Order ${order.client_order_number || order.system_order_number} was cancelled.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  const handleSaved = (message: string) => {
    setShowCreate(false);
    setEditingOrder(null);
    setSuccessMessage(message);
    loadData();
  };

  if (showCreate || editingOrder) {
    return (
      <FuelOrderForm
        organizationId={orgId}
        existingOrder={editingOrder}
        vehicles={vehicles}
        garages={garages}
        onCancel={() => { setShowCreate(false); setEditingOrder(null); }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fuel Orders</h1>
            <p className="text-sm text-gray-600">Purchase orders for refuels at a specific garage</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('invoices-menu')}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-3 py-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            disabled={loading || vehicles.length === 0 || garages.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-green-700 hover:text-green-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-xl">
          <Fuel className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="font-medium text-gray-700">No fuel orders yet</p>
          <p className="text-sm text-gray-500 mt-1">Create an order so a driver can refuel against it.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const status = STATUS_STYLES[order.status];
            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">
                        {order.client_order_number || order.system_order_number}
                      </p>
                      {order.client_order_number && (
                        <span className="text-xs text-gray-500">System: {order.system_order_number}</span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                      {order.exceeded && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Exceeded
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{vehicleLabel(order.vehicle_id)}</p>
                    <p className="text-sm text-gray-600">{garageLabel(order.garage_id)}</p>
                    <p className="text-sm text-gray-600">
                      {order.item_type === 'fuel'
                        ? `${ORDER_TYPE_LABELS[order.order_type]} - ${Number(order.liters_ordered).toFixed(2)} L ${order.fuel_type} at R ${Number(order.price_per_liter).toFixed(2)}/L`
                        : `${order.item_description || (order.item_type === 'oil' ? 'Oil' : 'Other goods')} - ${Number(order.liters_ordered).toFixed(0)} units at R ${Number(order.price_per_liter).toFixed(2)} each`}
                    </p>
                    {order.status === 'fulfilled' && (
                      <p className="text-xs text-gray-500">Refuelled: {Number(order.liters_used).toFixed(2)} L</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 self-start flex-wrap">
                    <button
                      onClick={() => handlePrint(order)}
                      className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                    <button
                      onClick={() => setEmailTarget(buildOrderData(order))}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </button>
                    {order.status === 'open' && (
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    {order.status === 'open' && (
                      <button
                        onClick={() => handleCancel(order)}
                        disabled={cancellingId === order.id}
                        className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                      >
                        <Ban className="w-4 h-4" />
                        {cancellingId === order.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {emailTarget && (
        <EmailFuelOrderModal
          order={emailTarget}
          onClose={() => setEmailTarget(null)}
          onSent={setSuccessMessage}
        />
      )}
    </div>
  );
}

const GOODS_TYPE_OPTIONS: { value: 'fuel' | 'oil' | 'other'; label: string }[] = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'oil', label: 'Oil' },
  { value: 'other', label: 'Other goods' },
];

const OIL_TYPE_OPTIONS = ['Engine oil', 'Brake fluid', 'Transmission oil', 'Coolant', 'Other'];

interface FuelOrderFormProps {
  organizationId: string;
  existingOrder: FuelOrder | null;
  vehicles: Vehicle[];
  garages: Garage[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}

function FuelOrderForm({ organizationId, existingOrder, vehicles, garages, onCancel, onSaved }: FuelOrderFormProps) {
  const isEdit = existingOrder !== null;
  const [vehicleId, setVehicleId] = useState(existingOrder?.vehicle_id ?? '');
  const [garageId, setGarageId] = useState(existingOrder?.garage_id ?? '');
  const [orderType, setOrderType] = useState<'single' | 'multiple'>(existingOrder?.order_type ?? 'single');
  const [itemType, setItemType] = useState<'fuel' | 'oil' | 'other'>(existingOrder?.item_type ?? 'fuel');
  const [itemDescription, setItemDescription] = useState(existingOrder?.item_description ?? '');
  const [unitPrice, setUnitPrice] = useState(existingOrder && existingOrder.item_type !== 'fuel' ? String(Number(existingOrder.price_per_liter)) : '');
  const isFuel = itemType === 'fuel';
  const [liters, setLiters] = useState(existingOrder ? String(Number(existingOrder.liters_ordered)) : '');
  const [clientOrderNumber, setClientOrderNumber] = useState(existingOrder?.client_order_number ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedVehicle = vehicles.find(v => v.id === vehicleId) || null;
  const selectedGarage = garages.find(g => g.id === garageId) || null;

  const pricePerLiter = useMemo(() => {
    if (!selectedVehicle?.fuel_type || !selectedGarage) return null;
    const price = selectedGarage.fuel_prices?.[selectedVehicle.fuel_type];
    return typeof price === 'number' && price > 0 ? price : null;
  }, [selectedVehicle, selectedGarage]);

  const parsedUnitPrice = parseFloat(unitPrice);
  const effectivePrice = isFuel ? pricePerLiter : Number.isFinite(parsedUnitPrice) && parsedUnitPrice > 0 ? parsedUnitPrice : null;

  const litersValue = parseFloat(liters);
  const validLiters = Number.isFinite(litersValue) && litersValue > 0;
  const estimatedTotal = effectivePrice !== null && validLiters ? litersValue * effectivePrice : null;
  const hasItemDetails = isFuel || itemDescription.trim() !== '';
  const canSubmit = !!vehicleId && !!garageId && validLiters && effectivePrice !== null && hasItemDetails && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedVehicle || effectivePrice === null) return;

    try {
      setSubmitting(true);
      setError('');

      const details = {
        vehicle_id: selectedVehicle.id,
        garage_id: garageId,
        fuel_type: isFuel ? selectedVehicle.fuel_type : itemType,
        order_type: isFuel ? orderType : 'single',
        liters_ordered: litersValue,
        price_per_liter: effectivePrice,
        item_type: itemType,
        item_description: isFuel ? null : itemDescription.trim(),
        client_order_number: clientOrderNumber.trim() || null,
      };

      if (existingOrder) {
        const { data, error: updateError } = await supabase
          .from('fuel_orders')
          .update(details)
          .eq('id', existingOrder.id)
          .eq('status', 'open')
          .select('id')
          .maybeSingle();

        if (updateError) throw updateError;
        if (!data) throw new Error('This order can no longer be edited');
        onSaved(`Order ${details.client_order_number || existingOrder.system_order_number} was updated.`);
        return;
      }

      const { data, error: insertError } = await supabase
        .from('fuel_orders')
        .insert({ ...details, organization_id: organizationId })
        .select('system_order_number')
        .single();

      if (insertError) throw insertError;
      onSaved(`Order ${data.system_order_number} was created.`);
    } catch (err: any) {
      console.error('Error saving fuel order:', err);
      setError(err.message || 'Failed to save order');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full border border-gray-300 rounded-lg px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? `Edit ${existingOrder.client_order_number || existingOrder.system_order_number}` : 'New Fuel Order'}
        </h1>
        <button onClick={onCancel} className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-3 py-2 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={inputClass} required>
            <option value="">Select a vehicle</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {[v.registration_number, v.make, v.model].filter(Boolean).join(' - ')} {v.fuel_type ? `(${v.fuel_type})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Garage</label>
          <GarageSearchSelect garages={garages} value={garageId} onChange={setGarageId} inputClassName={inputClass} />
          <p className="text-xs text-gray-500 mt-1">The driver must refuel at this garage for the order to apply.</p>
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">What are you ordering?</p>
          <div className="grid grid-cols-3 gap-3">
            {GOODS_TYPE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => { setItemType(option.value); setItemDescription(''); }}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  itemType === option.value ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <p className="font-semibold text-sm">{option.label}</p>
              </button>
            ))}
          </div>
        </div>

        {isFuel && (
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Order type</p>
          <div className="grid grid-cols-2 gap-3">
            {(['single', 'multiple'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  orderType === type ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <p className="font-semibold text-sm">{ORDER_TYPE_LABELS[type]}</p>
                <p className="text-xs mt-0.5 opacity-80">
                  {type === 'single' ? 'One fill-up, then the order closes.' : 'Fill-ups until the ordered litres are used, then the order closes.'}
                </p>
              </button>
            ))}
          </div>
        </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{isFuel ? 'Litres' : 'Units'}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            className={inputClass}
            placeholder="50.00"
            required
          />
        </div>

        {!isFuel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {itemType === 'oil' ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Oil type</label>
                  <select value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} className={inputClass} required>
                    <option value="">Select oil type</option>
                    {OIL_TYPE_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Describe the goods</label>
                  <input
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    maxLength={100}
                    className={inputClass}
                    placeholder="e.g. Windscreen washer fluid"
                    required
                  />
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per unit (R)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className={inputClass}
                placeholder="0.00"
                required
              />
            </div>
          </div>
        )}

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">{isFuel ? 'Price per litre' : 'Price per unit'}</p>
            <p className="text-base font-semibold text-gray-900">
              {effectivePrice !== null ? `R ${effectivePrice.toFixed(2)}` : isFuel && selectedVehicle && selectedGarage ? 'Not listed' : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Estimated total</p>
            <p className="text-base font-semibold text-gray-900">{estimatedTotal !== null ? `R ${estimatedTotal.toFixed(2)}` : '-'}</p>
          </div>
          {isFuel && selectedVehicle && selectedGarage && pricePerLiter === null && (
            <p className="col-span-2 text-xs text-amber-700">
              This garage has no {selectedVehicle.fuel_type || ''} price listed, so the order cannot be placed here.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client order number <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={clientOrderNumber}
            onChange={(e) => setClientOrderNumber(e.target.value)}
            maxLength={100}
            className={inputClass}
            placeholder="Leave blank to use the system order number"
          />
          <p className="text-xs text-gray-500 mt-1">If entered, this number is printed on the invoice instead of the system number.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
