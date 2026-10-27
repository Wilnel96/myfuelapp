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
  client_vat_number?: string;
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
  payment_option?: string;
  card_last_four_digits?: string;
  previous_fillings?: PreviousFilling[];
}

export interface PreviousFilling {
  transaction_date: string;
  liters: number | string;
  price_per_liter: number | string;
  total_amount: number | string;
  odometer_reading: number;
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

  // ── FUEL INVOICE FROM + CLIENT (side by side) ───────────────────────────────
  const colGap = 3;
  const colW = (contentWidth - colGap) / 2;
  const leftX = margin;
  const rightX = margin + colW + colGap;

  const addressLines = invoice.garage_address ? invoice.garage_address.split('\n').filter(Boolean) : [];
  const garageLineCount = 1 + addressLines.length + (invoice.garage_vat_number ? 1 : 0);
  const garageBoxHeight = (compact ? 5 : 6) + garageLineCount * (compact ? 4 : 5) + 3;

  const clientLines = invoice.client_address ? invoice.client_address.split('\n').filter(Boolean) : [];
  const hasClientVat = !!invoice.client_vat_number;
  const hasClient = !!invoice.client_name;
  const clientLineCount = hasClient ? (1 + clientLines.length + (hasClientVat ? 1 : 0)) : 0;
  const clientBoxHeight = hasClient ? ((compact ? 5 : 6) + clientLineCount * (compact ? 4 : 5) + 3) : 0;

  const bothBoxHeight = Math.max(garageBoxHeight, clientBoxHeight);

