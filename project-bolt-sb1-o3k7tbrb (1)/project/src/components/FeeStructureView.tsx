import { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, TrendingUp, Calendar, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FeeStructure {
  monthly_fee_per_vehicle: number | null;
  daily_spending_limit: number | null;
  monthly_spending_limit: number | null;
  payment_method: string | null;
  payment_date: number | null;
  payment_terms: string | null;
  late_payment_interest_rate: number | null;
}

interface FeeStructureViewProps {
  onNavigate?: (view: string) => void;
}

export default function FeeStructureView({ onNavigate }: FeeStructureViewProps = {}) {
  const [feeStructure, setFeeStructure] = useState<FeeStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFeeStructure();
  }, []);

  const loadFeeStructure = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organization not found');

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('monthly_fee_per_vehicle, daily_spending_limit, monthly_spending_limit, payment_method, payment_date, payment_terms, late_payment_interest_rate')
        .eq('id', profile.organization_id)
        .single();

      if (orgError) throw orgError;

      setFeeStructure(org);
    } catch (err: any) {
      setError('Failed to load fee structure: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return 'Not set';
    return `R ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">Loading fee structure...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="-my-6">
      <div className="sticky top-0 z-10 bg-white -mx-4 px-4 py-6 pb-4 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-orange-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Fee Structure, Spending Limits and Payment Terms</h2>
              <p className="text-gray-600 text-sm">(View Only)</p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('management-org-menu')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Management Organization Info
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Monthly Fee Per Vehicle</label>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(feeStructure?.monthly_fee_per_vehicle)}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Daily Fuel Spent Limit</label>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(feeStructure?.daily_spending_limit)}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Monthly Fuel Spent Limit</label>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(feeStructure?.monthly_spending_limit)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
        <div className="px-4 py-3">
          <h3 className="text-base font-bold text-gray-900">Payment Terms</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Payment Method</label>
            <p className="text-xl font-bold text-gray-900">{feeStructure?.payment_method || 'Not set'}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Payment Terms</label>
            <p className="text-xl font-bold text-gray-900">{feeStructure?.payment_terms || 'Not set'}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Payment Date</label>
            <p className="text-xl font-bold text-gray-900">
              {feeStructure?.payment_date ? `Day ${feeStructure.payment_date} of each month` : 'Not set'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Late Payment Interest Rate</label>
            <p className="text-xl font-bold text-gray-900">
              {feeStructure?.late_payment_interest_rate !== null && feeStructure?.late_payment_interest_rate !== undefined
                ? `${feeStructure.late_payment_interest_rate}%`
                : 'Not set'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-1">Information</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>The monthly fee per vehicle is charged for each active vehicle in your fleet</li>
              <li>Daily spending limits apply to all fuel purchases made by your organization in a single day</li>
              <li>Monthly spending limits apply to total fuel purchases across the entire month</li>
              <li>Payment terms define when invoices are due after issuance</li>
              <li>Payment date indicates the day of the month when payment is expected</li>
              <li>Late payment interest applies to overdue invoices</li>
              <li>These values and terms can only be modified by your management organization</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
