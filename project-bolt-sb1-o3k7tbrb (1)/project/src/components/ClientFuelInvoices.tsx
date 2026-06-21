import { useState, useEffect } from 'react';
import { FileText, Search, Calendar, DollarSign, Fuel, Download, Eye, AlertCircle, Printer, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateFuelInvoicePDF, renderInvoiceToPDF, downloadPDFBlob, type InvoiceData } from '../lib/invoicePdfGenerator';
import jsPDF from 'jspdf';

interface FuelInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  transaction_date: string;
  vehicle_registration: string;
  driver_name: string;
  garage_name: string;
  garage_address: string;
  garage_vat_number?: string;
  fuel_type: string;
  liters: number;
  price_per_liter: number;
  total_amount: number;
  odometer_reading: number;
  email_sent: boolean;
  email_sent_at: string | null;
  oil_quantity?: number;
  oil_unit_price?: number;
  oil_total_amount?: number;
  oil_type?: string;
  oil_brand?: string;
  fuel_amount?: number;
  client_name?: string;
  client_address?: string;
}

interface ClientFuelInvoicesProps {
  onNavigate?: (view: string) => void;
}

export default function ClientFuelInvoices({ onNavigate }: ClientFuelInvoicesProps) {
  const [invoices, setInvoices] = useState<FuelInvoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<FuelInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<FuelInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, startDate, endDate]);

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

      if (!profile?.organization_id) throw new Error('No organization found');

      const { data, error: invoicesError } = await supabase
        .from('fuel_transaction_invoices')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('transaction_date', { ascending: false });

      if (invoicesError) throw invoicesError;

      setInvoices(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(term) ||
          inv.vehicle_registration.toLowerCase().includes(term) ||
          inv.driver_name.toLowerCase().includes(term) ||
          inv.garage_name.toLowerCase().includes(term)
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter((inv) => new Date(inv.transaction_date) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((inv) => new Date(inv.transaction_date) <= end);
    }

    setFilteredInvoices(filtered);
  };

  const getTotalAmount = () => {
    return filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount.toString()), 0);
  };

  const getTotalLiters = () => {
    return filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.liters.toString()), 0);
  };

  const printInvoice = async (invoice: FuelInvoice, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      const invoiceData: InvoiceData = {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        transaction_date: invoice.transaction_date,
        vehicle_registration: invoice.vehicle_registration,
        driver_name: invoice.driver_name || 'N/A',
        garage_name: invoice.garage_name,
        garage_vat_number: invoice.garage_vat_number,
        garage_address: invoice.garage_address,
        client_name: invoice.client_name,
        client_address: invoice.client_address,
        fuel_type: invoice.fuel_type,
        liters: invoice.liters,
        price_per_liter: invoice.price_per_liter,
        total_amount: invoice.total_amount,
        odometer_reading: invoice.odometer_reading,
        oil_quantity: invoice.oil_quantity,
        oil_type: invoice.oil_type,
        oil_brand: invoice.oil_brand,
        oil_unit_price: invoice.oil_unit_price,
        oil_total_amount: invoice.oil_total_amount,
      };

      const pdfBlob = await generateFuelInvoicePDF(invoiceData);
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const printWindow = window.open(pdfUrl, '_blank');
      if (!printWindow) {
        alert('Please allow pop-ups to print invoices');
        URL.revokeObjectURL(pdfUrl);
        return;
      }

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };

      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 5000);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      alert('Failed to generate invoice PDF');
    }
  };


  const exportToCSV = () => {
    const headers = ['Invoice Number', 'Date', 'Vehicle', 'Driver', 'Garage', 'Fuel Type', 'Liters', 'Price/L', 'Total', 'Odometer'];
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number,
      new Date(inv.invoice_date).toLocaleDateString('en-ZA'),
      inv.vehicle_registration,
      inv.driver_name,
      inv.garage_name,
      inv.fuel_type,
      parseFloat(inv.liters.toString()).toFixed(2),
      parseFloat(inv.price_per_liter.toString()).toFixed(2),
      parseFloat(inv.total_amount.toString()).toFixed(2),
      inv.odometer_reading.toString()
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fuel-invoices-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSingleInvoiceToCSV = (invoice: FuelInvoice) => {
    const fuelAmount = parseFloat(invoice.liters.toString()) * parseFloat(invoice.price_per_liter.toString());
    const hasOil = invoice.oil_quantity && parseFloat(invoice.oil_quantity.toString()) > 0;

    const csvData = [
      ['Field', 'Value'],
      ['Invoice Number', invoice.invoice_number],
      ['Invoice Date', new Date(invoice.invoice_date).toLocaleDateString('en-ZA')],
      ['Transaction Date', new Date(invoice.transaction_date).toLocaleDateString('en-ZA')],
      [''],
      ['Vehicle Registration', invoice.vehicle_registration],
      ['Driver', invoice.driver_name],
      ['Odometer Reading', `${invoice.odometer_reading.toLocaleString()} km`],
      [''],
      ['Fuel Station', invoice.garage_name],
      ['Station Address', invoice.garage_address],
      ...(invoice.garage_vat_number ? [['Station VAT Number', invoice.garage_vat_number]] : []),
      [''],
      ['Fuel Type', invoice.fuel_type],
      ['Liters', parseFloat(invoice.liters.toString()).toFixed(2)],
      ['Price per Liter', `R ${parseFloat(invoice.price_per_liter.toString()).toFixed(2)}`],
      ['Fuel Amount', `R ${fuelAmount.toFixed(2)}`],
      ...(hasOil ? [
        [''],
        ['Oil Type', `${invoice.oil_type || 'N/A'}${invoice.oil_brand ? ` (${invoice.oil_brand})` : ''}`],
        ['Oil Quantity', `${parseFloat(invoice.oil_quantity.toString()).toFixed(2)} units`],
        ['Oil Unit Price (incl VAT)', `R ${parseFloat(invoice.oil_unit_price?.toString() || '0').toFixed(2)}`],
        ['Oil Amount (incl VAT)', `R ${parseFloat(invoice.oil_total_amount?.toString() || '0').toFixed(2)}`]
      ] : []),
      [''],
      ['TOTAL AMOUNT', `R ${parseFloat(invoice.total_amount.toString()).toFixed(2)}`]
    ];

    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fuel-invoice-${invoice.invoice_number}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportInvoiceToPDF = async (invoice: FuelInvoice, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      const pdfBlob = await generateFuelInvoicePDF({
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        transaction_date: invoice.transaction_date,
        vehicle_registration: invoice.vehicle_registration,
        driver_name: invoice.driver_name,
        garage_name: invoice.garage_name,
        garage_vat_number: invoice.garage_vat_number,
        garage_address: invoice.garage_address,
        client_name: invoice.client_name,
        client_address: invoice.client_address,
        fuel_type: invoice.fuel_type,
        liters: invoice.liters,
        price_per_liter: invoice.price_per_liter,
        total_amount: invoice.total_amount,
        odometer_reading: invoice.odometer_reading,
        oil_quantity: invoice.oil_quantity,
        oil_type: invoice.oil_type,
        oil_brand: invoice.oil_brand,
        oil_unit_price: invoice.oil_unit_price,
        oil_total_amount: invoice.oil_total_amount
      });

      downloadPDFBlob(pdfBlob, `fuel-invoice-${invoice.invoice_number}.pdf`);
    } catch (err) {
      console.error('Error exporting invoice to PDF:', err);
      alert('Failed to export invoice. Please try again.');
    }
  };


  const printAllInvoices = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (filteredInvoices.length === 0) {
      alert('No invoices to print');
      return;
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    filteredInvoices.forEach((invoice, index) => {
      if (index > 0) pdf.addPage();
      renderInvoiceToPDF(pdf, {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        transaction_date: invoice.transaction_date,
        vehicle_registration: invoice.vehicle_registration,
        driver_name: invoice.driver_name,
        garage_name: invoice.garage_name,
        garage_vat_number: invoice.garage_vat_number,
        garage_address: invoice.garage_address,
        client_name: invoice.client_name,
        client_address: invoice.client_address,
        fuel_type: invoice.fuel_type,
        liters: invoice.liters,
        price_per_liter: invoice.price_per_liter,
        total_amount: invoice.total_amount,
        odometer_reading: invoice.odometer_reading,
        oil_quantity: invoice.oil_quantity,
        oil_type: invoice.oil_type,
        oil_brand: invoice.oil_brand,
        oil_unit_price: invoice.oil_unit_price,
        oil_total_amount: invoice.oil_total_amount,
      }, 15, { compact: true });
    });

    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    const printWindow = window.open(pdfUrl, '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print invoices');
      URL.revokeObjectURL(pdfUrl);
      return;
    }

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };

    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 5000);
  };


  const exportAllInvoicesToPDF = () => {
    if (filteredInvoices.length === 0) {
      alert('No invoices to export');
      return;
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    filteredInvoices.forEach((invoice, index) => {
      if (index > 0) pdf.addPage();
      renderInvoiceToPDF(pdf, {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        transaction_date: invoice.transaction_date,
        vehicle_registration: invoice.vehicle_registration,
        driver_name: invoice.driver_name,
        garage_name: invoice.garage_name,
        garage_vat_number: invoice.garage_vat_number,
        garage_address: invoice.garage_address,
        client_name: invoice.client_name,
        client_address: invoice.client_address,
        fuel_type: invoice.fuel_type,
        liters: invoice.liters,
        price_per_liter: invoice.price_per_liter,
        total_amount: invoice.total_amount,
        odometer_reading: invoice.odometer_reading,
        oil_quantity: invoice.oil_quantity,
        oil_type: invoice.oil_type,
        oil_brand: invoice.oil_brand,
        oil_unit_price: invoice.oil_unit_price,
        oil_total_amount: invoice.oil_total_amount,
      }, 15, { compact: true });
    });

    const dateRange = startDate && endDate
      ? `${new Date(startDate).toISOString().split("T")[0]}_to_${new Date(endDate).toISOString().split("T")[0]}`
      : new Date().toISOString().split("T")[0];

    const pdfBlob = pdf.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fuel-invoices-${dateRange}.pdf`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading fuel invoices...</p>
        </div>
      </div>
    );
  }

  if (selectedInvoice) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to List
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportSingleInvoiceToCSV(selectedInvoice)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={(e) => exportInvoiceToPDF(selectedInvoice, e)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={(e) => printInvoice(selectedInvoice, e)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>

          <div className="border-b-2 border-gray-900 pb-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 text-center">MyFuelApp</h1>
            <p className="text-center text-gray-500 mt-1 text-sm">Operated by Fuel Empowerment Systems (Pty) Ltd</p>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">FUEL INVOICE FROM</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <div className="font-bold text-base text-gray-900">{selectedInvoice.garage_name}</div>
              {selectedInvoice.garage_address && selectedInvoice.garage_address.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} className="text-gray-700 text-sm">{line}</div>
              ))}
              {selectedInvoice.garage_vat_number && (
                <div className="text-gray-600 text-sm">VAT No: {selectedInvoice.garage_vat_number}</div>
              )}
            </div>
          </div>

          {selectedInvoice.client_name && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">CLIENT</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <div className="font-bold text-base text-gray-900">{selectedInvoice.client_name}</div>
                {selectedInvoice.client_address && selectedInvoice.client_address.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} className="text-gray-700 text-sm">{line}</div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">VEHICLE & DRIVER</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center text-base">
                <div>
                  <span className="text-gray-600">Vehicle:</span>
                  <span className="font-bold ml-1">{selectedInvoice.vehicle_registration}</span>
                </div>
                <div>
                  <span className="text-gray-600">Driver:</span>
                  <span className="font-bold ml-1">{selectedInvoice.driver_name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Odometer:</span>
                  <span className="font-bold ml-1">{selectedInvoice.odometer_reading.toLocaleString()} km</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">INVOICE</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center text-base">
                <div>
                  <span className="text-gray-600">Number:</span>
                  <span className="font-bold ml-1">{selectedInvoice.invoice_number}</span>
                </div>
                <div>
                  <span className="text-gray-600">Date:</span>
                  <span className="font-bold ml-1">{new Date(selectedInvoice.invoice_date).toLocaleDateString('en-ZA')}</span>
                </div>
                <div>
                  <span className="text-gray-600">Transaction Date & Time:</span>
                  <span className="font-bold ml-1">
                    {new Date(selectedInvoice.transaction_date).toLocaleDateString('en-ZA')} {new Date(selectedInvoice.transaction_date).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">FUEL DETAILS</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-4 gap-3 mb-2 text-sm font-medium text-gray-600">
                <div>Fuel Type</div>
                <div className="text-right">Liters</div>
                <div className="text-right">Price per Liter</div>
                <div className="text-right">Fuel Amount</div>
              </div>
              <div className="grid grid-cols-4 gap-3 text-base font-bold">
                <div>{selectedInvoice.fuel_type}</div>
                <div className="text-right">{parseFloat(selectedInvoice.liters.toString()).toFixed(2)}</div>
                <div className="text-right">R {parseFloat(selectedInvoice.price_per_liter.toString()).toFixed(2)}</div>
                <div className="text-right">R {(parseFloat(selectedInvoice.liters.toString()) * parseFloat(selectedInvoice.price_per_liter.toString())).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {selectedInvoice.oil_quantity && parseFloat(selectedInvoice.oil_quantity.toString()) > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">OIL PURCHASE</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <div className="grid grid-cols-4 gap-3 mb-2 text-sm font-medium text-gray-600">
                    <div>Oil Type</div>
                    <div className="text-right">Quantity</div>
                    <div className="text-right">Unit Price (Incl VAT)</div>
                    <div className="text-right">Oil Amount (Incl VAT)</div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-base font-bold">
                    <div>{selectedInvoice.oil_type || 'N/A'}{selectedInvoice.oil_brand ? ` (${selectedInvoice.oil_brand})` : ''}</div>
                    <div className="text-right">{parseFloat(selectedInvoice.oil_quantity.toString()).toFixed(0)} Unit{parseFloat(selectedInvoice.oil_quantity.toString()) > 1 ? 's' : ''}</div>
                    <div className="text-right">R {parseFloat(selectedInvoice.oil_unit_price?.toString() || '0').toFixed(2)}</div>
                    <div className="text-right">R {parseFloat(selectedInvoice.oil_total_amount?.toString() || '0').toFixed(2)}</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-300">
                  <div className="flex justify-between text-base">
                    <span className="text-gray-600">Amount of VAT included:</span>
                    <span className="font-bold">R {((parseFloat(selectedInvoice.oil_total_amount?.toString() || '0') - (parseFloat(selectedInvoice.oil_total_amount?.toString() || '0') / 1.15))).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t-2 border-gray-200 pt-6">
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex justify-between items-center">
                <span className="text-xl font-semibold text-gray-900">TOTAL AMOUNT:</span>
                <span className="text-3xl font-bold text-blue-600">
                  R {parseFloat(selectedInvoice.total_amount.toString()).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 text-base text-gray-600 text-center">
            <p>This invoice is for accounting and tax compliance purposes.</p>
            <p className="mt-2">Thank you for your business.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Fuel className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Fuel Invoices</h2>
          </div>
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

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Invoices</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{filteredInvoices.length}</p>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Fuel className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Total Liters</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{getTotalLiters().toFixed(2)} L</p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Total Amount</span>
            </div>
            <p className="text-2xl font-bold text-orange-900">R {getTotalAmount().toFixed(2)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <span className="text-gray-600">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={(e) => printAllInvoices(e)}
            disabled={filteredInvoices.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            Print All
          </button>

          <button
            onClick={exportAllInvoicesToPDF}
            disabled={filteredInvoices.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            Export All to PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Garage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuel</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Liters</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No fuel invoices found
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">{invoice.invoice_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(invoice.transaction_date).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{invoice.vehicle_registration}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{invoice.driver_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{invoice.garage_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{invoice.fuel_type}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {parseFloat(invoice.liters.toString()).toFixed(2)} L
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      R {parseFloat(invoice.total_amount.toString()).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => printInvoice(invoice, e)}
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          title="Print Invoice"
                        >
                          <Printer className="w-4 h-4" />
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
