import { useState, useEffect } from 'react';
import { CheckCircle, ArrowLeft, DollarSign, Building2, Calendar, AlertCircle, Search, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  invoice_date: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  amount_outstanding: number;
  payment_due_date: string;
  status: string;
  organization?: { name: string };
}

interface CreditNote {
  id: string;
  organization_id: string;
  credit_note_number: string;
  credit_note_date: string;
  total_amount: number;
  reason: string;
  status: string;
}

interface OrganizationInvoices {
  organization_id: string;
  organization_name: string;
  invoices: Invoice[];
  credit_notes: CreditNote[];
  total_outstanding: number;
  total_credits: number;
  invoice_count: number;
}

export default function BulkInvoicePayment({ onBack }: { onBack: () => void }) {
  const [organizationInvoices, setOrganizationInvoices] = useState<OrganizationInvoices[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedCreditNotes, setSelectedCreditNotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [invoiceRes, creditRes] = await Promise.all([
        supabase
          .from('invoices')
          .select(`id, organization_id, invoice_number, invoice_date, billing_period_start, billing_period_end, total_amount, amount_outstanding, payment_due_date, status, organization:organizations(name)`)
          .in('status', ['issued', 'overdue'])
          .order('organization_id')
          .order('invoice_date'),
        supabase
          .from('credit_notes')
          .select(`id, organization_id, credit_note_number, credit_note_date, total_amount, reason, status, organization:organizations(name)`)
          .eq('status', 'issued')
          .order('credit_note_date'),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      if (creditRes.error) throw creditRes.error;

      const creditsByOrg = ((creditRes.data || []) as (CreditNote & { organization?: { name: string } })[]).reduce((acc, cn) => {
        if (!acc[cn.organization_id]) acc[cn.organization_id] = { credits: [], orgName: cn.organization?.name || 'Unknown' };
        acc[cn.organization_id].credits.push(cn);
        return acc;
      }, {} as Record<string, { credits: CreditNote[]; orgName: string }>);

      const grouped = ((invoiceRes.data || []) as Invoice[]).reduce((acc, invoice) => {
        const orgId = invoice.organization_id;
        const orgName = invoice.organization?.name || 'Unknown';

        if (!acc[orgId]) {
          const orgCredits = creditsByOrg[orgId]?.credits || [];
          acc[orgId] = {
            organization_id: orgId,
            organization_name: orgName,
            invoices: [],
            credit_notes: orgCredits,
            total_outstanding: 0,
            total_credits: orgCredits.reduce((s, cn) => s + cn.total_amount, 0),
            invoice_count: 0,
          };
        }

        acc[orgId].invoices.push(invoice);
        acc[orgId].total_outstanding += invoice.amount_outstanding;
        acc[orgId].invoice_count += 1;

        return acc;
      }, {} as Record<string, OrganizationInvoices>);

      // Add orgs that have issued credit notes but no outstanding invoices
      for (const [orgId, { credits, orgName }] of Object.entries(creditsByOrg)) {
        if (!grouped[orgId]) {
          grouped[orgId] = {
            organization_id: orgId,
            organization_name: orgName,
            invoices: [],
            credit_notes: credits,
            total_outstanding: 0,
            total_credits: credits.reduce((s, cn) => s + cn.total_amount, 0),
            invoice_count: 0,
          };
        }
      }

      setOrganizationInvoices(Object.values(grouped));
    } catch (err: any) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) newSelected.delete(invoiceId);
    else newSelected.add(invoiceId);
    setSelectedInvoices(newSelected);
  };

  const toggleOrganization = (orgInvoices: OrganizationInvoices) => {
    const newSelected = new Set(selectedInvoices);
    const allSelected = orgInvoices.invoices.every(inv => selectedInvoices.has(inv.id));
    if (allSelected) orgInvoices.invoices.forEach(inv => newSelected.delete(inv.id));
    else orgInvoices.invoices.forEach(inv => newSelected.add(inv.id));
    setSelectedInvoices(newSelected);
  };

  const toggleCreditNote = (cnId: string) => {
    const newSelected = new Set(selectedCreditNotes);
    if (newSelected.has(cnId)) newSelected.delete(cnId);
    else newSelected.add(cnId);
    setSelectedCreditNotes(newSelected);
  };

  const markSelectedAsPaid = async () => {
    if (selectedInvoices.size === 0) {
      setError('Please select at least one invoice');
      return;
    }

    const invoiceIds = Array.from(selectedInvoices);
    const allInvoices = organizationInvoices.flatMap(org => org.invoices);
    const invoicesToUpdate = allInvoices.filter(inv => invoiceIds.includes(inv.id));
    const allCreditNotes = organizationInvoices.flatMap(org => org.credit_notes);
    const creditNotesToApply = allCreditNotes.filter(cn => selectedCreditNotes.has(cn.id));

    const creditSummary = creditNotesToApply.length > 0
      ? `\n\n${creditNotesToApply.length} selected credit note(s) will be marked as applied.`
      : '';

    if (!confirm(`Mark ${selectedInvoices.size} invoice(s) as paid?${creditSummary}`)) return;

    try {
      setProcessing(true);
      setError('');
      setSuccess('');

      for (const invoice of invoicesToUpdate) {
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ status: 'paid', amount_paid: invoice.total_amount, amount_outstanding: 0, paid_at: new Date().toISOString() })
          .eq('id', invoice.id);
        if (updateError) throw updateError;
      }

      for (const cn of creditNotesToApply) {
        const { error: cnError } = await supabase
          .from('credit_notes')
          .update({ status: 'applied' })
          .eq('id', cn.id);
        if (cnError) throw cnError;
      }

      const creditMsg = creditNotesToApply.length > 0
        ? ` and ${creditNotesToApply.length} credit note(s) marked as applied`
        : '';
      setSuccess(`Successfully marked ${selectedInvoices.size} invoice(s) as paid${creditMsg}`);
      setSelectedInvoices(new Set());
      setSelectedCreditNotes(new Set());
      await loadData();
    } catch (err: any) {
      setError('Failed to process payment: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-ZA');

  const filteredOrgs = organizationInvoices.filter(org =>
    org.organization_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSelected = Array.from(selectedInvoices).reduce((sum, invoiceId) => {
    const invoice = organizationInvoices.flatMap(org => org.invoices).find(inv => inv.id === invoiceId);
    return sum + (invoice?.amount_outstanding || 0);
  }, 0);

  const selectedCreditsTotal = Array.from(selectedCreditNotes).reduce((sum, cnId) => {
    const cn = organizationInvoices.flatMap(org => org.credit_notes).find(c => c.id === cnId);
    return sum + (cn?.total_amount || 0);
  }, 0);

  const netSelected = Math.max(0, totalSelected - selectedCreditsTotal);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading invoices...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Invoice Management
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <DollarSign className="h-8 w-8 mr-3 text-green-600" />
            Bulk Invoice Payment
          </h1>
          <p className="mt-2 text-gray-600">
            Select invoices to mark as paid. Tick any credit notes you want to apply this month — unticked ones remain available for the following month.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />{error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />{success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div className="relative flex-1 min-w-64 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search organisations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {selectedInvoices.size > 0 && (
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-gray-500">{selectedInvoices.size} invoice(s) selected</p>
                  <p className="text-sm text-gray-700">
                    Invoices: <span className="font-semibold">{formatCurrency(totalSelected)}</span>
                  </p>
                  {selectedCreditsTotal > 0 && (
                    <p className="text-sm text-green-700">
                      Credits applied: <span className="font-semibold">- {formatCurrency(selectedCreditsTotal)}</span>
                    </p>
                  )}
                  <p className="text-lg font-bold text-gray-900 border-t border-gray-200 mt-1 pt-1">
                    Net: {formatCurrency(netSelected)}
                  </p>
                </div>
                <button
                  onClick={markSelectedAsPaid}
                  disabled={processing}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 whitespace-nowrap"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {processing ? 'Processing...' : 'Mark as Paid'}
                </button>
              </div>
            )}
          </div>

          {filteredOrgs.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No unpaid invoices found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredOrgs.map((orgInvoices) => {
                const allSelected = orgInvoices.invoices.every(inv => selectedInvoices.has(inv.id));
                const someSelected = orgInvoices.invoices.some(inv => selectedInvoices.has(inv.id));
                const hasCredits = orgInvoices.credit_notes.length > 0;

                return (
                  <div key={orgInvoices.organization_id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Org header */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={() => toggleOrganization(orgInvoices)}
                            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                              <Building2 className="h-5 w-5 text-gray-600" />
                              {orgInvoices.organization_name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {orgInvoices.invoice_count > 0 ? `${orgInvoices.invoice_count} unpaid invoice(s)` : 'No outstanding invoices'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Outstanding</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(orgInvoices.total_outstanding)}</p>
                          {hasCredits && (
                            <p className="text-sm text-green-700 font-medium mt-0.5">
                              {orgInvoices.credit_notes.length} credit note(s) available
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Invoices */}
                    <div className="divide-y divide-gray-100">
                      {orgInvoices.invoices.map((invoice) => {
                        const isOverdue = new Date(invoice.payment_due_date) < new Date() && invoice.status === 'issued';
                        return (
                          <div
                            key={invoice.id}
                            className={`px-6 py-4 hover:bg-gray-50 transition-colors ${selectedInvoices.has(invoice.id) ? 'bg-blue-50' : ''}`}
                          >
                            <div className="flex items-center space-x-4">
                              <input
                                type="checkbox"
                                checked={selectedInvoices.has(invoice.id)}
                                onChange={() => toggleInvoice(invoice.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0"
                              />
                              <div className="flex-1 grid grid-cols-4 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{invoice.invoice_number}</p>
                                  <p className="text-xs text-gray-500">{formatDate(invoice.invoice_date)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Billing Period</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {formatDate(invoice.billing_period_start)} – {formatDate(invoice.billing_period_end)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Due Date
                                  </p>
                                  <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                                    {formatDate(invoice.payment_due_date)}
                                    {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Amount</p>
                                  <p className="text-base font-bold text-gray-900">{formatCurrency(invoice.amount_outstanding)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Credit notes — each one individually selectable */}
                    {hasCredits && (
                      <div className="border-t-2 border-green-200 bg-green-50 divide-y divide-green-100">
                        <div className="px-6 py-2 flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-green-700" />
                          <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                            Available Credit Notes — tick to apply this month
                          </p>
                        </div>
                        {orgInvoices.credit_notes.map((cn) => {
                          const isSelected = selectedCreditNotes.has(cn.id);
                          return (
                            <div
                              key={cn.id}
                              className={`px-6 py-3 flex items-center justify-between transition-colors ${isSelected ? 'bg-green-100' : ''}`}
                            >
                              <div className="flex items-center gap-4">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCreditNote(cn.id)}
                                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded flex-shrink-0"
                                />
                                <div>
                                  <p className="text-sm font-medium text-green-900">{cn.credit_note_number}</p>
                                  <p className="text-xs text-green-700">{formatDate(cn.credit_note_date)}</p>
                                </div>
                                <p className="text-sm text-green-800">{cn.reason}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-base font-bold text-green-700">- {formatCurrency(cn.total_amount)}</p>
                                {isSelected ? (
                                  <p className="text-xs text-green-600 font-medium">Will be applied</p>
                                ) : (
                                  <p className="text-xs text-gray-400">Not applied</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Payment Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Select the invoices being paid this month</li>
                <li>Credit notes are shown separately — only tick a credit note if it is being applied this month</li>
                <li>Unticked credit notes remain as issued and carry over to the following month</li>
                <li>Only ticked credit notes are marked as applied when you click Mark as Paid</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
