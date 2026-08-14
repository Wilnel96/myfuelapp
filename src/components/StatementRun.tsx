import { useState, useEffect } from 'react';
import {
  FileText, Send, Eye, ArrowLeft, Calendar, Building2,
  Download, AlertCircle, Mail, CheckCircle, Loader2, Plus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Organization {
  id: string;
  name: string;
  vat_number?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  company_registration_number?: string;
  is_garage_managed?: boolean;
  main_user_email?: string;
}

interface Statement {
  id: string;
  organization_id: string;
  statement_number: string;
  statement_date: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  total_invoiced: number;
  total_paid: number;
  total_credit_notes: number;
  closing_balance: number;
  status: string;
  sent_to_email: string | null;
  sent_at: string | null;
  organization?: Organization;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  amount_paid: number;
  amount_outstanding: number;
  status: string;
  payment_due_date: string;
}

interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  total_amount: number;
  status: string;
}

interface ManagementOrg {
  name: string;
  vat_number: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  province: string;
  postal_code: string;
  country?: string;
  phone_number?: string;
  company_registration_number?: string;
}

interface StatementRunProps {
  onBack: () => void;
}

export default function StatementRun({ onBack }: StatementRunProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedStatement, setSelectedStatement] = useState<Statement | null>(null);
  const [statementInvoices, setStatementInvoices] = useState<Invoice[]>([]);
  const [statementCreditNotes, setStatementCreditNotes] = useState<CreditNote[]>([]);
  const [managementOrg, setManagementOrg] = useState<ManagementOrg | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<any>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<{ orgId: string; success: boolean; message: string } | null>(null);

  // Generate form state
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  useEffect(() => {
    loadOrganizations();
    loadStatements();
    loadManagementOrg();
  }, []);

  const loadOrganizations = async () => {
    try {
      const { data, error: err } = await supabase
        .from('organizations')
        .select('id, name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, company_registration_number, is_garage_managed')
        .eq('is_management_org', false)
        .eq('organization_type', 'client')
        .order('name');

      if (err) throw err;

      // Fetch main user emails for each org
      const orgsWithEmail = await Promise.all(
        (data || []).map(async (org) => {
          const { data: userData } = await supabase
            .from('organization_users')
            .select('email')
            .eq('organization_id', org.id)
            .eq('is_main_user', true)
            .limit(1);
          return { ...org, main_user_email: userData?.[0]?.email || '' };
        })
      );

      setOrganizations(orgsWithEmail);
    } catch (err: any) {
      setError('Failed to load organizations: ' + err.message);
    }
  };

  const loadStatements = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('client_statements')
        .select(`
          *,
          organization:organizations(
            id, name, vat_number, address_line_1, address_line_2,
            city, province, postal_code, country, company_registration_number,
            is_garage_managed
          )
        `)
        .order('statement_date', { ascending: false });

      if (err) throw err;
      setStatements(data || []);
    } catch (err: any) {
      setError('Failed to load statements: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadManagementOrg = async () => {
    try {
      const { data, error: err } = await supabase
        .from('organizations')
        .select('name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, phone_number, company_registration_number')
        .eq('is_management_org', true)
        .maybeSingle();

      if (err) throw err;
      setManagementOrg(data);
    } catch (err: any) {
      console.error('Failed to load management org:', err.message);
    }
  };

  const viewStatementDetails = async (statement: Statement) => {
    try {
      setSelectedStatement(statement);
      setStatementInvoices([]);
      setStatementCreditNotes([]);

      const [invResult, cnResult] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, invoice_date, billing_period_start, billing_period_end, total_amount, amount_paid, amount_outstanding, status, payment_due_date')
          .eq('organization_id', statement.organization_id)
          .gte('billing_period_start', statement.period_start)
          .lte('billing_period_end', statement.period_end)
          .order('invoice_date', { ascending: true }),
        supabase
          .from('credit_notes')
          .select('id, credit_note_number, credit_note_date, total_amount, status')
          .eq('organization_id', statement.organization_id)
          .gte('credit_note_date', statement.period_start)
          .lte('credit_note_date', statement.period_end)
          .order('credit_note_date', { ascending: true }),
      ]);

      if (invResult.error) throw invResult.error;
      if (cnResult.error) throw cnResult.error;

      setStatementInvoices(invResult.data || []);
      setStatementCreditNotes(cnResult.data || []);
    } catch (err: any) {
      setError('Failed to load statement details: ' + err.message);
    }
  };

  const generateStatements = async () => {
    if (!periodStart || !periodEnd) {
      alert('Please select both start and end dates for the statement period');
      return;
    }
    if (selectedOrgIds.length === 0) {
      alert('Please select at least one client organization');
      return;
    }

    try {
      setGenerating(true);
      setError('');
      setGenerationResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-client-statements`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_ids: selectedOrgIds,
          period_start: periodStart,
          period_end: periodEnd,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate statements');
      }

      setGenerationResult(result);
      await loadStatements();
    } catch (err: any) {
      setError('Failed to generate statements: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const emailStatement = async (statement: Statement) => {
    const org = organizations.find((o) => o.id === statement.organization_id);
    const email = org?.main_user_email;
    if (!email) {
      alert('No email address found for this client. Please ensure the main user has an email set.');
      return;
    }

    try {
      setSendingEmail(statement.id);
      setEmailResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-statement-email`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statement_id: statement.id,
          to_email: email,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      setEmailResult({ orgId: statement.id, success: true, message: `Statement emailed to ${email}` });

      // Update statement status locally
      setStatements((prev) =>
        prev.map((s) =>
          s.id === statement.id
            ? { ...s, status: 'sent', sent_to_email: email, sent_at: new Date().toISOString() }
            : s
        )
      );
      setSelectedStatement((prev) =>
        prev?.id === statement.id
          ? { ...prev, status: 'sent', sent_to_email: email, sent_at: new Date().toISOString() }
          : prev
      );
    } catch (err: any) {
      setEmailResult({ orgId: statement.id, success: false, message: err.message });
    } finally {
      setSendingEmail(null);
    }
  };

  const toggleOrgSelection = (orgId: string) => {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  };

  const selectAllOrgs = () => {
    setSelectedOrgIds(organizations.map((o) => o.id));
  };

  const deselectAllOrgs = () => {
    setSelectedOrgIds([]);
  };

  const formatCurrency = (amount: number) => {
    return `R ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA');
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
      sent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Sent' },
      archived: { bg: 'bg-slate-200', text: 'text-slate-600', label: 'Archived' },
    };
    const config = configs[status] || configs.draft;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const exportStatementToCSV = (statement: Statement) => {
    let csv = '';

    if (managementOrg) {
      csv += `${managementOrg.name}\n`;
      csv += `${managementOrg.address_line_1}${managementOrg.address_line_2 ? ', ' + managementOrg.address_line_2 : ''}\n`;
      csv += `${managementOrg.city}, ${managementOrg.province} ${managementOrg.postal_code}\n`;
      if (managementOrg.phone_number) csv += `Phone: ${managementOrg.phone_number}\n`;
      if (managementOrg.vat_number) csv += `VAT No: ${managementOrg.vat_number}`;
      if (managementOrg.company_registration_number) csv += ` | Reg No: ${managementOrg.company_registration_number}`;
      csv += `\n\n`;
    }

    csv += `STATEMENT\n`;
    csv += `Statement Number: ${statement.statement_number}\n`;
    csv += `Statement Date: ${formatDate(statement.statement_date)}\n`;
    csv += `Period: ${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}\n\n`;

    csv += `Bill To:\n`;
    csv += `${statement.organization?.name || ''}\n`;
    if (statement.organization?.address_line_1) {
      csv += `${statement.organization.address_line_1}${statement.organization.address_line_2 ? ', ' + statement.organization.address_line_2 : ''}\n`;
    }
    csv += `\n`;

    csv += `Opening Balance,${statement.opening_balance.toFixed(2)}\n\n`;

    csv += `Invoices\n`;
    csv += `Invoice Number,Date,Total Amount,Amount Paid,Outstanding,Status\n`;
    statementInvoices.forEach((inv) => {
      csv += `${inv.invoice_number},${formatDate(inv.invoice_date)},${inv.total_amount.toFixed(2)},${inv.amount_paid.toFixed(2)},${inv.amount_outstanding.toFixed(2)},${inv.status}\n`;
    });

    if (statementCreditNotes.length > 0) {
      csv += `\nCredit Notes\n`;
      csv += `Credit Note Number,Date,Amount,Status\n`;
      statementCreditNotes.forEach((cn) => {
        csv += `${cn.credit_note_number},${formatDate(cn.credit_note_date)},${cn.total_amount.toFixed(2)},${cn.status}\n`;
      });
    }

    csv += `\nSummary\n`;
    csv += `Opening Balance,${statement.opening_balance.toFixed(2)}\n`;
    csv += `Total Invoiced,${statement.total_invoiced.toFixed(2)}\n`;
    csv += `Total Paid,${statement.total_paid.toFixed(2)}\n`;
    csv += `Total Credit Notes,${statement.total_credit_notes.toFixed(2)}\n`;
    csv += `Closing Balance,${statement.closing_balance.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement_${statement.statement_number}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const printStatement = () => {
    window.print();
  };

  // --- Statement Detail View ---
  if (selectedStatement) {
    return (
      <>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { margin: 0 !important; padding: 0 !important; }
            html, body { height: auto !important; overflow: visible !important; }
            #statement-detail {
              box-shadow: none !important; margin: 0 !important; border-radius: 0 !important;
              page-break-after: avoid !important;
            }
            #statement-detail > div { padding: 1rem !important; }
            @page { margin: 0.5cm; size: A4; }
            table { font-size: 0.875rem !important; }
          }
        `}</style>

        <div className="space-y-4">
          <div className="flex items-center justify-between no-print">
            <button
              onClick={() => setSelectedStatement(null)}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Statements
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => exportStatementToCSV(selectedStatement)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button
                onClick={printStatement}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileText className="w-4 h-4" /> Print/PDF
              </button>
              <button
                onClick={() => emailStatement(selectedStatement)}
                disabled={sendingEmail === selectedStatement.id}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-60"
              >
                {sendingEmail === selectedStatement.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {selectedStatement.status === 'sent' ? 'Resend Email' : 'Email to Client'}
              </button>
            </div>
          </div>

          {emailResult && emailResult.orgId === selectedStatement.id && (
            <div className={`no-print rounded-lg p-3 text-sm ${emailResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {emailResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {emailResult.message}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md overflow-hidden" id="statement-detail">
            {managementOrg && (
              <div className="p-8 border-b border-gray-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">{managementOrg.name}</h1>
                    <div className="text-sm text-gray-600 space-y-0.5">
                      <p>{managementOrg.address_line_1}{managementOrg.address_line_2 && `, ${managementOrg.address_line_2}`}</p>
                      <p>{managementOrg.city}, {managementOrg.province} {managementOrg.postal_code}</p>
                      {managementOrg.country && <p>{managementOrg.country}</p>}
                      {managementOrg.phone_number && <p>Phone: {managementOrg.phone_number}</p>}
                      <div className="flex gap-4 mt-2 font-medium">
                        {managementOrg.vat_number && <p>VAT No: {managementOrg.vat_number}</p>}
                        {managementOrg.company_registration_number && <p>Reg No: {managementOrg.company_registration_number}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <img src="/MyFuelApp_logo.png" alt="MyFuelApp Logo" className="h-28 w-auto" />
                  </div>
                </div>
              </div>
            )}

            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">STATEMENT</h2>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-semibold">Statement Number:</span> {selectedStatement.statement_number}</p>
                    <p><span className="font-semibold">Statement Date:</span> {formatDate(selectedStatement.statement_date)}</p>
                    <p><span className="font-semibold">Period:</span> {formatDate(selectedStatement.period_start)} - {formatDate(selectedStatement.period_end)}</p>
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(selectedStatement.status)}
                  {selectedStatement.sent_at && (
                    <p className="mt-3 text-xs text-gray-500">
                      Sent to {selectedStatement.sent_to_email} on {formatDate(selectedStatement.sent_at)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Bill To:</h3>
                <div className="text-sm text-gray-700 space-y-0.5">
                  <p className="font-medium text-gray-900">{selectedStatement.organization?.name}</p>
                  {selectedStatement.organization?.address_line_1 && (
                    <p>{selectedStatement.organization.address_line_1}{selectedStatement.organization.address_line_2 && `, ${selectedStatement.organization.address_line_2}`}</p>
                  )}
                  {selectedStatement.organization?.city && (
                    <p>{selectedStatement.organization.city}, {selectedStatement.organization.province} {selectedStatement.organization.postal_code}</p>
                  )}
                  {selectedStatement.organization?.country && <p>{selectedStatement.organization.country}</p>}
                  <div className="flex gap-4 mt-2 font-medium">
                    {selectedStatement.organization?.vat_number && <p>VAT No: {selectedStatement.organization.vat_number}</p>}
                    {selectedStatement.organization?.company_registration_number && <p>Reg No: {selectedStatement.organization.company_registration_number}</p>}
                  </div>
                </div>
              </div>

              {/* Summary box */}
              <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 uppercase font-medium">Opening Balance</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(selectedStatement.opening_balance)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs text-blue-500 uppercase font-medium">Total Invoiced</p>
                  <p className="text-lg font-bold text-blue-700 mt-1">{formatCurrency(selectedStatement.total_invoiced)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-xs text-green-600 uppercase font-medium">Total Paid</p>
                  <p className="text-lg font-bold text-green-700 mt-1">{formatCurrency(selectedStatement.total_paid)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-xs text-red-500 uppercase font-medium">Closing Balance</p>
                  <p className="text-lg font-bold text-red-700 mt-1">{formatCurrency(selectedStatement.closing_balance)}</p>
                </div>
              </div>

              {/* Invoices table */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Invoices for this Period</h3>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Invoice #</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">Paid</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">Outstanding</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {statementInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">No invoices in this period</td>
                      </tr>
                    ) : (
                      statementInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{inv.invoice_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(inv.invoice_date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(inv.total_amount)}</td>
                          <td className="px-4 py-3 text-sm text-green-600 text-right">{formatCurrency(inv.amount_paid)}</td>
                          <td className="px-4 py-3 text-sm text-red-600 text-right">{formatCurrency(inv.amount_outstanding)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-medium capitalize">{inv.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Credit notes table */}
              {statementCreditNotes.length > 0 && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Credit Notes for this Period</h3>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Credit Note #</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">Amount</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {statementCreditNotes.map((cn) => (
                        <tr key={cn.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{cn.credit_note_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(cn.credit_note_date)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(cn.total_amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-medium capitalize">{cn.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Final summary */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="space-y-2 max-w-xs ml-auto">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Opening Balance:</span>
                    <span className="font-medium">{formatCurrency(selectedStatement.opening_balance)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Invoiced:</span>
                    <span className="font-medium">{formatCurrency(selectedStatement.total_invoiced)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="font-medium text-green-600">{formatCurrency(selectedStatement.total_paid)}</span>
                  </div>
                  {selectedStatement.total_credit_notes > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Credit Notes:</span>
                      <span className="font-medium text-orange-600">-{formatCurrency(selectedStatement.total_credit_notes)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Closing Balance:</span>
                    <span className={selectedStatement.closing_balance > 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(selectedStatement.closing_balance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // --- Generate Modal ---
  if (showGenerateModal) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-teal-600" />
            <h2 className="text-lg font-bold text-gray-900">Generate Client Statements</h2>
          </div>
          <button
            onClick={() => setShowGenerateModal(false)}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Statements
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {generationResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3 text-green-800">
              <CheckCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-medium">Statement generation complete</p>
                <p className="text-sm mt-1">
                  {generationResult.statements_created || 0} statement(s) created, {generationResult.statements_skipped || 0} skipped (already existed).
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Period selection */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Statement Period</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period Start Date</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period End Date</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Organization selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Select Clients</h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAllOrgs}
                  className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllOrgs}
                  className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto divide-y divide-gray-100">
              {organizations.map((org) => (
                <label
                  key={org.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedOrgIds.includes(org.id)}
                    onChange={() => toggleOrgSelection(org.id)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 truncate">{org.name}</span>
                      {org.is_garage_managed && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Garage-managed</span>
                      )}
                    </div>
                    {org.main_user_email ? (
                      <p className="text-xs text-gray-500 ml-6 mt-0.5">{org.main_user_email}</p>
                    ) : (
                      <p className="text-xs text-amber-600 ml-6 mt-0.5">No main user email — statement cannot be emailed</p>
                    )}
                  </div>
                </label>
              ))}
              {organizations.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">No client organizations found</div>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              {selectedOrgIds.length} organization(s) selected
            </p>
          </div>

          {/* Generate button */}
          <div className="flex justify-end">
            <button
              onClick={generateStatements}
              disabled={generating || !periodStart || !periodEnd || selectedOrgIds.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              {generating ? 'Generating...' : `Generate ${selectedOrgIds.length} Statement(s)`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Statement List View ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-teal-600" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Client Statements</h2>
            <p className="text-sm text-gray-600">Generate and email account statements to clients</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Generate Statements
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {emailResult && (
        <div className={`rounded-lg p-3 text-sm ${emailResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {emailResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {emailResult.message}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-500">Loading statements...</div>
      ) : statements.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">No Statements Yet</h3>
          <p className="text-sm text-gray-500 mb-4">Generate your first client statement to get started.</p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Generate Statements
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Statement #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Period</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Closing Balance</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sent To</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statements.map((stmt) => (
                <tr key={stmt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{stmt.statement_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{stmt.organization?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(stmt.period_start)} - {formatDate(stmt.period_end)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={stmt.closing_balance > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                      {formatCurrency(stmt.closing_balance)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(stmt.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {stmt.sent_to_email ? (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <span className="text-xs">{stmt.sent_to_email}</span>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => viewStatementDetails(stmt)}
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
                        title="View statement"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => emailStatement(stmt)}
                        disabled={sendingEmail === stmt.id}
                        className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-100 transition-colors disabled:opacity-50"
                        title="Email to client"
                      >
                        {sendingEmail === stmt.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
