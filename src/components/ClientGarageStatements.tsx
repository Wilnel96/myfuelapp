import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Store, FileText, Plus, Eye, Printer, ArrowLeft,
  Receipt, AlertCircle, CheckCircle, Wallet, ChevronDown, ChevronUp
} from 'lucide-react';

interface GarageAccount {
  garage_id: string;
  garage_name: string;
  garage_city: string;
  garage_province: string;
  account_number: string;
  monthly_spend_limit: number;
  deposit_amount: number;
  is_active: boolean;
}

interface GarageStatement {
  id: string;
  garage_id: string;
  organization_id: string;
  statement_number: string;
  statement_date: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  total_invoices: number;
  total_payments: number;
  closing_balance: number;
}

interface GaragePayment {
  id: string;
  payment_number: string;
  garage_id: string;
  organization_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
}

interface StatementInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  transaction_date: string;
  vehicle_registration: string;
  driver_name: string;
  fuel_type: string;
  liters: number;
  price_per_liter: number;
  total_amount: number;
  odometer_reading: number;
  oil_type: string | null;
  oil_quantity: number;
  oil_total_amount: number;
  payment_option: string | null;
}

interface StatementPayment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
}

const currency = (val: number | null | undefined) => {
  if (val === null || val === undefined || isNaN(val)) return 'R 0.00';
  return `R ${Number(val).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (d: string) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function ClientGarageStatements({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string>('');
  const [garageAccounts, setGarageAccounts] = useState<GarageAccount[]>([]);
  const [selectedGarage, setSelectedGarage] = useState<GarageAccount | null>(null);
  const [statements, setStatements] = useState<GarageStatement[]>([]);
  const [payments, setPayments] = useState<GaragePayment[]>([]);
  const [viewingStatement, setViewingStatement] = useState<GarageStatement | null>(null);
  const [statementInvoices, setStatementInvoices] = useState<StatementInvoice[]>([]);
  const [statementPayments, setStatementPayments] = useState<StatementPayment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [expandedGarage, setExpandedGarage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add payment form
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('eft');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Not authenticated'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        setError('No organization found for your account');
        return;
      }
      setOrgId(profile.organization_id);

      // Get all garage accounts for this org, with garage details
      const { data: accounts, error: acctError } = await supabase
        .from('organization_garage_accounts')
        .select(`
          garage_id,
          account_number,
          monthly_spend_limit,
          deposit_amount,
          is_active,
          garages!inner(name, city, province)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true });

      if (acctError) throw acctError;

      const mapped: GarageAccount[] = (accounts || []).map((a: any) => ({
        garage_id: a.garage_id,
        garage_name: a.garages?.name || 'Unknown Garage',
        garage_city: a.garages?.city || '',
        garage_province: a.garages?.province || '',
        account_number: a.account_number || '',
        monthly_spend_limit: a.monthly_spend_limit || 0,
        deposit_amount: a.deposit_amount || 0,
        is_active: a.is_active,
      }));

      setGarageAccounts(mapped);

      if (mapped.length > 0) {
        setExpandedGarage(mapped[0].garage_id);
        await loadGarageData(mapped[0].garage_id, profile.organization_id);
      }
    } catch (err: any) {
      console.error('Error loading garage statements:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadGarageData = async (garageId: string, organizationId: string) => {
    try {
      const [stmtResult, payResult] = await Promise.all([
        supabase
          .from('garage_statements')
          .select('*')
          .eq('garage_id', garageId)
          .eq('organization_id', organizationId)
          .order('statement_date', { ascending: false }),
        supabase
          .from('garage_debtor_payments')
          .select('*')
          .eq('garage_id', garageId)
          .eq('organization_id', organizationId)
          .order('payment_date', { ascending: false }),
      ]);

      if (stmtResult.error) throw stmtResult.error;
      if (payResult.error) throw payResult.error;

      setStatements(stmtResult.data || []);
      setPayments(payResult.data || []);
    } catch (err: any) {
      console.error('Error loading garage data:', err);
      setError(err.message);
    }
  };

  const handleSelectGarage = async (garage: GarageAccount) => {
    setSelectedGarage(garage);
    setViewingStatement(null);
    setShowAddPayment(false);
    await loadGarageData(garage.garage_id, orgId);
  };

  const handleViewStatement = async (stmt: GarageStatement) => {
    setViewingStatement(stmt);
    setLoadingDetails(true);
    try {
      const [invResult, payResult] = await Promise.all([
        supabase.rpc('get_statement_invoices', {
          p_garage_id: stmt.garage_id,
          p_organization_id: stmt.organization_id,
          p_period_start: stmt.period_start,
          p_period_end: stmt.period_end,
        }),
        supabase.rpc('get_statement_payments', {
          p_garage_id: stmt.garage_id,
          p_organization_id: stmt.organization_id,
          p_period_start: stmt.period_start,
          p_period_end: stmt.period_end,
        }),
      ]);

      if (invResult.error) throw invResult.error;
      if (payResult.error) throw payResult.error;

      setStatementInvoices(invResult.data || []);
      setStatementPayments(payResult.data || []);
    } catch (err: any) {
      console.error('Error loading statement details:', err);
      setError(err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }

    const targetGarage = selectedGarage || garageAccounts.find(g => g.garage_id === expandedGarage);
    if (!targetGarage) {
      setError('No garage selected');
      return;
    }

    setSubmitting(true);
    try {
      const { data: payNum, error: numError } = await supabase.rpc('generate_payment_number', {
        p_garage_id: targetGarage.garage_id,
        p_organization_id: orgId,
      });

      if (numError || !payNum) throw new Error('Failed to generate payment number');

      const { error: insertError } = await supabase
        .from('garage_debtor_payments')
        .insert({
          payment_number: payNum,
          garage_id: targetGarage.garage_id,
          organization_id: orgId,
          payment_date: payDate,
          amount,
          payment_method: payMethod,
          reference: payReference || null,
          notes: payNotes || null,
        });

      if (insertError) throw insertError;

      setSuccess('Payment recorded successfully');
      setShowAddPayment(false);
      setPayAmount('');
      setPayReference('');
      setPayNotes('');
      setPayMethod('eft');

      await loadGarageData(targetGarage.garage_id, orgId);
    } catch (err: any) {
      console.error('Error adding payment:', err);
      setError(err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const printStatement = () => {
    if (!viewingStatement) return;
    window.print();
  };

  // Summary is computed per-garage in the render loop below
  const currentGarage = selectedGarage || garageAccounts.find(g => g.garage_id === expandedGarage);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Statement detail view
  if (viewingStatement && currentGarage) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <button
            onClick={() => setViewingStatement(null)}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Statements
          </button>
          <button
            onClick={printStatement}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            Print Statement
          </button>
        </div>

        {loadingDetails ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto">
            {/* Statement header */}
            <div className="border-b-2 border-gray-800 pb-4 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">ACCOUNT STATEMENT</h1>
                  <p className="text-gray-600 mt-1">{currentGarage.garage_name}</p>
                  {currentGarage.garage_city && (
                    <p className="text-sm text-gray-500">{currentGarage.garage_city}{currentGarage.garage_province ? `, ${currentGarage.garage_province}` : ''}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Statement No.</p>
                  <p className="font-semibold text-gray-900">{viewingStatement.statement_number}</p>
                  <p className="text-sm text-gray-500 mt-2">Date: {formatDate(viewingStatement.statement_date)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Period:</span>{' '}
                  <span className="font-medium text-gray-900">{formatDate(viewingStatement.period_start)} — {formatDate(viewingStatement.period_end)}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500">Account:</span>{' '}
                  <span className="font-medium text-gray-900">{currentGarage.account_number || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Balance summary */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Opening Balance</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{currency(viewingStatement.opening_balance)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-red-600 uppercase tracking-wide">Total Invoices</p>
                <p className="text-lg font-semibold text-red-700 mt-1">{currency(viewingStatement.total_invoices)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 uppercase tracking-wide">Total Payments</p>
                <p className="text-lg font-semibold text-green-700 mt-1">{currency(viewingStatement.total_payments)}</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${viewingStatement.closing_balance > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                <p className={`text-xs uppercase tracking-wide ${viewingStatement.closing_balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>Closing Balance</p>
                <p className={`text-lg font-semibold mt-1 ${viewingStatement.closing_balance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {currency(viewingStatement.closing_balance)}
                </p>
              </div>
            </div>

            {/* Invoices table */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Fuel Purchases & Invoices
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Date</th>
                      <th className="text-left py-2 px-3 font-medium">Invoice #</th>
                      <th className="text-left py-2 px-3 font-medium">Vehicle</th>
                      <th className="text-right py-2 px-3 font-medium">Liters</th>
                      <th className="text-right py-2 px-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {statementInvoices.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-6 text-gray-400">No invoices in this period</td></tr>
                    ) : statementInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-700">{formatDate(inv.transaction_date)}</td>
                        <td className="py-2 px-3 text-gray-700 font-mono text-xs">{inv.invoice_number}</td>
                        <td className="py-2 px-3 text-gray-700">{inv.vehicle_registration}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{Number(inv.liters).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-medium text-gray-900">{currency(inv.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {statementInvoices.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={4} className="py-2 px-3 text-right text-gray-700">Total Invoices:</td>
                        <td className="py-2 px-3 text-right text-gray-900">{currency(statementInvoices.reduce((s, i) => s + Number(i.total_amount), 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Payments table */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-600" />
                Payments Made
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Date</th>
                      <th className="text-left py-2 px-3 font-medium">Payment #</th>
                      <th className="text-left py-2 px-3 font-medium">Method</th>
                      <th className="text-left py-2 px-3 font-medium">Reference</th>
                      <th className="text-right py-2 px-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {statementPayments.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-6 text-gray-400">No payments in this period</td></tr>
                    ) : statementPayments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-700">{formatDate(pay.payment_date)}</td>
                        <td className="py-2 px-3 text-gray-700 font-mono text-xs">{pay.payment_number}</td>
                        <td className="py-2 px-3 text-gray-700 uppercase">{pay.payment_method}</td>
                        <td className="py-2 px-3 text-gray-700">{pay.reference || '—'}</td>
                        <td className="py-2 px-3 text-right font-medium text-green-700">{currency(pay.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {statementPayments.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={4} className="py-2 px-3 text-right text-gray-700">Total Payments:</td>
                        <td className="py-2 px-3 text-right text-green-700">{currency(statementPayments.reduce((s, p) => s + Number(p.amount), 0))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Add payment form
  if (showAddPayment && currentGarage) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Record Payment to {currentGarage.garage_name}</h2>
          <button
            onClick={() => setShowAddPayment(false)}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleAddPayment} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (R)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="eft">EFT / Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference (optional)</label>
            <input
              type="text"
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="EFT ref, cheque no, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Recording...' : 'Record Payment'}
          </button>
        </form>
      </div>
    );
  }

  // Main view: garage list + statements/payments for selected garage
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-6 h-6 text-gray-700" />
          <h1 className="text-xl font-bold text-gray-900">Garage Statements & Payments</h1>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('invoices-menu')}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {garageAccounts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">You don't have any garage accounts yet.</p>
          <p className="text-sm text-gray-400 mt-1">Garage accounts are set up by your fuel provider.</p>
        </div>
      ) : (
        <>
          {/* Garage account cards */}
          <div className="space-y-2">
            {garageAccounts.map((ga) => {
              const isExpanded = expandedGarage === ga.garage_id;
              const garageStatements = statements.filter(s => s.garage_id === ga.garage_id);
              const garagePayments = payments.filter(p => p.garage_id === ga.garage_id);
              const garageBalance = garageStatements.length > 0 ? garageStatements[0].closing_balance : 0;

              return (
                <div key={ga.garage_id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => {
                      setExpandedGarage(isExpanded ? null : ga.garage_id);
                      if (!isExpanded) handleSelectGarage(ga);
                    }}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-teal-50 rounded-lg">
                        <Store className="w-6 h-6 text-teal-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">{ga.garage_name}</h3>
                        <p className="text-sm text-gray-500">
                          {ga.garage_city && `${ga.garage_city} · `}
                          {garageStatements.length} statement{garageStatements.length !== 1 ? 's' : ''} ·{' '}
                          {garagePayments.length} payment{garagePayments.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Balance</p>
                        <p className={`font-semibold ${garageBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                          {currency(garageBalance)}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-4">
                      {/* Summary cards */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-blue-600 uppercase tracking-wide">Statements</p>
                          <p className="text-xl font-semibold text-blue-700 mt-1">{garageStatements.length}</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-green-600 uppercase tracking-wide">Total Paid</p>
                          <p className="text-xl font-semibold text-green-700 mt-1">{currency(garagePayments.reduce((s, p) => s + Number(p.amount), 0))}</p>
                        </div>
                        <div className={`rounded-lg p-3 text-center ${garageBalance > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                          <p className={`text-xs uppercase tracking-wide ${garageBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {garageBalance > 0 ? 'Owing' : 'Balance'}
                          </p>
                          <p className={`text-xl font-semibold mt-1 ${garageBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                            {currency(Math.abs(garageBalance))}
                          </p>
                        </div>
                      </div>

                      {/* Record payment button */}
                      <button
                        onClick={() => {
                          setSelectedGarage(ga);
                          setShowAddPayment(true);
                          setError('');
                          setSuccess('');
                        }}
                        className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                        Record Payment to {ga.garage_name}
                      </button>

                      {/* Statements table */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Statements Received
                        </h4>
                        {garageStatements.length === 0 ? (
                          <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-lg">No statements received yet</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100 text-gray-600">
                                <tr>
                                  <th className="text-left py-2 px-3 font-medium">Statement #</th>
                                  <th className="text-left py-2 px-3 font-medium">Date</th>
                                  <th className="text-left py-2 px-3 font-medium">Period</th>
                                  <th className="text-right py-2 px-3 font-medium">Invoices</th>
                                  <th className="text-right py-2 px-3 font-medium">Payments</th>
                                  <th className="text-right py-2 px-3 font-medium">Closing</th>
                                  <th className="text-center py-2 px-3 font-medium">View</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {garageStatements.map((stmt) => (
                                  <tr key={stmt.id} className="hover:bg-gray-50">
                                    <td className="py-2 px-3 font-mono text-xs text-gray-700">{stmt.statement_number}</td>
                                    <td className="py-2 px-3 text-gray-700">{formatDate(stmt.statement_date)}</td>
                                    <td className="py-2 px-3 text-gray-600 text-xs">{formatDate(stmt.period_start)} — {formatDate(stmt.period_end)}</td>
                                    <td className="py-2 px-3 text-right text-red-700">{currency(stmt.total_invoices)}</td>
                                    <td className="py-2 px-3 text-right text-green-700">{currency(stmt.total_payments)}</td>
                                    <td className={`py-2 px-3 text-right font-semibold ${stmt.closing_balance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                      {currency(stmt.closing_balance)}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        onClick={() => handleViewStatement(stmt)}
                                        className="text-blue-600 hover:text-blue-700 p-1"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Payments table */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-green-600" />
                          Payments Made
                        </h4>
                        {garagePayments.length === 0 ? (
                          <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-lg">No payments recorded yet</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100 text-gray-600">
                                <tr>
                                  <th className="text-left py-2 px-3 font-medium">Payment #</th>
                                  <th className="text-left py-2 px-3 font-medium">Date</th>
                                  <th className="text-left py-2 px-3 font-medium">Method</th>
                                  <th className="text-left py-2 px-3 font-medium">Reference</th>
                                  <th className="text-right py-2 px-3 font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {garagePayments.map((pay) => (
                                  <tr key={pay.id} className="hover:bg-gray-50">
                                    <td className="py-2 px-3 font-mono text-xs text-gray-700">{pay.payment_number}</td>
                                    <td className="py-2 px-3 text-gray-700">{formatDate(pay.payment_date)}</td>
                                    <td className="py-2 px-3 text-gray-700 uppercase">{pay.payment_method}</td>
                                    <td className="py-2 px-3 text-gray-700">{pay.reference || '—'}</td>
                                    <td className="py-2 px-3 text-right font-medium text-green-700">{currency(pay.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-50 font-semibold">
                                  <td colSpan={4} className="py-2 px-3 text-right text-gray-700">Total:</td>
                                  <td className="py-2 px-3 text-right text-green-700">{currency(garagePayments.reduce((s, p) => s + Number(p.amount), 0))}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