  pdf.setFontSize(compact ? 7 : 9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(107, 114, 128);
  pdf.text('FUEL INVOICE FROM', leftX, y);
  if (hasClient) {
    pdf.text('CLIENT', rightX, y);
  }

  y += gap - 1;

  // Garage box (left column)
  pdf.setFillColor(249, 250, 251);
  pdf.rect(leftX, y, colW, bothBoxHeight, 'F');

  let garageY = y + (compact ? 4 : 5);
  pdf.setFontSize(compact ? 8 : 10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text(invoice.garage_name, leftX + 3, garageY);

  for (const line of addressLines) {
    garageY += compact ? 4 : 5;
    pdf.setFontSize(compact ? 7 : 9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text(line, leftX + 3, garageY);
  }

  if (invoice.garage_vat_number) {
    garageY += compact ? 4 : 5;
    pdf.setFontSize(compact ? 7 : 9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text(`VAT No: ${invoice.garage_vat_number}`, leftX + 3, garageY);
  }

  // Client box (right column)
  if (hasClient) {
    pdf.setFillColor(249, 250, 251);
    pdf.rect(rightX, y, colW, bothBoxHeight, 'F');

    let clientY = y + (compact ? 4 : 5);
    pdf.setFontSize(compact ? 8 : 10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text(invoice.client_name!, rightX + 3, clientY);

    for (const line of clientLines) {
      clientY += compact ? 4 : 5;
      pdf.setFontSize(compact ? 7 : 9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(75, 85, 99);
      pdf.text(line, rightX + 3, clientY);
    }

    if (hasClientVat) {
      clientY += compact ? 4 : 5;
      pdf.setFontSize(compact ? 7 : 9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(75, 85, 99);
      pdf.text(`VAT No: ${invoice.client_vat_number}`, rightX + 3, clientY);
    }
  }

  y += bothBoxHeight + (compact ? 6 : 8);

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

  // ── PAYMENT STATUS ───────────────────────────────────────────────────────────
  const isCardPayment = invoice.payment_option === 'Card Payment';
  const isLocalAccount = invoice.payment_option === 'Local Account';
  if (isCardPayment || isLocalAccount) {
    const boxColor: [number, number, number] = isCardPayment ? [240, 253, 244] : [239, 246, 255];
    const borderColor: [number, number, number] = isCardPayment ? [134, 239, 172] : [147, 197, 253];
    const textColor: [number, number, number] = isCardPayment ? [22, 101, 52] : [30, 64, 175];
    const boxH = compact ? 10 : 12;
    pdf.setFillColor(...boxColor);
    pdf.setDrawColor(...borderColor);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(margin, y, contentWidth, boxH, 2, 2, 'FD');
    y += compact ? 6 : 8;
    pdf.setFontSize(compact ? 8 : 9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...textColor);
    let paymentText: string;
    if (isCardPayment) {
      paymentText = invoice.card_last_four_digits
        ? `Paid by Credit/Debit Card  •  **** **** **** ${invoice.card_last_four_digits}`
        : 'Paid by Credit/Debit Card';
    } else {
      paymentText = 'Garage Account Invoice — To be paid';
    }
    pdf.text(paymentText, pageWidth / 2, y, { align: 'center' });
    y += compact ? 6 : 8;
  }

  pdf.setFontSize(compact ? 7 : 9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  pdf.text('This invoice is for accounting and tax compliance purposes.', pageWidth / 2, y, { align: 'center' });
  y += compact ? 4 : 5;
  pdf.text('Thank you for your business.', pageWidth / 2, y, { align: 'center' });

  // ── PREVIOUS FILLINGS ───────────────────────────────────────────────────────
  if (invoice.previous_fillings && invoice.previous_fillings.length > 0) {
    y += compact ? 8 : 10;

    pdf.setFontSize(compact ? 7 : 9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(107, 114, 128);
    pdf.text('PREVIOUS FILLING', margin, y);

    y += gap - 1;

    const fillings = invoice.previous_fillings;
    const rowH = compact ? 4 : 5;
    const headerH = compact ? 5 : 6;
    const tableH = headerH + fillings.length * rowH + 2;

    pdf.setFillColor(249, 250, 251);
    pdf.rect(margin, y, contentWidth, tableH, 'F');

    // Column positions (fractions of contentWidth)
    const colDate = margin + 2;
    const colLiters = margin + contentWidth * 0.28;
    const colPrice = margin + contentWidth * 0.45;
    const colTotal = margin + contentWidth * 0.62;
    const colKm = margin + contentWidth * 0.80;
    const colKmPerL = margin + contentWidth - 2;

    // Header row
    y += headerH;
    pdf.setFontSize(compact ? 6 : 7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Date', colDate, y - 1.5);
    pdf.text('Liters', colLiters, y - 1.5);
    pdf.text('Price/L', colPrice, y - 1.5);
    pdf.text('Total', colTotal, y - 1.5);
    pdf.text('Km', colKm, y - 1.5);
    pdf.text('Km/L', colKmPerL, y - 1.5, { align: 'right' });

    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.3);
    pdf.line(margin + 2, y - 0.5, margin + contentWidth - 2, y - 0.5);

    // Data rows
    for (let i = 0; i < fillings.length; i++) {
      y += rowH;
      const f = fillings[i];
      pdf.setFontSize(compact ? 6 : 7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(55, 65, 81);

      const dateStr = new Date(f.transaction_date).toLocaleDateString('en-ZA');
      const litersVal = parseFloat(f.liters.toString());
      const priceVal = parseFloat(f.price_per_liter.toString());
      const totalVal = parseFloat(f.total_amount.toString());
      const odoVal = f.odometer_reading;

      // Km/L: difference from previous filling's odometer / liters
      let kmPerL = '';
      if (i > 0) {
        const prevOdo = fillings[i - 1].odometer_reading;
        const kmDiff = odoVal - prevOdo;
        if (kmDiff > 0 && litersVal > 0) {
          kmPerL = (kmDiff / litersVal).toFixed(2);
        }
      }

      pdf.text(dateStr, colDate, y - 1.5);
      pdf.text(litersVal.toFixed(2), colLiters, y - 1.5);
      pdf.text(`R${priceVal.toFixed(2)}`, colPrice, y - 1.5);
      pdf.text(`R${totalVal.toFixed(2)}`, colTotal, y - 1.5);
      pdf.text(odoVal.toLocaleString(), colKm, y - 1.5);
      pdf.text(kmPerL || '-', colKmPerL, y - 1.5, { align: 'right' });
    }

    y += compact ? 4 : 6;
  }
}

export async function generateFuelInvoicePDF(invoice: InvoiceData): Promise<Blob> {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderInvoiceToPDF(pdf, invoice, 15);
  return pdf.output('blob');
}

export async function fetchPreviousFillings(
  supabaseClient: any,
  vehicleRegistration: string,
  organizationId: string,
  beforeDate: string,
  limit: number = 1
): Promise<PreviousFilling[]> {
  try {
    const { data, error } = await supabaseClient
      .from('fuel_transaction_invoices')
      .select('transaction_date, liters, price_per_liter, total_amount, odometer_reading')
      .eq('organization_id', organizationId)
      .eq('vehicle_registration', vehicleRegistration)
      .lt('transaction_date', beforeDate)
      .order('transaction_date', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.reverse() as PreviousFilling[];
  } catch {
    return [];
  }
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
