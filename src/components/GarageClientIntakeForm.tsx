import { Printer, X } from 'lucide-react';

interface GarageClientIntakeFormProps {
  garageName?: string;
  onClose: () => void;
}

export default function GarageClientIntakeForm({ garageName, onClose }: GarageClientIntakeFormProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Screen-only controls */}
      <div className="no-print fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
        <div className="w-full max-w-4xl">
          {/* Control bar */}
          <div className="bg-white rounded-xl shadow-xl mb-4 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Client Intake Form</h2>
              <p className="text-sm text-gray-500 mt-0.5">Print this form for new clients to complete their details, vehicles and drivers.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>

          {/* Printable content preview */}
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            <PrintableForm garageName={garageName} />
          </div>
        </div>
      </div>

      {/* Print styles + actual printable content */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-root { display: block !important; }
          .no-print { display: none !important; }

          @page {
            size: A4 portrait;
            margin: 15mm 15mm 18mm 15mm;
          }
        }

        .print-root {
          display: none;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 9pt;
          color: #111;
          line-height: 1.4;
        }

        @media print {
          .print-root { display: block; }
        }

        /* ── Page breaks ── */
        .page-break-before { page-break-before: always; }
        .avoid-break { page-break-inside: avoid; }

        /* ── Document header ── */
        .doc-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding-bottom: 8pt;
          border-bottom: 2.5pt solid #0d9488;
          margin-bottom: 10pt;
        }
        .doc-logo { height: 44pt; width: auto; }
        .doc-title-block { text-align: right; }
        .doc-title {
          font-size: 16pt;
          font-weight: bold;
          color: #0d9488;
          letter-spacing: 0.5pt;
        }
        .doc-subtitle {
          font-size: 9pt;
          color: #555;
          margin-top: 2pt;
        }
        .doc-garage-name {
          font-size: 8pt;
          color: #0d9488;
          font-weight: bold;
          margin-top: 4pt;
        }

        /* ── Instructions banner ── */
        .instructions {
          background: #f0fdf4;
          border: 1pt solid #86efac;
          border-radius: 4pt;
          padding: 6pt 8pt;
          margin-bottom: 10pt;
          font-size: 8pt;
          color: #166534;
        }
        .instructions strong { font-weight: bold; }

        /* ── Section ── */
        .section {
          margin-bottom: 10pt;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 6pt;
          background: #0d9488;
          color: white;
          padding: 4pt 8pt;
          border-radius: 3pt 3pt 0 0;
          margin-bottom: 6pt;
        }
        .section-number {
          background: white;
          color: #0d9488;
          border-radius: 50%;
          width: 14pt;
          height: 14pt;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 8pt;
          flex-shrink: 0;
        }
        .section-title {
          font-size: 10pt;
          font-weight: bold;
        }
        .section-subtitle {
          font-size: 7.5pt;
          opacity: 0.85;
          margin-top: 1pt;
        }

        /* ── Field grid ── */
        .field-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6pt 12pt;
          padding: 0 2pt;
        }
        .field-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 6pt 12pt;
          padding: 0 2pt;
        }
        .field-grid-4 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 6pt 10pt;
          padding: 0 2pt;
        }
        .col-span-2 { grid-column: span 2; }
        .col-span-3 { grid-column: span 3; }
        .col-span-4 { grid-column: span 4; }

        /* ── Individual field ── */
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 2pt;
        }
        .field-label {
          font-size: 7.5pt;
          font-weight: bold;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.3pt;
        }
        .field-hint {
          font-size: 7pt;
          color: #6b7280;
          font-weight: normal;
          text-transform: none;
          letter-spacing: 0;
        }
        .required-star { color: #dc2626; }
        .field-line {
          border-bottom: 1pt solid #9ca3af;
          height: 12pt;
        }

        /* ── Checkbox fields ── */
        .checkbox-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4pt 10pt;
          margin-top: 2pt;
        }
        .check-field {
          display: flex;
          align-items: center;
          gap: 3pt;
          font-size: 8pt;
          color: #374151;
        }
        .checkbox {
          width: 9pt;
          height: 9pt;
          border: 1pt solid #6b7280;
          border-radius: 1.5pt;
          flex-shrink: 0;
        }

        /* ── Vehicle / Driver blocks ── */
        .vehicle-block, .driver-block {
          border: 1pt solid #d1d5db;
          border-radius: 3pt;
          padding: 6pt 8pt;
          margin-bottom: 8pt;
          page-break-inside: avoid;
        }
        .block-counter {
          font-size: 8pt;
          font-weight: bold;
          color: #0d9488;
          text-transform: uppercase;
          letter-spacing: 0.5pt;
          margin-bottom: 5pt;
          border-bottom: 0.5pt solid #d1faf4;
          padding-bottom: 3pt;
        }

        /* ── Template note ── */
        .template-note {
          background: #fffbeb;
          border: 1pt dashed #f59e0b;
          border-radius: 3pt;
          padding: 5pt 8pt;
          font-size: 7.5pt;
          color: #92400e;
          margin-bottom: 8pt;
          text-align: center;
        }

        /* ── Signature block ── */
        .sig-section {
          margin-top: 12pt;
          border-top: 1pt solid #d1d5db;
          padding-top: 8pt;
        }
        .sig-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12pt;
        }
        .sig-block { display: flex; flex-direction: column; gap: 3pt; }
        .sig-line {
          border-bottom: 1pt solid #374151;
          height: 20pt;
          margin-bottom: 2pt;
        }
        .sig-label { font-size: 7.5pt; color: #6b7280; }

        /* ── Footer ── */
        .doc-footer {
          margin-top: 10pt;
          border-top: 0.5pt solid #e5e7eb;
          padding-top: 5pt;
          font-size: 7pt;
          color: #9ca3af;
          display: flex;
          justify-content: space-between;
        }
      `}</style>

      {/* Actual printable document (hidden on screen, shown when printing) */}
      <div className="print-root">
        <PrintableForm garageName={garageName} />
      </div>
    </>
  );
}

// Separate component so it can appear both in the preview and in the print-root
function PrintableForm({ garageName }: { garageName?: string }) {
  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', color: '#111', maxWidth: '794px', margin: '0 auto' }}
      className="printable-form-content">

      {/* ── Document header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '3px solid #0d9488', marginBottom: '12px' }}>
        <img src="/MyFuelApp_logo.png" alt="MyFuelApp" style={{ height: '48px', width: 'auto' }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0d9488', letterSpacing: '0.5px' }}>
            LOCAL ACCOUNT CLIENT INTAKE FORM
          </div>
          <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>
            Garage-Managed Client Registration &mdash; Complete all required fields
          </div>
          {garageName && (
            <div style={{ fontSize: '10px', color: '#0d9488', fontWeight: 'bold', marginTop: '4px' }}>
              {garageName}
            </div>
          )}
          <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '3px' }}>
            Date: {today}
          </div>
        </div>
      </div>

      {/* ── Instructions ── */}
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', padding: '7px 10px', marginBottom: '12px', fontSize: '10px', color: '#166534' }}>
        <strong>Instructions:</strong> Please complete all sections marked with <span style={{ color: '#dc2626' }}>*</span>. Use block letters. Hand this form to your garage contact to capture information into the system. Once loaded, vehicles and drivers can only be updated through the Client Portal.
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — ORGANISATION DETAILS                             */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Section number="1" title="Organisation Details" subtitle="Legal entity information">
        <Grid cols={2}>
          <F label="Organisation / Trading Name" required wide />
          <F label="Entity Type" hint="Pty Ltd / CC / Sole Prop / Trust / Other" />
          <F label="Company Registration Number" hint="e.g. 2020/123456/07" />
          <F label="VAT Registration Number" hint="e.g. 4123456789" />
          <F label="Telephone / Office Number" />
          <F label="Website" hint="Optional" />
        </Grid>

        <Divider label="Registered / Physical Address" />
        <Grid cols={2}>
          <F label="Address Line 1" required wide />
          <F label="Address Line 2" wide />
          <F label="City / Town" required />
          <F label="Province" hint="Select one below" />
        </Grid>
        <div style={{ margin: '4px 0 6px' }}>
          <Row>
            {['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'].map(p => (
              <CB key={p} label={p} />
            ))}
          </Row>
        </div>
        <Grid cols={3}>
          <F label="Postal Code" />
          <F label="Country" hint="Default: South Africa" />
          <div />
        </Grid>
      </Section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — BILLING / MAIN CONTACT                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Section number="2" title="Main Contact Person" subtitle="Primary account holder — will receive Client Portal login">
        <Grid cols={2}>
          <F label="First Name" required />
          <F label="Surname" required />
          <F label="Email Address" required hint="Used for Client Portal login" />
          <F label="Mobile Number" required />
          <F label="Office / Direct Number" />
          <F label="Job Title / Position" />
        </Grid>
        <Note>The email address and a password set by the garage will be used to access the Client Portal. The password can be changed by the client after first login.</Note>
      </Section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — LOCAL ACCOUNT DETAILS                           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Section number="3" title="Local Account Details" subtitle="Fuel account settings at this garage">
        <Grid cols={3}>
          <F label="Account Number" required hint="Assigned by garage" />
          <F label="Monthly Spend Limit (R)" hint="Leave blank for no limit" />
          <F label="Deposit Amount (R)" hint="If applicable" />
        </Grid>
        <Grid cols={2} style={{ marginTop: '4px' }}>
          <F label="Account Notes / Special Instructions" wide />
        </Grid>
      </Section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — VEHICLES (Template — duplicate as needed)        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Section number="4" title="Vehicles" subtitle="Complete one block per vehicle. Photocopy this section if more vehicles are needed.">
        <TemplateNote>Template — complete one block per vehicle and attach additional copies as required.</TemplateNote>

        <VehicleBlock index={1} />
        <VehicleBlock index={2} />
        <VehicleBlock index={3} />
      </Section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 5 — DRIVERS (Template)                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Section number="5" title="Drivers" subtitle="Complete one block per driver. Photocopy this section if more drivers are needed." pageBreak>
        <TemplateNote>Template — complete one block per driver and attach additional copies as required.</TemplateNote>

        <DriverBlock index={1} />
        <DriverBlock index={2} />
      </Section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SECTION 6 — DECLARATION & SIGNATURE                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Section number="6" title="Declaration &amp; Signature">
        <div style={{ fontSize: '10px', color: '#374151', marginBottom: '10px', lineHeight: '1.6' }}>
          I, the undersigned, confirm that the information provided on this form is accurate and complete. I authorise {garageName || 'the garage'} to set up a local fuel account on behalf of the above-mentioned organisation and to process fuel transactions against the vehicles and drivers listed. I understand that vehicle and driver information can only be updated through the Client Portal and that account number changes require written authorisation.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '8px' }}>
          <SigBlock label="Authorised Signatory — Client" />
          <SigBlock label="Captured By — Garage Representative" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '12px' }}>
          <SigBlock label="Print Name & Position" short />
          <SigBlock label="Date Submitted" short />
        </div>
      </Section>

      {/* ── Footer ── */}
      <div style={{ marginTop: '10px', borderTop: '1px solid #e5e7eb', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#9ca3af' }}>
        <span>MyFuelApp &mdash; Garage Local Account Client Intake Form</span>
        <span>Confidential &mdash; For internal use only</span>
        <span>Generated: {today}</span>
      </div>
    </div>
  );
}

// ── Inline layout helpers (used inside PrintableForm) ────────────────────────

function Section({ number, title, subtitle, children, pageBreak }: {
  number: string; title: string; subtitle?: string; children: React.ReactNode; pageBreak?: boolean;
}) {
  return (
    <div style={{ marginBottom: '12px', pageBreakBefore: pageBreak ? 'always' : undefined }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0d9488', color: 'white', padding: '5px 10px', borderRadius: '3px 3px 0 0', marginBottom: '8px' }}>
        <div style={{ background: 'white', color: '#0d9488', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px', flexShrink: 0 }}>
          {number}
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '8.5px', opacity: 0.85 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: '0 4px' }}>{children}</div>
    </div>
  );
}

function Grid({ cols, children, style }: { cols: 2 | 3 | 4; children: React.ReactNode; style?: React.CSSProperties }) {
  const colDefs = { 2: '1fr 1fr', 3: '1fr 1fr 1fr', 4: '1fr 1fr 1fr 1fr' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: colDefs[cols], gap: '6px 14px', ...style }}>
      {children}
    </div>
  );
}

function F({ label, required, wide, hint }: { label: string; required?: boolean; wide?: boolean; hint?: string }) {
  return (
    <div style={{ gridColumn: wide ? 'span 2' : undefined, display: 'flex', flexDirection: 'column', gap: '2px', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {label}
        {required && <span style={{ color: '#dc2626' }}> *</span>}
        {hint && <span style={{ fontWeight: 'normal', textTransform: 'none', color: '#6b7280', letterSpacing: 0 }}> ({hint})</span>}
      </div>
      <div style={{ borderBottom: '1px solid #9ca3af', height: '14px' }} />
    </div>
  );
}

function CB({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8.5px', color: '#374151', flexShrink: 0 }}>
      <div style={{ width: '9px', height: '9px', border: '1px solid #6b7280', borderRadius: '1.5px', flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>{children}</div>;
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 5px' }}>
      <div style={{ height: '1px', flex: 1, background: '#d1d5db' }} />
      <span style={{ fontSize: '8px', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ height: '1px', flex: 1, background: '#d1d5db' }} />
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '3px', padding: '5px 8px', fontSize: '8.5px', color: '#1e40af', marginTop: '6px' }}>
      {children}
    </div>
  );
}

function TemplateNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px dashed #f59e0b', borderRadius: '3px', padding: '4px 8px', fontSize: '8.5px', color: '#92400e', marginBottom: '8px', textAlign: 'center' }}>
      {children}
    </div>
  );
}

function VehicleBlock({ index }: { index: number }) {
  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '3px', padding: '7px 9px', marginBottom: '8px', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px', borderBottom: '1px solid #ccfbf1', paddingBottom: '3px' }}>
        Vehicle {index}
      </div>
      <Grid cols={4}>
        <F label="Registration Number" required />
        <F label="Make" required hint="e.g. Toyota" />
        <F label="Model" required hint="e.g. Hilux" />
        <F label="Year" hint="e.g. 2022" />
        <F label="VIN Number" />
        <F label="Fleet / Vehicle No." />
        <F label="Tank Capacity (L)" hint="e.g. 70" />
        <F label="License Disk Expiry" hint="DD/MM/YYYY" />
      </Grid>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', marginTop: '5px' }}>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>Vehicle Type <span style={{ color: '#dc2626' }}>*</span></div>
          <Row>
            <CB label="ULP (Petrol)" />
            <CB label="Diesel" />
            <CB label="Hybrid Petrol" />
            <CB label="Hybrid Diesel" />
            <CB label="Electric" />
          </Row>
        </div>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>Fuel Type</div>
          <Row>
            <CB label="ULP-93" />
            <CB label="ULP-95" />
            <CB label="Diesel 10ppm" />
            <CB label="Diesel 50ppm" />
            <CB label="Diesel 500ppm" />
          </Row>
        </div>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>License Code Required <span style={{ color: '#dc2626' }}>*</span></div>
          <Row>
            <CB label="Code B" />
            <CB label="Code C" />
            <CB label="Code C1" />
            <CB label="Code EC" />
            <CB label="Code EC1" />
            <CB label="Code EB" />
          </Row>
        </div>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>PrDP Required?</div>
          <Row>
            <CB label="Yes" />
            <CB label="No" />
          </Row>
        </div>
      </div>
      <Grid cols={3} style={{ marginTop: '5px' }}>
        <F label="Current Odometer Reading (km)" />
        <F label="Avg. Fuel Consumption (L/100km)" hint="e.g. 10" />
        <F label="Service Interval (km)" hint="e.g. 10 000" />
      </Grid>
    </div>
  );
}

function DriverBlock({ index }: { index: number }) {
  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '3px', padding: '7px 9px', marginBottom: '8px', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px', borderBottom: '1px solid #ccfbf1', paddingBottom: '3px' }}>
        Driver {index}
      </div>
      <Grid cols={4}>
        <F label="First Name" required />
        <F label="Surname" required />
        <F label="SA ID Number" hint="13-digit" />
        <F label="Date of Birth" hint="DD/MM/YYYY" />
        <F label="Mobile Number" />
        <F label="Email Address" />
        <F label="License Number" />
        <F label="License Expiry Date" hint="DD/MM/YYYY" />
      </Grid>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', marginTop: '5px' }}>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>License Code</div>
          <Row>
            <CB label="Code B" />
            <CB label="Code C" />
            <CB label="Code C1" />
            <CB label="Code EC" />
            <CB label="Code EC1" />
            <CB label="Code EB" />
          </Row>
        </div>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>Licence Restrictions</div>
          <Row>
            <CB label="None" />
            <CB label="Glasses / Contacts" />
            <CB label="Automatic only" />
            <CB label="Other" />
          </Row>
        </div>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>PrDP (Professional Driving Permit)?</div>
          <Row>
            <CB label="Yes" />
            <CB label="No" />
            <CB label="Passengers" />
            <CB label="Dangerous Goods" />
            <CB label="Abnormal Loads" />
          </Row>
        </div>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' }}>Medical Certificate on File?</div>
          <Row>
            <CB label="Yes" />
            <CB label="No" />
          </Row>
        </div>
      </div>
      <Grid cols={3} style={{ marginTop: '5px' }}>
        <F label="PrDP Expiry Date" hint="DD/MM/YYYY" />
        <F label="License Issue Date" hint="DD/MM/YYYY" />
        <F label="Other Restriction Details" />
      </Grid>
      <Grid cols={2} style={{ marginTop: '4px' }}>
        <F label="Physical Address" />
        <F label="City / Province / Postal Code" />
      </Grid>
    </div>
  );
}

function SigBlock({ label, short }: { label: string; short?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ borderBottom: '1px solid #374151', height: short ? '16px' : '28px' }} />
      <div style={{ fontSize: '8px', color: '#6b7280' }}>{label}</div>
    </div>
  );
}
