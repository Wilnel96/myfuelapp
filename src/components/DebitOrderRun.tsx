import { useState, useEffect } from 'react';
import {
  ArrowLeft, Repeat, Building2, Calendar, AlertCircle, Search,
  CheckCircle, XCircle, Tag, Download, Eye, ChevronDown, ChevronUp,
  FileText, Clock, History
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgBankingDetails {
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  bank_account_type: string | null;
}

interface DebitOrgInvoice {
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
}

interface DebitCreditNote {
  id: string;
  organization_id: string;
  credit_note_number: string;
  credit_note_date: string;
  total_amount: number;
  reason: string;
}

interface DebitOrgGroup {
  organization_id: string;
  organization_name: string;
  banking: OrgBankingDetails;
  banking_complete: boolean;
  invoices: DebitOrgInvoice[];
  credit_notes: DebitCreditNote[];
  total_outstanding: number;
  total_credits: number;
  net_amount: number;
}

interface HistoryRun {
  id: string;
  run_number: string;
  run_date: string;
  status: string;
  total_invoices: number;
  total_amount: number;
  total_credits_applied: number;
  net_amount: number;
  notes: string | null;
  processed_at: string | null;
  created_at: string;
}

interface HistoryRunItem {
  id: string;
  organization_id: string;
  amount: number;
  credits_amount: number;
  net_amount: number;
  status: string;
  exclusion_reason: string | null;
  invoice: {
    invoice_number: string;
    invoice_date: string;
    total_amount: number;
  } | null;
  organization: { name: string } | null;
}

type Phase = 'month-select' | 'selection' | 'review' | 'history' | 'history-detail';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

const formatDate = (s: string) =>
  s ? new Date(s).toLocaleDateString('en-ZA') : '—';

const isBankingComplete = (b: OrgBankingDetails) =>
  !!(b.bank_account_number && b.bank_branch_code && b.bank_account_holder && b.bank_name);

const monthLabel = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-');
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
};

