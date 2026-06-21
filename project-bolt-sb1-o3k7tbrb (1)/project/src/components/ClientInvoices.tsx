import { useState, useEffect } from 'react';
import { FileText, Eye, Download, Calendar, DollarSign, AlertCircle, CheckCircle, XCircle, FileSpreadsheet, Printer, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  invoice_date: string;
  billing_period_start: string;
  billing_period_end: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_outstanding: number;
  payment_terms: string;
  payment_due_date: string;
  payment_option?: string;
  fuel_payment_terms?: string;
  fuel_payment_interest_rate?: number;
  status: string;
  organization?: {
    name: string;
    vat_number?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    country?: string;
    company_registration_number?: string;
  };
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  item_type: string;
}

interface ManagementOrganization {
  name: string;
  vat_number: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  phone_number: string;
  company_registration_number: string;
}

interface ClientInvoicesProps {
  onNavigate?: (view: string) => void;
}

export default function ClientInvoices({ onNavigate }: ClientInvoicesProps = {}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [managementOrg, setManagementOrg] = useState<ManagementOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organization not found');

      const { data, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          organization:organizations(
            name,
            vat_number,
            address_line_1,
            address_line_2,
            city,
            province,
            postal_code,
            country,
            company_registration_number
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('invoice_date', { ascending: false });

      if (invoicesError) throw invoicesError;

      setInvoices(data || []);
    } catch (err: any) {
      setError('Failed to load invoices: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewInvoiceDetails = async (invoice: Invoice) => {
    try {
      setSelectedInvoice(invoice);

      const [lineItemsResult, managementOrgResult] = await Promise.all([
        supabase
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', invoice.id),
        supabase
          .from('organizations')
          .select('name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, phone_number, company_registration_number')
          .eq('is_management_org', true)
          .single()
      ]);

      if (lineItemsResult.error) throw lineItemsResult.error;
      if (managementOrgResult.error) throw managementOrgResult.error;

      setLineItems(lineItemsResult.data || []);
      setManagementOrg(managementOrgResult.data);
    } catch (err: any) {
      setError('Failed to load invoice details: ' + err.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return `R ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: any }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Calendar },
      paid: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      overdue: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const calculateTotals = () => {
    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.amount_outstanding, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);

    return { totalOutstanding, totalPaid, totalAmount };
  };

  const exportInvoiceToCSV = (invoice: Invoice, items: InvoiceLineItem[]) => {
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

    csv += `Invoice Number,${invoice.invoice_number}\n`;
    csv += `Invoice Date,${formatDate(invoice.invoice_date)}\n`;
    csv += `Billing Period,"${formatDate(invoice.billing_period_start)} - ${formatDate(invoice.billing_period_end)}"\n`;
    csv += `Payment Terms,${invoice.payment_terms}\n`;
    csv += `Payment Due Date,${formatDate(invoice.payment_due_date)}\n`;
    csv += `Status,${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}\n`;
    csv += `\n`;
    csv += `Line Items\n`;
    csv += `Description,Quantity,Unit Price,Total\n`;

    items.forEach((item) => {
      csv += `"${item.description}",${item.quantity},${item.unit_price.toFixed(2)},${item.line_total.toFixed(2)}\n`;
    });

    csv += `\n`;
    csv += `Subtotal,,${invoice.subtotal.toFixed(2)}\n`;
    csv += `VAT (15%),,${invoice.vat_amount.toFixed(2)}\n`;
    csv += `Total,,${invoice.total_amount.toFixed(2)}\n`;
    csv += `Amount Paid,,${invoice.amount_paid.toFixed(2)}\n`;
    csv += `Amount Outstanding,,${invoice.amount_outstanding.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoice_number}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportAllInvoicesToCSV = () => {
    let csv = 'Invoice Number,Date,Billing Period Start,Billing Period End,Payment Terms,Due Date,Subtotal,VAT,Total,Amount Paid,Amount Outstanding,Status\n';

    invoices.forEach((invoice) => {
      csv += `${invoice.invoice_number},`;
      csv += `${formatDate(invoice.invoice_date)},`;
      csv += `${formatDate(invoice.billing_period_start)},`;
      csv += `${formatDate(invoice.billing_period_end)},`;
      csv += `"${invoice.payment_terms}",`;
      csv += `${formatDate(invoice.payment_due_date)},`;
      csv += `${invoice.subtotal.toFixed(2)},`;
      csv += `${invoice.vat_amount.toFixed(2)},`;
      csv += `${invoice.total_amount.toFixed(2)},`;
      csv += `${invoice.amount_paid.toFixed(2)},`;
      csv += `${invoice.amount_outstanding.toFixed(2)},`;
      csv += `${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printInvoice = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading invoices...</div>
      </div>
    );
  }

  if (selectedInvoice) {
    return (
      <>
        <style>{`
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
            html, body {
              height: auto !important;
              overflow: visible !important;
            }
            #invoice-detail {
              box-shadow: none !important;
              page-break-after: avoid !important;
              margin: 0 !important;
              border-radius: 0 !important;
            }
            #invoice-detail > div {
              padding: 1rem !important;
            }
            .space-y-4 {
              height: auto !important;
            }
            .mb-8 {
              margin-bottom: 1rem !important;
            }
            .p-8 {
              padding: 1rem !important;
            }
            .pt-6 {
              padding-top: 0.75rem !important;
            }
            @page {
              margin: 0.5cm;
              size: A4;
            }
            table {
              font-size: 0.875rem !important;
            }
          }
        `}</style>

        <div className="space-y-4">
          <div className="flex items-center justify-between no-print">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Invoices
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => exportInvoiceToCSV(selectedInvoice, lineItems)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={printInvoice}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print/PDF
              </button>
            </div>
          </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden" id="invoice-detail">
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
                  <img
                    src="/MyFuelApp_logo.png"
                    alt="MyFuelApp Logo"
                    className="h-28 w-auto"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h2>
                <div className="space-y-1 text-sm">
                  <p><span className="font-semibold">Invoice Number:</span> {selectedInvoice.invoice_number}</p>
                  <p><span className="font-semibold">Invoice Date:</span> {formatDate(selectedInvoice.invoice_date)}</p>
                  <p><span className="font-semibold">Billing Period:</span> {formatDate(selectedInvoice.billing_period_start)} - {formatDate(selectedInvoice.billing_period_end)}</p>
                </div>
              </div>
              <div className="text-right">
                {getStatusBadge(selectedInvoice.status)}
                <div className="mt-4 space-y-1 text-sm">
                  {selectedInvoice.payment_option && (
                    <div className="mb-2 pb-2 border-b">
                      <p className="font-semibold text-gray-900">Payment Option:</p>
                      <p className="text-gray-600">{selectedInvoice.payment_option}</p>
                      {selectedInvoice.payment_option === 'EFT Payment' && selectedInvoice.fuel_payment_terms && (
                        <>
                          <p className="text-xs text-gray-500 mt-1">Fuel Terms: {selectedInvoice.fuel_payment_terms}</p>
                          {selectedInvoice.fuel_payment_interest_rate && selectedInvoice.fuel_payment_terms !== 'Same Day' && (
                            <p className="text-xs text-gray-500">Interest Rate: {selectedInvoice.fuel_payment_interest_rate}%</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <p className="font-semibold text-gray-900">Payment Terms:</p>
                  <p className="text-gray-600">{selectedInvoice.payment_terms}</p>
                  <p className="text-red-600 font-bold mt-2">Payment Due: {formatDate(selectedInvoice.payment_due_date)}</p>
                </div>
              </div>
            </div>

            <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Bill To:</h3>
              <div className="text-sm text-gray-700 space-y-0.5">
                <p className="font-medium text-gray-900">{selectedInvoice.organization?.name}</p>
                {selectedInvoice.organization?.address_line_1 && (
                  <p>{selectedInvoice.organization.address_line_1}{selectedInvoice.organization.address_line_2 && `, ${selectedInvoice.organization.address_line_2}`}</p>
                )}
                {selectedInvoice.organization?.city && (
                  <p>{selectedInvoice.organization.city}, {selectedInvoice.organization.province} {selectedInvoice.organization.postal_code}</p>
                )}
                {selectedInvoice.organization?.country && <p>{selectedInvoice.organization.country}</p>}
                <div className="flex gap-4 mt-2 font-medium">
                  {selectedInvoice.organization?.vat_number && <p>VAT No: {selectedInvoice.organization.vat_number}</p>}
                  {selectedInvoice.organization?.company_registration_number && <p>Reg No: {selectedInvoice.organization.company_registration_number}</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Line Items</h3>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">Quantity</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="space-y-2 max-w-xs ml-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT (15%):</span>
                  <span className="font-medium">{formatCurrency(selectedInvoice.vat_amount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedInvoice.total_amount)}</span>
                </div>
                {selectedInvoice.amount_paid > 0 && (
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(selectedInvoice.amount_paid)}</span>
                  </div>
                )}
                {selectedInvoice.amount_outstanding > 0 && (
                  <div className="flex justify-between text-sm text-red-600 font-medium">
                    <span>Amount Outstanding:</span>
                    <span>{formatCurrency(selectedInvoice.amount_outstanding)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Fee Invoices</h2>
            <p className="text-sm text-gray-600">View your monthly invoices and payment history</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoices.length > 0 && (
            <button
              onClick={exportAllInvoicesToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export All to CSV
            </button>
          )}
          {onNavigate && (
            <button
              onClick={() => onNavigate('invoices-menu')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Invoices Menu
            </button>
          )}
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

      {invoices.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-500 text-white p-2 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Total Invoiced</h4>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalAmount)}</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-green-500 text-white p-2 rounded-lg">
                <CheckCircle className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Total Paid</h4>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalPaid)}</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-orange-500 text-white p-2 rounded-lg">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Outstanding</h4>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalOutstanding)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Billing Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Due Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Outstanding</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Payment Option</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(invoice.payment_due_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(invoice.amount_outstanding)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {invoice.payment_option ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          invoice.payment_option === 'EFT Payment' ? 'bg-green-100 text-green-800' :
                          invoice.payment_option === 'Card Payment' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {invoice.payment_option}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{getStatusBadge(invoice.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewInvoiceDetails(invoice)}
                          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
