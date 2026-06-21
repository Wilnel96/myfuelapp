import type { jsPDF as JsPDFType } from 'jspdf';

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  transaction_date: string;
  vehicle_registration: string;
  driver_name?: string;
  garage_name: string;
  garage_vat_number?: string;
  garage_address: string;
  client_name?: string;
  client_address?: string;
  fuel_type: string;
  liters: number | string;
  price_per_liter: number | string;
  total_amount: number | string;
  odometer_reading?: number;
  oil_quantity?: number | string;
  oil_type?: string;
  oil_brand?: string;
  oil_unit_price?: number | string;
  oil_total_amount?: number | string;
}

export function renderInvoiceToPDF(
  pdf: JsPDFType,
  invoice: InvoiceData,
  startY: number,
  opts: { fontSize?: number; compact?: boolean } = {}
): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const fs = opts.fontSize ?? 9;
  const compact = opts.compact ?? false;
  const gap = compact ? 3 : 4;
  let y = startY;

  // ── Header ──────────────────────────────────────────────────────────────────
  pdf.setFontSize(compact ? 18 : 24);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text('MyFuelApp', pageWidth / 2, y, { align: 'center' });

  y += compact ? 5 : 7;
  pdf.setFontSize(compact ? 8 : 11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(107, 114, 128);
  pdf.text('Operated by Fuel Empowerment Systems (Pty) Ltd', pageWidth / 2, y, { align: 'center' });

  y += compact ? 4 : 6;
  pdf.setDrawColor(17, 24, 39);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);

  y += compact ? 5 : 8;

  // ── FUEL INVOICE FROM ───────────────────────────────────────────────────────
  pdf.setFontSize(compact ? 7 : 9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(107, 114, 128);
  pdf.text('FUEL INVOICE FROM', margin, y);

  y += gap - 1;
  const addressLines = invoice.garage_address ? invoice.garage_address.split('\n').filter(Boolean) : [];
  const fromBoxHeight = (compact ? 5 : 6) + addressLines.length * (compact ? 4 : 5) + (invoice.garage_vat_number ? (compact ? 4 : 5) : 0) + 3;
  pdf.setFillColor(249, 250, 251);
  pdf.rect(margin, y, contentWidth, fromBoxHeight, 'F');

  y += compact ? 4 : 5;
  pdf.setFontSize(compact ? 8 : 10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text(invoice.garage_name, margin + 3, y);

  for (const line of addressLines) {
    y += compact ? 4 : 5;
    pdf.setFontSize(compact ? 7 : 9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text(line, margin + 3, y);
  }

  if (invoice.garage_vat_number) {
    y += compact ? 4 : 5;
    pdf.setFontSize(compact ? 7 : 9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text(`VAT No: ${invoice.garage_vat_number}`, margin + 3, y);
  }

  y += compact ? 6 : 8;

  // ── CLIENT ──────────────────────────────────────────────────────────────────
  if (invoice.client_name) {
    pdf.setFontSize(compact ? 7 : 9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(107, 114, 128);
    pdf.text('CLIENT', margin, y);

    y += gap - 1;
    const clientLines = invoice.client_address ? invoice.client_address.split('\n').filter(Boolean) : [];
    const clientBoxHeight = (compact ? 5 : 6) + clientLines.length * (compact ? 4 : 5) + 3;
    pdf.setFillColor(249, 250, 251);
    pdf.rect(margin, y, contentWidth, clientBoxHeight, 'F');

    y += compact ? 4 : 5;
    pdf.setFontSize(compact ? 8 : 10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text(invoice.client_name, margin + 3, y);

    for (const line of clientLines) {
      y += compact ? 4 : 5;
      pdf.setFontSize(compact ? 7 : 9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(75, 85, 99);
      pdf.text(line, margin + 3, y);
    }

    y += compact ? 6 : 8;
  }

  // ── VEHICLE & DRIVER ────────────────────────────────────────────────────────
  pdf.setFontSize(compact ? 7 : 9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(107, 114, 128);
  pdf.text('VEHICLE & DRIVER', margin, y);

  y += gap - 1;
  pdf.setFillColor(249, 250, 251);
  pdf.rect(margin, y, contentWidth, compact ? 11 : 13, 'F');

  y += compact ? 4 : 5;
  pdf.setFontSize(fs);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  pdf.text('Vehicle:', margin + 3, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text(` ${invoice.vehicle_registration}`, margin + 3 + pdf.getTextWidth('Vehicle:'), y);

  if (invoice.driver_name) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    const dLabel = 'Driver:';
    const dX = margin + contentWidth / 2 - pdf.getTextWidth(dLabel) / 2;
    pdf.text(dLabel, dX, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text(` ${invoice.driver_name}`, dX + pdf.getTextWidth(dLabel), y);
  }

  if (invoice.odometer_reading != null) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    const odoLabel = 'Odometer:';
    const odoVal = ` ${invoice.odometer_reading.toLocaleString()} km`;
    const odoW = pdf.getTextWidth(odoLabel) + pdf.getTextWidth(odoVal);
    pdf.text(odoLabel, margin + contentWidth - 3 - odoW, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text(odoVal, margin + contentWidth - 3 - pdf.getTextWidth(odoVal), y);
  }

  y += compact ? 11 : 13;

  // ── INVOICE ─────────────────────────────────────────────────────────────────
  pdf.setFontSize(compact ? 7 : 9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(107, 114, 128);
  pdf.text('INVOICE', margin, y);

  y += gap - 1;
  pdf.setFillColor(249, 250, 251);
  pdf.rect(margin, y, contentWidth, compact ? 11 : 13, 'F');

  y += compact ? 4 : 5;
  pdf.setFontSize(fs);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  pdf.text('Number:', margin + 3, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text(` ${invoice.invoice_number}`, margin + 3 + pdf.getTextWidth('Number:'), y);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  const dLabel = 'Date:';
  const dX = margin + contentWidth / 2 - pdf.getTextWidth(dLabel) / 2;
  pdf.text(dLabel, dX, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text(` ${new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}`, dX + pdf.getTextWidth(dLabel), y);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  const tLabel = 'Transaction Date & Time:';
  const tDate = new Date(invoice.transaction_date).toLocaleDateString('en-ZA');
  const tTime = new Date(invoice.transaction_date).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  const tVal = ` ${tDate} ${tTime}`;
  const tW = pdf.getTextWidth(tLabel) + pdf.getTextWidth(tVal);
  pdf.text(tLabel, margin + contentWidth - 3 - tW, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text(tVal, margin + contentWidth - 3 - pdf.getTextWidth(tVal), y);

  y += compact ? 11 : 13;

  // ── FUEL DETAILS ─────────────────────────────────────────────────────────────
  pdf.setFontSize(compact ? 7 : 9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(107, 114, 128);
  pdf.text('FUEL DETAILS', margin, y);

  y += gap - 1;
  pdf.setFillColor(249, 250, 251);
  pdf.rect(margin, y, contentWidth, compact ? 13 : 16, 'F');

  y += compact ? 4 : 5;
  pdf.setFontSize(compact ? 7 : fs);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  pdf.text('Fuel Type', margin + 3, y);
  pdf.text('Liters', margin + contentWidth * 0.35, y, { align: 'right' });
  pdf.text('Price per Liter', margin + contentWidth * 0.6, y, { align: 'right' });
  pdf.text('Fuel Amount', margin + contentWidth - 3, y, { align: 'right' });

  y += compact ? 4 : 5;
  pdf.setFontSize(compact ? 8 : 10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text(invoice.fuel_type, margin + 3, y);
  pdf.text(parseFloat(invoice.liters.toString()).toFixed(2), margin + contentWidth * 0.35, y, { align: 'right' });
  pdf.text(`R ${parseFloat(invoice.price_per_liter.toString()).toFixed(2)}`, margin + contentWidth * 0.6, y, { align: 'right' });
  const fuelAmt = parseFloat(invoice.liters.toString()) * parseFloat(invoice.price_per_liter.toString());
  pdf.text(`R ${fuelAmt.toFixed(2)}`, margin + contentWidth - 3, y, { align: 'right' });

  y += compact ? 9 : 11;

  // ── OIL PURCHASE ─────────────────────────────────────────────────────────────
  const hasOil = invoice.oil_quantity && parseFloat(invoice.oil_quantity.toString()) > 0;
  if (hasOil) {
    pdf.setFontSize(compact ? 7 : 9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(107, 114, 128);
    pdf.text('OIL PURCHASE', margin, y);

    y += gap - 1;
    pdf.setFillColor(249, 250, 251);
    pdf.rect(margin, y, contentWidth, compact ? 13 : 16, 'F');

    y += compact ? 4 : 5;
    pdf.setFontSize(compact ? 7 : fs);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Oil Type', margin + 3, y);
    pdf.text('Quantity', margin + contentWidth * 0.35, y, { align: 'right' });
    pdf.text('Unit Price (Incl VAT)', margin + contentWidth * 0.6, y, { align: 'right' });
    pdf.text('Oil Amount (Incl VAT)', margin + contentWidth - 3, y, { align: 'right' });

    y += compact ? 4 : 5;
    pdf.setFontSize(compact ? 8 : 10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    const oilTypeText = `${invoice.oil_type || 'N/A'}${invoice.oil_brand ? ` (${invoice.oil_brand})` : ''}`;
    pdf.text(oilTypeText, margin + 3, y);
    const oilQty = parseFloat(invoice.oil_quantity!.toString());
    pdf.text(`${oilQty.toFixed(0)} Unit${oilQty > 1 ? 's' : ''}`, margin + contentWidth * 0.35, y, { align: 'right' });
    pdf.text(`R ${parseFloat(invoice.oil_unit_price?.toString() || '0').toFixed(2)}`, margin + contentWidth * 0.6, y, { align: 'right' });
    pdf.text(`R ${parseFloat(invoice.oil_total_amount?.toString() || '0').toFixed(2)}`, margin + contentWidth - 3, y, { align: 'right' });

    y += compact ? 6 : 7;
    pdf.setDrawColor(209, 213, 219);
    pdf.setLineWidth(0.3);
    pdf.line(margin + 3, y, margin + contentWidth - 3, y);

    y += compact ? 4 : 5;
    pdf.setFontSize(compact ? 7 : fs);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Amount of VAT included:', margin + 3, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    const oilTotal = parseFloat(invoice.oil_total_amount?.toString() || '0');
    const oilVAT = oilTotal - oilTotal / 1.15;
    pdf.text(`R ${oilVAT.toFixed(2)}`, margin + contentWidth - 3, y, { align: 'right' });

    y += compact ? 8 : 10;
  }

  // ── TOTAL ────────────────────────────────────────────────────────────────────
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);

  y += compact ? 6 : 8;
  pdf.setFillColor(239, 246, 255);
  pdf.rect(margin, y, contentWidth, compact ? 16 : 20, 'F');

  y += compact ? 10 : 13;
  pdf.setFontSize(compact ? 10 : 12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text('TOTAL AMOUNT:', margin + 5, y);

  pdf.setFontSize(compact ? 12 : 16);
  pdf.setTextColor(37, 99, 235);
  pdf.text(`R ${parseFloat(invoice.total_amount.toString()).toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });

  y += compact ? 14 : 18;
  pdf.setFontSize(compact ? 7 : 9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  pdf.text('This invoice is for accounting and tax compliance purposes.', pageWidth / 2, y, { align: 'center' });
  y += compact ? 4 : 5;
  pdf.text('Thank you for your business.', pageWidth / 2, y, { align: 'center' });
}

export async function generateFuelInvoicePDF(invoice: InvoiceData): Promise<Blob> {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderInvoiceToPDF(pdf, invoice, 15);
  return pdf.output('blob');
}

export function downloadPDFBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