// Build a list of the last 12 months (YYYY-MM) for the picker
const buildMonthOptions = () => {
  const options: string[] = [];
  const now = new Date();
  // Start from next month (i = -1) so operators can prepare runs in advance
  for (let i = -1; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return options;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DebitOrderRun({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('month-select');

  // Month selection
  const monthOptions = buildMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[2]); // previous month default

  // Selection phase
  const [orgGroups, setOrgGroups] = useState<DebitOrgGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState(false);

  // Excluded invoices (deselected by operator)
  // Credit notes are applied automatically; operator can opt-out individual ones
  const [excludedInvoices, setExcludedInvoices] = useState<Set<string>>(new Set());
  const [excludedCreditNotes, setExcludedCreditNotes] = useState<Set<string>>(new Set());
  const [exclusionReasons, setExclusionReasons] = useState<Record<string, string>>({});
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // Review phase
  const [runDate, setRunDate] = useState(new Date().toISOString().split('T')[0]);
  const [runNotes, setRunNotes] = useState('');

  // History
  const [historyRuns, setHistoryRuns] = useState<HistoryRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<HistoryRun | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryRunItem[]>([]);
  const [historyItemsLoading, setHistoryItemsLoading] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = async (yearMonth: string) => {
    try {
      setLoading(true);
      setError('');

      // Derive month date range for filtering by billing_period_start
      const [year, month] = yearMonth.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month

      const [invoiceRes, creditRes] = await Promise.all([
        supabase
          .from('invoices')
          .select(`
            id, organization_id, invoice_number, invoice_date,
            billing_period_start, billing_period_end,
            total_amount, amount_outstanding, payment_due_date, status,
            organization:organizations!inner(
              name, payment_method,
              bank_name, bank_account_holder, bank_account_number,
              bank_branch_code, bank_account_type
            )
          `)
          .in('status', ['issued', 'overdue'])
          .gte('billing_period_start', monthStart)
          .lte('billing_period_start', monthEnd)
          .order('organization_id')
          .order('invoice_date'),
        supabase
          .from('credit_notes')
          .select(`
            id, organization_id, credit_note_number, credit_note_date,
            total_amount, reason,
            organization:organizations!inner(name, payment_method)
          `)
          .eq('status', 'issued'),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      if (creditRes.error) throw creditRes.error;

      // Filter to debit order organisations only
      const debitInvoices = ((invoiceRes.data || []) as any[]).filter(
        inv => inv.organization?.payment_method === 'Debit Order'
      );
      const debitCredits = ((creditRes.data || []) as any[]).filter(
        cn => cn.organization?.payment_method === 'Debit Order'
      );

      // Group credits by org
      const creditsByOrg: Record<string, DebitCreditNote[]> = {};
      for (const cn of debitCredits) {
        if (!creditsByOrg[cn.organization_id]) creditsByOrg[cn.organization_id] = [];
        creditsByOrg[cn.organization_id].push({
          id: cn.id,
          organization_id: cn.organization_id,
          credit_note_number: cn.credit_note_number,
          credit_note_date: cn.credit_note_date,
          total_amount: cn.total_amount,
          reason: cn.reason,
        });
      }

      // Group invoices by org
      const grouped: Record<string, DebitOrgGroup> = {};
      for (const inv of debitInvoices) {
        const orgId = inv.organization_id;
        const org = inv.organization;
        if (!grouped[orgId]) {
          const banking: OrgBankingDetails = {
            bank_name: org.bank_name,
            bank_account_holder: org.bank_account_holder,
            bank_account_number: org.bank_account_number,
            bank_branch_code: org.bank_branch_code,
            bank_account_type: org.bank_account_type,
          };
          const credits = creditsByOrg[orgId] || [];
          const totalCredits = credits.reduce((s, c) => s + c.total_amount, 0);
          grouped[orgId] = {
            organization_id: orgId,
            organization_name: org.name,
            banking,
            banking_complete: isBankingComplete(banking),
            invoices: [],
            credit_notes: credits,
            total_outstanding: 0,
            total_credits: totalCredits,
            net_amount: 0,
          };
        }
        grouped[orgId].invoices.push({
          id: inv.id,
          organization_id: inv.organization_id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          billing_period_start: inv.billing_period_start,
          billing_period_end: inv.billing_period_end,
          total_amount: inv.total_amount,
          amount_outstanding: inv.amount_outstanding,
          payment_due_date: inv.payment_due_date,
          status: inv.status,
        });
        grouped[orgId].total_outstanding += inv.amount_outstanding;
      }

      // Compute net per org
      for (const g of Object.values(grouped)) {
        g.net_amount = Math.max(0, g.total_outstanding - g.total_credits);
      }

      setOrgGroups(Object.values(grouped));
      setExcludedInvoices(new Set());
      setExcludedCreditNotes(new Set());
    } catch (err: any) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const { data, error: err } = await supabase
        .from('debit_order_runs')
        .select('*')
        .order('run_date', { ascending: false })
        .limit(50);
      if (err) throw err;
      setHistoryRuns((data || []) as HistoryRun[]);
    } catch (err: any) {
      setError('Failed to load history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadHistoryItems = async (runId: string) => {
    try {
      setHistoryItemsLoading(true);
      const { data, error: err } = await supabase
        .from('debit_order_run_items')
        .select(`
          id, organization_id, amount, credits_amount, net_amount, status, exclusion_reason,
          invoice:invoices(invoice_number, invoice_date, total_amount),
          organization:organizations(name)
        `)
        .eq('run_id', runId)
        .order('status')
        .order('organization_id');
      if (err) throw err;
      setHistoryItems((data || []) as HistoryRunItem[]);
    } catch (err: any) {
      setError('Failed to load run details: ' + err.message);
    } finally {
      setHistoryItemsLoading(false);
    }
  };

  // ── Selection helpers ───────────────────────────────────────────────────────

  const allInvoiceIds = orgGroups.flatMap(g => g.invoices.map(i => i.id));
  const includedIds = allInvoiceIds.filter(id => !excludedInvoices.has(id));

  const toggleInvoice = (invoiceId: string) => {
    const next = new Set(excludedInvoices);
    if (next.has(invoiceId)) next.delete(invoiceId); else next.add(invoiceId);
    setExcludedInvoices(next);
  };

  const toggleOrg = (group: DebitOrgGroup) => {
    const orgIds = group.invoices.map(i => i.id);
    const allIncluded = orgIds.every(id => !excludedInvoices.has(id));
    const next = new Set(excludedInvoices);
    if (allIncluded) orgIds.forEach(id => next.add(id));
    else orgIds.forEach(id => next.delete(id));
    setExcludedInvoices(next);
  };

  const toggleCreditNote = (cnId: string) => {
    const next = new Set(excludedCreditNotes);
    if (next.has(cnId)) next.delete(cnId); else next.add(cnId);
    setExcludedCreditNotes(next);
  };

  const selectAll = () => setExcludedInvoices(new Set());
  const deselectAll = () => setExcludedInvoices(new Set(allInvoiceIds));

  const setExclusionReason = (invoiceId: string, reason: string) => {
    setExclusionReasons(prev => ({ ...prev, [invoiceId]: reason }));
  };

  const toggleOrgExpanded = (orgId: string) => {
    const next = new Set(expandedOrgs);
    if (next.has(orgId)) next.delete(orgId); else next.add(orgId);
    setExpandedOrgs(next);
  };

  // ── Computed totals ─────────────────────────────────────────────────────────

  const allInvoices = orgGroups.flatMap(g => g.invoices);
  const allCreditNotes = orgGroups.flatMap(g => g.credit_notes);

  const includedInvoices = allInvoices.filter(inv => !excludedInvoices.has(inv.id));
  const excludedInvoiceList = allInvoices.filter(inv => excludedInvoices.has(inv.id));

  // Credit notes are applied by default; operator can opt out individual ones
  const appliedCreditNotes = allCreditNotes.filter(cn => !excludedCreditNotes.has(cn.id));

  const grossAmount = includedInvoices.reduce((s, inv) => s + inv.amount_outstanding, 0);
  const creditsAmount = appliedCreditNotes.reduce((s, cn) => s + cn.total_amount, 0);
  const netAmount = Math.max(0, grossAmount - creditsAmount);

  const missingBankingOrgs = orgGroups.filter(
    g => !g.banking_complete && g.invoices.some(inv => !excludedInvoices.has(inv.id))
  );
  const missingBankingInvoiceIds = new Set(missingBankingOrgs.flatMap(g => g.invoices.map(i => i.id)));
  const bankFileInvoices = includedInvoices.filter(inv => !missingBankingInvoiceIds.has(inv.id));
  const bankGrossAmount = bankFileInvoices.reduce((s, inv) => s + inv.amount_outstanding, 0);

  const filteredGroups = orgGroups.filter(g =>
    g.organization_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Per-org computed net (respecting excluded invoices and excluded credit notes)
  const orgNet = (group: DebitOrgGroup) => {
    const outstanding = group.invoices
      .filter(i => !excludedInvoices.has(i.id))
      .reduce((s, i) => s + i.amount_outstanding, 0);
    const credits = group.credit_notes
      .filter(cn => !excludedCreditNotes.has(cn.id))
      .reduce((s, cn) => s + cn.total_amount, 0);
    return { outstanding, credits, net: Math.max(0, outstanding - credits) };
  };

  // ── Process run ─────────────────────────────────────────────────────────────

  const processRun = async () => {
    if (includedInvoices.length === 0) {
      setError('No invoices selected for this run.');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      setSuccess('');

      const { data: runNumberData, error: rnErr } = await supabase
        .rpc('generate_debit_order_run_number');
      if (rnErr) throw rnErr;

      const runNumber = runNumberData as string;

      const { data: runData, error: runErr } = await supabase
        .from('debit_order_runs')
        .insert({
          run_number: runNumber,
          run_date: runDate,
          status: 'processed',
          total_invoices: includedInvoices.length,
          total_amount: grossAmount,
          total_credits_applied: creditsAmount,
          net_amount: netAmount,
          notes: runNotes || null,
          processed_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (runErr) throw runErr;

      const runId = runData.id;

      // Compute per-org credit allocation (proportional if multiple invoices)
      const creditByOrg: Record<string, number> = {};
      for (const cn of appliedCreditNotes) {
        creditByOrg[cn.organization_id] = (creditByOrg[cn.organization_id] || 0) + cn.total_amount;
      }

      // Insert run items for ALL invoices
      const runItems = allInvoices.map(inv => {
        const isExcluded = excludedInvoices.has(inv.id);
        const orgCredit = !isExcluded ? (creditByOrg[inv.organization_id] || 0) : 0;
        const grossInv = inv.amount_outstanding;
        // Distribute org credit proportionally across included invoices of that org
        const orgIncludedInvoices = orgGroups
          .find(g => g.organization_id === inv.organization_id)
          ?.invoices.filter(i => !excludedInvoices.has(i.id)) || [];
        const orgGross = orgIncludedInvoices.reduce((s, i) => s + i.amount_outstanding, 0);
        const creditShare = orgGross > 0 ? orgCredit * (grossInv / orgGross) : 0;
        const netInv = Math.max(0, grossInv - creditShare);
        return {
          run_id: runId,
          invoice_id: inv.id,
          organization_id: inv.organization_id,
          amount: grossInv,
          credits_amount: isExcluded ? 0 : creditShare,
          net_amount: isExcluded ? 0 : netInv,
          status: isExcluded ? 'excluded' : 'included',
          exclusion_reason: isExcluded ? (exclusionReasons[inv.id] || null) : null,
        };
      });

      const { error: itemsErr } = await supabase.from('debit_order_run_items').insert(runItems);
      if (itemsErr) throw itemsErr;

      // Mark included invoices as paid
      for (const inv of includedInvoices) {
        const { error: payErr } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            amount_paid: inv.total_amount,
            amount_outstanding: 0,
            paid_at: new Date().toISOString(),
          })
          .eq('id', inv.id);
        if (payErr) throw payErr;
      }

      // Apply selected credit notes
      for (const cn of appliedCreditNotes) {
        const { error: cnErr } = await supabase
          .from('credit_notes')
          .update({ status: 'applied' })
          .eq('id', cn.id);
        if (cnErr) throw cnErr;
      }

      downloadBankFile(runNumber, runDate, includedInvoices, orgGroups);

      setSuccess(
        `Debit order run ${runNumber} processed successfully. ` +
        `${includedInvoices.length} invoice(s) marked as paid. ` +
        `Bank submission file downloaded.`
      );
      setPhase('month-select');
    } catch (err: any) {
      setError('Failed to process run: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ── Bank file generator ─────────────────────────────────────────────────────

  const downloadBankFile = (
    runNumber: string,
    runDateStr: string,
    invoices: DebitOrgInvoice[],
    groups: DebitOrgGroup[]
  ) => {
    const orgMap = Object.fromEntries(groups.map(g => [g.organization_id, g]));
    const actionDate = runDateStr.replace(/-/g, '');

    const header = [
      'Record Type', 'Action Date', 'Account Holder Name',
      'Bank Name', 'Branch Code', 'Account Number', 'Account Type',
      'Amount (cents)', 'Reference', 'Invoice Number', 'Organisation Name',
    ];

    const rows = invoices
      .filter(inv => {
        const org = orgMap[inv.organization_id];
        return org && org.banking_complete && !excludedInvoices.has(inv.id);
      })
      .map(inv => {
        const org = orgMap[inv.organization_id];
        const amountCents = Math.round(inv.amount_outstanding * 100);
        return [
          'DEBIT',
          actionDate,
          org.banking.bank_account_holder || '',
          org.banking.bank_name || '',
          org.banking.bank_branch_code || '',
          org.banking.bank_account_number || '',
          (org.banking.bank_account_type || 'cheque').toUpperCase(),
          amountCents.toString(),
          runNumber,
          inv.invoice_number,
          org.organization_name,
        ];
      });

    const csvContent = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DebitOrderRun_${actionDate}_${runNumber}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const redownloadBankFile = async (run: HistoryRun) => {
    const items = historyItems.filter(item => item.status === 'included');
    const invoices: DebitOrgInvoice[] = items.map(item => ({
      id: item.id,
      organization_id: item.organization_id,
      invoice_number: item.invoice?.invoice_number || '',
      invoice_date: item.invoice?.invoice_date || '',
      billing_period_start: '',
      billing_period_end: '',
      total_amount: item.amount,
      amount_outstanding: item.amount,
      payment_due_date: '',
      status: 'paid',
    }));
    downloadBankFile(run.run_number, run.run_date, invoices, orgGroups);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const pageHeader = (title: string, subtitle: string) => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Repeat className="h-8 w-8 mr-3 text-blue-600" />
          {title}
        </h1>
        <div className="flex items-center gap-2">
          {(phase === 'month-select' || phase === 'selection') && (
            <button
              onClick={() => { setPhase('history'); loadHistory(); }}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
            >
              <History className="h-4 w-4" />
              Run History
            </button>
          )}
          <button
            onClick={() => {
              if (phase === 'review') setPhase('selection');
              else if (phase === 'selection') setPhase('month-select');
              else if (phase === 'history-detail') setPhase('history');
              else if (phase === 'history') setPhase('month-select');
              else onBack();
            }}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            {phase === 'review' ? 'Back to Selection'
              : phase === 'selection' ? 'Change Month'
              : phase === 'history' || phase === 'history-detail' ? 'Back'
              : 'Back'}
          </button>
        </div>
      </div>
      <p className="mt-1 text-gray-600">{subtitle}</p>
    </div>
  );

  // ── Month selection phase ────────────────────────────────────────────────────

  if (phase === 'month-select') {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          {pageHeader('Debit Order Run', 'Select the billing month to process debit orders for')}

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

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Select Billing Month</h2>
                <p className="text-sm text-gray-500">Choose which month's invoices to include in this debit order run</p>
              </div>
            </div>

            <div className="space-y-3 mb-8">
              {monthOptions.map(ym => (
                <label
                  key={ym}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedMonth === ym
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="billing-month"
                      value={ym}
                      checked={selectedMonth === ym}
                      onChange={() => setSelectedMonth(ym)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className={`font-medium ${selectedMonth === ym ? 'text-blue-700' : 'text-gray-900'}`}>
                      {monthLabel(ym)}
                    </span>
                  </div>
                  {ym === monthOptions[0] && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Next month
                    </span>
                  )}
                  {ym === monthOptions[1] && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                      Current month
                    </span>
                  )}
                  {ym === monthOptions[2] && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      Previous month
                    </span>
                  )}
                </label>
              ))}
            </div>

            <button
              onClick={async () => {
                setError('');
                setSuccess('');
                await loadData(selectedMonth);
                setPhase('selection');
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Loading invoices...
                </>
              ) : (
                <>
                  <Repeat className="h-5 w-5" />
                  Load {monthLabel(selectedMonth)} Invoices
                </>
              )}
            </button>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">How Debit Order Runs Work</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Select the billing month to load all outstanding debit order invoices for that period</li>
                  <li>All invoices are pre-selected — untick only those that should not be debited</li>
                  <li>Any unresolved credit notes are automatically deducted from the organisation's total</li>
                  <li>The net amount per organisation = invoice total minus any credit notes</li>
                  <li>A bank submission CSV file is automatically downloaded when the run is processed</li>
                  <li>Organisations missing banking details are excluded from the CSV but included in the system</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading debit order clients...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── History detail ──────────────────────────────────────────────────────────

  if (phase === 'history-detail' && selectedHistoryRun) {
    const included = historyItems.filter(i => i.status === 'included');
    const excluded = historyItems.filter(i => i.status === 'excluded');

    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          {pageHeader(
            `Run ${selectedHistoryRun.run_number}`,
            `Processed on ${formatDate(selectedHistoryRun.run_date)}${selectedHistoryRun.notes ? ` — ${selectedHistoryRun.notes}` : ''}`
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />{error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Included', value: included.length, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
              { label: 'Excluded', value: excluded.length, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
              { label: 'Gross Amount', value: formatCurrency(selectedHistoryRun.total_amount), color: 'text-gray-900', bg: 'bg-white border-gray-200' },
              { label: 'Net Amount', value: formatCurrency(selectedHistoryRun.net_amount), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            ].map(card => (
              <div key={card.label} className={`border rounded-lg p-4 ${card.bg}`}>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{card.label}</p>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end mb-4">
            <button
              onClick={() => redownloadBankFile(selectedHistoryRun)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              Re-download Bank File
            </button>
          </div>

          {historyItemsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : (
            <div className="space-y-6">
              {included.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-green-50 px-6 py-3 border-b border-green-200 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <h3 className="font-semibold text-green-800">Included ({included.length})</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {included.map(item => (
                      <div key={item.id} className="px-6 py-3 grid grid-cols-4 gap-4 text-sm">
                        <span className="font-medium text-gray-900">{item.organization?.name || '—'}</span>
                        <span className="text-gray-600">{item.invoice?.invoice_number || '—'}</span>
                        <span className="text-green-700">- {formatCurrency(item.credits_amount)}</span>
                        <span className="text-right font-semibold text-gray-900">{formatCurrency(item.net_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {excluded.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-red-50 px-6 py-3 border-b border-red-200 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <h3 className="font-semibold text-red-800">Excluded / Failed ({excluded.length})</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {excluded.map(item => (
                      <div key={item.id} className="px-6 py-3 grid grid-cols-3 gap-4 text-sm">
                        <span className="font-medium text-gray-900">{item.organization?.name || '—'}</span>
                        <span className="text-gray-600">{item.invoice?.invoice_number || '—'}</span>
                        <span className="text-right text-red-600">{item.exclusion_reason || 'No reason given'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── History list ─────────────────────────────────────────────────────────────

  if (phase === 'history') {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          {pageHeader('Debit Order Run History', 'View and re-download previous debit order runs')}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />{error}
            </div>
          )}

          {historyLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-3 text-gray-600">Loading history...</p>
            </div>
          ) : historyRuns.length === 0 ? (
            <div className="text-center py-16">
              <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No debit order runs yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Run Number</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Run Date</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Invoices</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Gross</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Credits</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Net Amount</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Notes</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyRuns.map(run => (
                    <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-gray-900">{run.run_number}</td>
                      <td className="px-6 py-3 text-gray-600">{formatDate(run.run_date)}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          run.status === 'processed' ? 'bg-green-100 text-green-700' :
                          run.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600">{run.total_invoices}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{formatCurrency(run.total_amount)}</td>
                      <td className="px-6 py-3 text-right text-green-600">
                        {run.total_credits_applied > 0 ? `- ${formatCurrency(run.total_credits_applied)}` : '—'}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-blue-700">{formatCurrency(run.net_amount)}</td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{run.notes || '—'}</td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={async () => {
                            setSelectedHistoryRun(run);
                            setPhase('history-detail');
                            await loadHistoryItems(run.id);
                          }}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium ml-auto"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Review phase ─────────────────────────────────────────────────────────────

  if (phase === 'review') {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          {pageHeader(
            'Review Debit Order Run',
            `${monthLabel(selectedMonth)} — Confirm the details below before processing`
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />{error}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Included', value: `${includedInvoices.length} invoices`, sub: '', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
              { label: 'Excluded', value: `${excludedInvoiceList.length} invoices`, sub: '', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
              { label: 'Gross Amount', value: formatCurrency(grossAmount), sub: creditsAmount > 0 ? `Credits: - ${formatCurrency(creditsAmount)}` : 'No credits applied', color: 'text-gray-900', bg: 'bg-white border-gray-200' },
              { label: 'Net Debit', value: formatCurrency(netAmount), sub: 'after credits', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            ].map(card => (
              <div key={card.label} className={`border rounded-lg p-4 ${card.bg}`}>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{card.label}</p>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* Banking warning */}
          {missingBankingOrgs.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800 mb-1">
                    {missingBankingOrgs.length} organisation(s) have incomplete banking details and will be excluded from the bank file
                  </p>
                  <ul className="text-sm text-amber-700 space-y-0.5 list-disc list-inside">
                    {missingBankingOrgs.map(o => <li key={o.organization_id}>{o.organization_name}</li>)}
                  </ul>
                  <p className="text-xs text-amber-600 mt-2">
                    Bank file total: {formatCurrency(bankGrossAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Run config */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" /> Run Details
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Run Date</label>
                <input
                  type="date"
                  value={runDate}
                  onChange={e => setRunDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={runNotes}
                  onChange={e => setRunNotes(e.target.value)}
                  placeholder={`e.g. ${monthLabel(selectedMonth)} Debit Order Run`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* Included invoices */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
            <div className="bg-green-50 px-6 py-3 border-b border-green-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold text-green-800">Included Invoices ({includedInvoices.length})</h3>
              </div>
              <span className="text-sm font-bold text-green-700">{formatCurrency(grossAmount)}</span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
              {includedInvoices.map(inv => {
                const org = orgGroups.find(g => g.organization_id === inv.organization_id);
                const hasBanking = org?.banking_complete;
                const orgCreditApplied = (org?.credit_notes || [])
                  .filter(cn => !excludedCreditNotes.has(cn.id))
                  .reduce((s, cn) => s + cn.total_amount, 0);
                const orgIncluded = (org?.invoices || []).filter(i => !excludedInvoices.has(i.id));
                const orgGross = orgIncluded.reduce((s, i) => s + i.amount_outstanding, 0);
                const creditShare = orgGross > 0 ? orgCreditApplied * (inv.amount_outstanding / orgGross) : 0;
                const netInv = Math.max(0, inv.amount_outstanding - creditShare);
                return (
                  <div key={inv.id} className="px-6 py-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{org?.organization_name}</span>
                        <span className="text-gray-500 ml-2">{inv.invoice_number}</span>
                        {!hasBanking && (
                          <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">No banking</span>
                        )}
                      </div>
                      <div className="text-right">
                        {creditShare > 0 && (
                          <div className="text-xs text-green-700">- {formatCurrency(creditShare)} credit</div>
                        )}
                        <span className="font-semibold text-gray-900">{formatCurrency(netInv)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Excluded invoices */}
          {excludedInvoiceList.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="bg-red-50 px-6 py-3 border-b border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <h3 className="font-semibold text-red-700">Excluded ({excludedInvoiceList.length})</h3>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                {excludedInvoiceList.map(inv => {
                  const org = orgGroups.find(g => g.organization_id === inv.organization_id);
                  return (
                    <div key={inv.id} className="px-6 py-2.5 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-gray-900">{org?.organization_name}</span>
                        <span className="text-gray-500 ml-2">{inv.invoice_number}</span>
                        {exclusionReasons[inv.id] && (
                          <span className="text-gray-500 ml-2 text-xs italic">— {exclusionReasons[inv.id]}</span>
                        )}
                      </div>
                      <span className="text-red-600">{formatCurrency(inv.amount_outstanding)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-4">
            <button
              onClick={() => setPhase('selection')}
              className="px-6 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Back to Edit
            </button>
            <button
              onClick={processRun}
              disabled={processing}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Processing...
                </>
              ) : (
                <>
                  <Repeat className="h-4 w-4" />
                  Process Debit Order Run
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Selection phase ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {pageHeader(
          `Debit Order Run — ${monthLabel(selectedMonth)}`,
          'All debit order clients are pre-selected. Untick any that should not be debited this month.'
        )}

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

        {orgGroups.length === 0 ? (
          <div className="text-center py-16">
            <Repeat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium">
              No outstanding invoices for {monthLabel(selectedMonth)}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Invoices appear here for organisations with payment method set to "Debit Order"
            </p>
            <button
              onClick={() => setPhase('month-select')}
              className="mt-4 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
            >
              Select a different month
            </button>
          </div>
        ) : (
          <>
            {/* Top toolbar */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search organisations..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-60"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Running totals */}
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Included</p>
                  <p className="text-sm font-bold text-green-700">{includedIds.length} invoice(s)</p>
                </div>
                {excludedInvoices.size > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Excluded</p>
                    <p className="text-sm font-bold text-red-600">{excludedInvoices.size} invoice(s)</p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Gross</p>
                  <p className="text-base font-bold text-gray-900">{formatCurrency(grossAmount)}</p>
                </div>
                {creditsAmount > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Credits</p>
                    <p className="text-base font-bold text-green-700">- {formatCurrency(creditsAmount)}</p>
                  </div>
                )}
                <div className="text-right border-l border-gray-200 pl-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Net Debit</p>
                  <p className="text-xl font-bold text-blue-700">{formatCurrency(netAmount)}</p>
                </div>
                <button
                  onClick={() => { setError(''); setPhase('review'); }}
                  disabled={includedIds.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
                >
                  <Repeat className="h-4 w-4" />
                  Review Run
                </button>
              </div>
            </div>

            {/* Missing banking warning */}
            {missingBankingOrgs.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">{missingBankingOrgs.length} organisation(s)</span> are missing banking details — they will be excluded from the bank submission file.
                </p>
              </div>
            )}

            {/* Org groups */}
            <div className="space-y-3">
              {filteredGroups.map(group => {
                const { outstanding, credits: orgCredits, net: orgNetAmt } = orgNet(group);
                const orgInvoiceIds = group.invoices.map(i => i.id);
                const allIncluded = orgInvoiceIds.every(id => !excludedInvoices.has(id));
                const someIncluded = orgInvoiceIds.some(id => !excludedInvoices.has(id));
                const isExpanded = expandedOrgs.has(group.organization_id);

                return (
                  <div
                    key={group.organization_id}
                    className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-colors ${
                      allIncluded ? 'border-gray-200' :
                      someIncluded ? 'border-amber-300' : 'border-red-200 opacity-75'
                    }`}
                  >
                    {/* Org header row */}
                    <div className="px-5 py-4 flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={allIncluded}
                        ref={el => { if (el) el.indeterminate = someIncluded && !allIncluded; }}
                        onChange={() => toggleOrg(group)}
                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                      />
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <Building2 className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{group.organization_name}</p>
                          <p className="text-xs text-gray-500">
                            {group.invoices.length} invoice(s)
                            {!group.banking_complete && (
                              <span className="ml-2 text-amber-600 font-medium">— Missing banking details</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        {orgCredits > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Invoices</p>
                            <p className="text-sm font-semibold text-gray-600">{formatCurrency(outstanding)}</p>
                          </div>
                        )}
                        {orgCredits > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-green-600 uppercase tracking-wide">Credits</p>
                            <p className="text-sm font-semibold text-green-700">- {formatCurrency(orgCredits)}</p>
                          </div>
                        )}
                        <div className="text-right border-l border-gray-200 pl-4">
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Net Debit</p>
                          <p className={`text-base font-bold ${allIncluded ? 'text-blue-700' : 'text-red-500'}`}>
                            {formatCurrency(orgNetAmt)}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleOrgExpanded(group.organization_id)}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <>
                        {/* Invoices */}
                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                          {group.invoices.map(inv => {
                            const isExcluded = excludedInvoices.has(inv.id);
                            const isOverdue = inv.status === 'overdue' ||
                              (inv.payment_due_date && new Date(inv.payment_due_date) < new Date() && inv.status === 'issued');
                            return (
                              <div
                                key={inv.id}
                                className={`px-6 py-3 transition-colors ${isExcluded ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                              >
                                <div className="flex items-center gap-4">
                                  <input
                                    type="checkbox"
                                    checked={!isExcluded}
                                    onChange={() => toggleInvoice(inv.id)}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                                  />
                                  <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="font-medium text-gray-900">{inv.invoice_number}</p>
                                      <p className="text-xs text-gray-500">{formatDate(inv.invoice_date)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-400">Billing Period</p>
                                      <p className="text-gray-800">
                                        {formatDate(inv.billing_period_start)} – {formatDate(inv.billing_period_end)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-400 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Due
                                      </p>
                                      <p className={`${isOverdue ? 'text-red-600 font-medium' : 'text-gray-800'}`}>
                                        {formatDate(inv.payment_due_date)}
                                        {isOverdue && <span className="text-xs ml-1">(Overdue)</span>}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-gray-400">Amount</p>
                                      <p className={`font-bold ${isExcluded ? 'text-red-500 line-through' : 'text-gray-900'}`}>
                                        {formatCurrency(inv.amount_outstanding)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {isExcluded && (
                                  <div className="mt-2 ml-8 flex items-center gap-2">
                                    <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                    <input
                                      type="text"
                                      placeholder="Reason for exclusion (optional)"
                                      value={exclusionReasons[inv.id] || ''}
                                      onChange={e => setExclusionReason(inv.id, e.target.value)}
                                      className="flex-1 text-xs border border-red-200 rounded px-2 py-1 focus:ring-1 focus:ring-red-400 focus:border-transparent bg-white"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Credit notes — auto-applied, opt-out per note */}
                        {group.credit_notes.length > 0 && (
                          <div className="border-t-2 border-green-200 bg-green-50 divide-y divide-green-100">
                            <div className="px-6 py-2 flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5 text-green-700" />
                              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                                Credit Notes — automatically deducted (untick to exclude)
                              </p>
                            </div>
                            {group.credit_notes.map(cn => {
                              const isApplied = !excludedCreditNotes.has(cn.id);
                              return (
                                <div
                                  key={cn.id}
                                  className={`px-6 py-3 flex items-center justify-between transition-colors ${isApplied ? 'bg-green-100' : 'opacity-60'}`}
                                >
                                  <div className="flex items-center gap-4">
                                    <input
                                      type="checkbox"
                                      checked={isApplied}
                                      onChange={() => toggleCreditNote(cn.id)}
                                      className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    />
                                    <div>
                                      <p className="text-sm font-medium text-green-900">{cn.credit_note_number}</p>
                                      <p className="text-xs text-green-700">{formatDate(cn.credit_note_date)}</p>
                                    </div>
                                    <p className="text-sm text-green-800">{cn.reason}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-green-700">- {formatCurrency(cn.total_amount)}</p>
                                    <p className="text-xs text-gray-400">{isApplied ? 'Will be deducted' : 'Not applied'}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
