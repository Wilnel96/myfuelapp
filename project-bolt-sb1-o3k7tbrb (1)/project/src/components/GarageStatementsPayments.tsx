import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, CreditCard, Plus, Calendar, Download, Printer, Eye, ArrowLeft, DollarSign, Fuel, AlertCircle, Search, X, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';

interface Organization {
  id: string;
  name: string;
  vat_number: string | null;
}

interface Statement {
  id: string;
  statement_number: string;
  statement_date: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  total_invoices: number;
  total_payments: number;
  closing_balance: number;
}

interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  transaction_date: string;
  vehicle_registration: string;
  driver_name: string;
  fuel_type: string;
  liters: number;
  price_per_liter: number;
  total_amount: number;
  odometer_reading?: number;
  oil_type?: string;
  oil_quantity?: number;
  oil_unit_price?: number;
  oil_total_amount?: number;
}

interface GarageStatementsPaymentsProps {
  garageId: string;
  garageName: string;
  organizationId: string;
  organizationName: string;
  initialTab?: 'statements' | 'payments';
  directPaymentMode?: boolean;
  onBack: () => void;
}

export default function GarageStatementsPayments({
  garageId,
  garageName,
  organizationId,
  organizationName,
  initialTab = 'statements',
  directPaymentMode = false,
  onBack
}: GarageStatementsPaymentsProps) {
  const [activeTab, setActiveTab] = useState<'statements' | 'payments'>(initialTab);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateStatement, setShowCreateStatement] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<Statement | null>(null);
  const [viewingStatementDetails, setViewingStatementDetails] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [statementInvoices, setStatementInvoices] = useState<Invoice[]>([]);
  const [statementPayments, setStatementPayments] = useState<Payment[]>([]);

  const [statementPeriodStart, setStatementPeriodStart] = useState('');
  const [statementPeriodEnd, setStatementPeriodEnd] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'eft' | 'card' | 'cheque'>('eft');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [filterTo, setFilterTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterMethod, setFilterMethod] = useState('');
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [recalcSuccess, setRecalcSuccess] = useState('');

  useEffect(() => {
    loadData();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (profile?.role === 'super_admin') setIsSuperAdmin(true);
          });
      }
    });
  }, []);

  useEffect(() => {
    if (initialTab === 'payments' && directPaymentMode) {
      setShowAddPayment(true);
    }
  }, [initialTab, directPaymentMode]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastStatement = statements[0];
    if (lastStatement) {
      const nextDay = new Date(lastStatement.period_end);
      nextDay.setDate(nextDay.getDate() + 1);
      const start = nextDay.toISOString().split('T')[0];
      setStatementPeriodStart(start);
      // Ensure end is never before start
      setStatementPeriodEnd(prev => (prev < start ? start : prev));
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setStatementPeriodStart(thirtyDaysAgo.toISOString().split('T')[0]);
      setStatementPeriodEnd(today);
    }
  }, [statements]);

  useEffect(() => {
    const from = new Date(filterFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(filterTo);
    to.setHours(23, 59, 59, 999);
    setFilteredPayments(
      payments.filter(p => {
        const d = new Date(p.payment_date);
        const inRange = d >= from && d <= to;
        const methodMatch = !filterMethod || p.payment_method === filterMethod;
        return inRange && methodMatch;
      })
    );
  }, [payments, filterFrom, filterTo, filterMethod]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadStatements(), loadPayments()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatements = async () => {
    const { data, error: statementsError } = await supabase
      .from('garage_statements')
      .select('*')
      .eq('garage_id', garageId)
      .eq('organization_id', organizationId)
      .order('statement_date', { ascending: false });

    if (statementsError) throw statementsError;
    setStatements(data || []);
  };

  const loadPayments = async () => {
    const { data, error: paymentsError } = await supabase
      .from('garage_client_payments')
      .select('*')
      .eq('garage_id', garageId)
      .eq('organization_id', organizationId)
      .order('payment_date', { ascending: false });

    if (paymentsError) throw paymentsError;
    setPayments(data || []);
  };

  const handleCreateStatement = async () => {
    if (!statementPeriodStart || !statementPeriodEnd) {
      setError('Please set both a period start and end date.');
      return;
    }
    if (statementPeriodStart > statementPeriodEnd) {
      setError('Period start date cannot be after the period end date.');
      return;
    }
    try {
      setError('');
      setSaving(true);

      const { data: statementNumberData, error: numberError } = await supabase
        .rpc('generate_garage_statement_number', { p_garage_id: garageId });

      if (numberError) throw numberError;

      const { data: previousStatement } = await supabase
        .from('garage_statements')
        .select('closing_balance')
        .eq('garage_id', garageId)
        .eq('organization_id', organizationId)
        .order('statement_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const openingBalance = previousStatement?.closing_balance || 0;

      const { data: newStatement, error: insertError } = await supabase
        .from('garage_statements')
        .insert({
          garage_id: garageId,
          organization_id: organizationId,
          statement_number: statementNumberData,
          statement_date: statementPeriodEnd,
          period_start: statementPeriodStart,
          period_end: statementPeriodEnd,
          opening_balance: openingBalance,
          total_invoices: 0,
          total_payments: 0,
          closing_balance: openingBalance
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { error: calculateError } = await supabase
        .rpc('calculate_statement_totals', { p_statement_id: newStatement.id });

      if (calculateError) throw calculateError;

      setShowCreateStatement(false);
      await loadStatements();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    try {
      setError('');
      setSaving(true);

      if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
        throw new Error('Please enter a valid payment amount');
      }

      const { data: paymentNumberData, error: numberError } = await supabase
        .rpc('generate_payment_number', { p_garage_id: garageId });

      if (numberError) throw numberError;

      const { error: insertError } = await supabase
        .from('garage_client_payments')
        .insert({
          garage_id: garageId,
          organization_id: organizationId,
          payment_number: paymentNumberData,
          payment_date: paymentDate,
          amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          reference: paymentReference || null,
          notes: paymentNotes || null
        });

      if (insertError) throw insertError;

      setShowAddPayment(false);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      await loadPayments();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadStatementDetails = async (statement: Statement) => {
    try {
      setLoadingDetails(true);
      setError('');
      setStatementInvoices([]);
      setStatementPayments([]);
      setSelectedStatement(statement);
      setViewingStatementDetails(true);

      const [invoicesResult, paymentsResult] = await Promise.all([
        supabase.rpc('get_statement_invoices', {
          p_garage_id: garageId,
          p_organization_id: organizationId,
          p_period_start: statement.period_start,
          p_period_end: statement.period_end,
        }),
        supabase.rpc('get_statement_payments', {
          p_garage_id: garageId,
          p_organization_id: organizationId,
          p_period_start: statement.period_start,
          p_period_end: statement.period_end,
        }),
      ]);

      if (invoicesResult.error) throw invoicesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      setStatementInvoices(invoicesResult.data || []);
      setStatementPayments(paymentsResult.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const printStatement = async (statement: Statement) => {
    // Use already-loaded data if this statement is currently open, otherwise fetch fresh
    let invoices: Invoice[] = (selectedStatement?.id === statement.id) ? statementInvoices : [];
    let pmts: Payment[] = (selectedStatement?.id === statement.id) ? statementPayments : [];

    if (invoices.length === 0 && pmts.length === 0) {
      const [invRes, pmtRes] = await Promise.all([
        supabase.rpc('get_statement_invoices', {
          p_garage_id: garageId,
          p_organization_id: organizationId,
          p_period_start: statement.period_start,
          p_period_end: statement.period_end,
        }),
        supabase.rpc('get_statement_payments', {
          p_garage_id: garageId,
          p_organization_id: organizationId,
          p_period_start: statement.period_start,
          p_period_end: statement.period_end,
        }),
      ]);
      invoices = invRes.data || [];
      pmts = pmtRes.data || [];
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ACCOUNT STATEMENT', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 7;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(garageName, pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 10;
    pdf.setDrawColor(17, 24, 39);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);

    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(107, 114, 128);
    pdf.text('STATEMENT DETAILS', margin, yPosition);

    yPosition += 3;
    pdf.setFillColor(249, 250, 251);
    pdf.rect(margin, yPosition, contentWidth, 25, 'F');

    yPosition += 5;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);

    pdf.text('Statement Number:', margin + 3, yPosition);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text(statement.statement_number, margin + 50, yPosition);

    yPosition += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Statement Date:', margin + 3, yPosition);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text(new Date(statement.statement_date).toLocaleDateString('en-ZA'), margin + 50, yPosition);

    yPosition += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Period:', margin + 3, yPosition);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text(`${new Date(statement.period_start).toLocaleDateString('en-ZA')} to ${new Date(statement.period_end).toLocaleDateString('en-ZA')}`, margin + 50, yPosition);

    yPosition += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Account:', margin + 3, yPosition);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text(organizationName, margin + 50, yPosition);

    yPosition += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(107, 114, 128);
    pdf.text('TRANSACTION DETAILS', margin, yPosition);

    yPosition += 5;

    pdf.setDrawColor(209, 213, 219);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);

    yPosition += 5;
    const n = (v: any) => Number(v);
    let runningBalance = n(statement.opening_balance);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text('Opening Balance:', margin + 5, yPosition);
    pdf.text(`R ${runningBalance.toFixed(2)}`, margin + contentWidth - 5, yPosition, { align: 'right' });

    yPosition += 6;

    interface Transaction {
      type: 'invoice' | 'payment';
      date: string;
      data: Invoice | Payment;
    }

    const allTransactions: Transaction[] = [];

    invoices.forEach(inv => {
      allTransactions.push({ type: 'invoice', date: inv.transaction_date, data: inv });
    });

    pmts.forEach(pmt => {
      allTransactions.push({ type: 'payment', date: pmt.payment_date, data: pmt });
    });

    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    allTransactions.forEach((txn) => {
      if (yPosition > 255) {
        pdf.addPage();
        yPosition = margin + 10;
      }

      if (txn.type === 'invoice') {
        const inv = txn.data as Invoice;
        const invTotal = n(inv.total_amount);
        runningBalance += invTotal;

        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.2);
        pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(17, 24, 39);
        pdf.text(`${new Date(inv.transaction_date).toLocaleDateString('en-ZA')}  ${inv.invoice_number}`, margin + 5, yPosition);
        pdf.text(`R ${invTotal.toFixed(2)}`, margin + contentWidth - 5, yPosition, { align: 'right' });

        yPosition += 4;

        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(55, 65, 81);
        const liters = n(inv.liters);
        const ppl = n(inv.price_per_liter);
        pdf.text(
          `Fuel: ${liters.toFixed(2)} L ${inv.fuel_type} @ R${ppl.toFixed(2)}/L = R${(liters * ppl).toFixed(2)}`,
          margin + 8, yPosition
        );
        yPosition += 3.5;

        if (inv.oil_type && inv.oil_quantity) {
          pdf.text(
            `Oil: ${inv.oil_quantity}x ${inv.oil_type} @ R${n(inv.oil_unit_price).toFixed(2)} = R${n(inv.oil_total_amount).toFixed(2)}`,
            margin + 8, yPosition
          );
          yPosition += 3.5;
        }

        pdf.text(
          `Driver: ${inv.driver_name || 'N/A'} | Vehicle: ${inv.vehicle_registration} | Odometer: ${inv.odometer_reading != null ? n(inv.odometer_reading).toLocaleString() : 'N/A'} km`,
          margin + 8, yPosition
        );
        yPosition += 4;

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(29, 78, 216);
        pdf.text(`Balance: R ${runningBalance.toFixed(2)}`, margin + contentWidth - 5, yPosition, { align: 'right' });
        yPosition += 5;

      } else {
        const pmt = txn.data as Payment;
        const pmtAmt = n(pmt.amount);
        runningBalance -= pmtAmt;

        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.2);
        pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(17, 24, 39);
        pdf.text(`${new Date(pmt.payment_date).toLocaleDateString('en-ZA')}  ${pmt.payment_number}`, margin + 5, yPosition);
        pdf.setTextColor(34, 197, 94);
        pdf.text(`-R ${pmtAmt.toFixed(2)}`, margin + contentWidth - 5, yPosition, { align: 'right' });

        yPosition += 4;

        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(55, 65, 81);
        pdf.text(
          `Payment received: ${pmt.payment_method.toUpperCase()}${pmt.reference ? `  Ref: ${pmt.reference}` : ''}${pmt.notes ? `  (${pmt.notes})` : ''}`,
          margin + 8, yPosition
        );
        yPosition += 4;

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(29, 78, 216);
        pdf.text(`Balance: R ${runningBalance.toFixed(2)}`, margin + contentWidth - 5, yPosition, { align: 'right' });
        yPosition += 5;
      }
    });

    yPosition += 5;
    pdf.setDrawColor(17, 24, 39);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);

    yPosition += 8;
    pdf.setFillColor(239, 246, 255);
    pdf.rect(margin, yPosition, contentWidth, 30, 'F');

    yPosition += 7;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text('Opening Balance:', margin + 5, yPosition);
    pdf.text(`R ${n(statement.opening_balance).toFixed(2)}`, margin + contentWidth - 5, yPosition, { align: 'right' });

    yPosition += 6;
    pdf.text('Total Invoices:', margin + 5, yPosition);
    pdf.text(`R ${n(statement.total_invoices).toFixed(2)}`, margin + contentWidth - 5, yPosition, { align: 'right' });

    yPosition += 6;
    pdf.text('Total Payments:', margin + 5, yPosition);
    pdf.text(`R ${n(statement.total_payments).toFixed(2)}`, margin + contentWidth - 5, yPosition, { align: 'right' });

    yPosition += 8;
    pdf.setFontSize(12);
    pdf.setTextColor(37, 99, 235);
    pdf.text('CLOSING BALANCE:', margin + 5, yPosition);
    pdf.text(`R ${n(statement.closing_balance).toFixed(2)}`, margin + contentWidth - 5, yPosition, { align: 'right' });

    const pdfBlob = pdf.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statement-${statement.statement_number}.pdf`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading statements and payments...</p>
        </div>
      </div>
    );
  }

  if (viewingStatementDetails && selectedStatement) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => {
                setViewingStatementDetails(false);
                setSelectedStatement(null);
              }}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Statements
            </button>
            <button
              onClick={() => printStatement(selectedStatement)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              Print Statement
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Title */}
          <div className="border-b-2 border-gray-900 pb-5 mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 tracking-wide">ACCOUNT STATEMENT</h1>
            <p className="text-gray-600 mt-1 font-medium">{garageName}</p>
          </div>

          {/* Statement meta + balance summary */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Statement Number</span>
                <span className="font-semibold text-gray-900">{selectedStatement.statement_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Statement Date</span>
                <span className="font-semibold text-gray-900">{new Date(selectedStatement.statement_date).toLocaleDateString('en-ZA')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Period</span>
                <span className="font-semibold text-gray-900">
                  {new Date(selectedStatement.period_start).toLocaleDateString('en-ZA')} – {new Date(selectedStatement.period_end).toLocaleDateString('en-ZA')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Account</span>
                <span className="font-semibold text-gray-900">{organizationName}</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Opening Balance</span>
                <span className="font-semibold text-gray-900">R {Number(selectedStatement.opening_balance).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Invoices</span>
                <span className="font-semibold text-red-600">R {Number(selectedStatement.total_invoices).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Payments</span>
                <span className="font-semibold text-green-600">– R {Number(selectedStatement.total_payments).toFixed(2)}</span>
              </div>
              <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
                <span className="font-bold text-blue-900">Closing Balance</span>
                <span className="text-lg font-bold text-blue-900">R {Number(selectedStatement.closing_balance).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loadingDetails ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">Loading transaction details...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Invoices section */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Fuel className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-gray-900">
                    Fuel Purchases &amp; Invoices
                    <span className="ml-2 text-sm font-normal text-gray-500">({statementInvoices.length})</span>
                  </h3>
                </div>

                {statementInvoices.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-gray-400 text-sm">
                    No invoices recorded in this period
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Driver / Vehicle</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fuel</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Oil / Other</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {statementInvoices.map((inv) => {
                          const fuelAmt = Number(inv.liters) * Number(inv.price_per_liter);
                          return (
                            <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                                {new Date(inv.transaction_date).toLocaleDateString('en-ZA')}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                                {inv.invoice_number}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{inv.driver_name || '—'}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{inv.vehicle_registration}</div>
                                {inv.odometer_reading != null && (
                                  <div className="text-xs text-gray-400">{Number(inv.odometer_reading).toLocaleString()} km</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">
                                  {inv.fuel_type}: {Number(inv.liters).toFixed(2)} L
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  @ R{Number(inv.price_per_liter).toFixed(2)}/L = <span className="font-semibold text-gray-700">R{fuelAmt.toFixed(2)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {inv.oil_type && inv.oil_quantity ? (
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {inv.oil_quantity}× {inv.oil_type}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      @ R{Number(inv.oil_unit_price ?? 0).toFixed(2)} = <span className="font-semibold text-gray-700">R{Number(inv.oil_total_amount ?? 0).toFixed(2)}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-bold text-gray-900">R {Number(inv.total_amount).toFixed(2)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-gray-700">
                            Total Invoices
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">
                            R {statementInvoices.reduce((s, inv) => s + Number(inv.total_amount), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Payments section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  <h3 className="text-base font-bold text-gray-900">
                    Payments Received
                    <span className="ml-2 text-sm font-normal text-gray-500">({statementPayments.length})</span>
                  </h3>
                </div>

                {statementPayments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-gray-400 text-sm">
                    No payments recorded in this period
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Received</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment #</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference / Notes</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {statementPayments.map((pmt) => (
                          <tr key={pmt.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {new Date(pmt.payment_date).toLocaleDateString('en-ZA')}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                              {pmt.payment_number}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 uppercase">
                                {pmt.payment_method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {pmt.reference && <div className="font-medium">{pmt.reference}</div>}
                              {pmt.notes && <div className="text-xs text-gray-400 mt-0.5">{pmt.notes}</div>}
                              {!pmt.reference && !pmt.notes && <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-bold text-green-600">R {Number(pmt.amount).toFixed(2)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-700">
                            Total Payments
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            R {statementPayments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {directPaymentMode ? 'Capture Payment' : showCreateStatement ? 'Create Statement' : showAddPayment ? 'Add Payment' : activeTab === 'statements' ? 'Statements' : 'Payments'}
            </h2>
            <p className="text-gray-600">{organizationName}</p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Accounts
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {recalcSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-green-600" />
            <p className="text-green-800">{recalcSuccess}</p>
          </div>
        )}

        {!directPaymentMode && !showCreateStatement && !showAddPayment && (
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('statements')}
              className={`pb-3 px-4 font-medium border-b-2 transition-colors ${
                activeTab === 'statements'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Statements
              </div>
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`pb-3 px-4 font-medium border-b-2 transition-colors ${
                activeTab === 'payments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payments
              </div>
            </button>
          </div>
        </div>
        )}

        {!directPaymentMode && activeTab === 'statements' && (
          <div>
            {!showCreateStatement && (
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Account Statements</h3>
              <button
                onClick={() => setShowCreateStatement(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Create Statement
              </button>
            </div>
            )}

            {showCreateStatement && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold mb-4">Create New Statement</h4>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Period Start</label>
                    <input
                      type="date"
                      value={statementPeriodStart}
                      onChange={(e) => setStatementPeriodStart(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Period End</label>
                    <input
                      type="date"
                      value={statementPeriodEnd}
                      onChange={(e) => setStatementPeriodEnd(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateStatement}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Creating...' : 'Create Statement'}
                  </button>
                  <button
                    onClick={() => setShowCreateStatement(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showCreateStatement && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statement #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opening</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoices</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Payments</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Closing</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {statements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No statements created yet
                      </td>
                    </tr>
                  ) : (
                    statements.map((statement) => (
                      <tr key={statement.id}>
                        <td className="px-4 py-3 text-sm font-medium">{statement.statement_number}</td>
                        <td className="px-4 py-3 text-sm">{new Date(statement.statement_date).toLocaleDateString('en-ZA')}</td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(statement.period_start).toLocaleDateString('en-ZA')} - {new Date(statement.period_end).toLocaleDateString('en-ZA')}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">R {statement.opening_balance.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">R {statement.total_invoices.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">R {statement.total_payments.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">R {statement.closing_balance.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => loadStatementDetails(statement)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => printStatement(statement)}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                              title="Print Statement"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {isSuperAdmin && (
                              <button
                                onClick={async () => {
                                  try {
                                    const { error: calcError } = await supabase.rpc('calculate_statement_totals', { p_statement_id: statement.id });
                                    if (calcError) throw calcError;
                                    await loadData();
                                    setRecalcSuccess('Statement recalculated.');
                                    setTimeout(() => setRecalcSuccess(''), 3000);
                                  } catch (err: any) {
                                    setError(err.message || 'Recalculation failed');
                                  }
                                }}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Recalculate Totals"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {(directPaymentMode || activeTab === 'payments') && (
          <div>
            {/* Header row */}
            {!directPaymentMode && activeTab === 'payments' && (
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Client Payments</h3>
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Payment
                </button>
              </div>
            )}

            {/* Add payment form */}
            {showAddPayment && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold mb-4">Record Payment</h4>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Payment Date</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="eft">EFT</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Reference</label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Payment reference"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Optional notes"
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddPayment}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Payment'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddPayment(false);
                      setPaymentAmount('');
                      setPaymentReference('');
                      setPaymentNotes('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Filter bar */}
            {!directPaymentMode && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex items-center gap-1 text-sm font-medium text-gray-600 mr-1">
                    <Search className="w-4 h-4" />
                    Filter
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                    <input
                      type="date"
                      value={filterFrom}
                      onChange={(e) => setFilterFrom(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      value={filterTo}
                      onChange={(e) => setFilterTo(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
                    <select
                      value={filterMethod}
                      onChange={(e) => setFilterMethod(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All methods</option>
                      <option value="eft">EFT</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  {(filterMethod) && (
                    <button
                      onClick={() => setFilterMethod('')}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                  <div className="ml-auto text-sm text-gray-500">
                    {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
                    {filteredPayments.length > 0 && (
                      <span className="ml-2 font-semibold text-green-700">
                        = R {filteredPayments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payments list */}
            {!directPaymentMode && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                          {payments.length === 0
                            ? 'No payments recorded yet'
                            : 'No payments found for the selected period'}
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{payment.payment_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{new Date(payment.payment_date).toLocaleDateString('en-ZA')}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 uppercase">
                              {payment.payment_method}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{payment.reference || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">R {Number(payment.amount).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{payment.notes || <span className="text-gray-300">—</span>}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredPayments.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-700 text-right">
                          Total
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                          R {filteredPayments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
