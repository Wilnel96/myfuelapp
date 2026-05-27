import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

interface GarageClientIntakeFormProps {
  garageName?: string;
  onClose: () => void;
}

// ── Print styles injected into <head> ────────────────────────────────────────

const PRINT_STYLES = `
@media print {
  body > *:not(#intake-print-root) {
    display: none !important;
    visibility: hidden !important;
  }
  #intake-print-root {
    display: block !important;
    visibility: visible !important;
    position: static !important;
  }
  @page {
    size: A4 portrait;
    margin: 12mm 14mm 14mm 14mm;
  }
}
#intake-print-root {
  display: none;
}
@media print {
  #intake-print-root {
    display: block;
  }
}
`;

// ── Main component ────────────────────────────────────────────────────────────

export default function GarageClientIntakeForm({ garageName, onClose }: GarageClientIntakeFormProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);

  // Inject print styles and portal container into <body>
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);

    const div = document.createElement('div');
    div.id = 'intake-print-root';
    document.body.appendChild(div);
    setPortalRoot(div);

    return () => {
      style.remove();
      div.remove();
    };
  }, []);

  const handlePrint = () => window.print();

  // Portal content — rendered directly into body so print CSS targets it
  const printPortal = portalRoot
    ? createPortal(<PrintableForm garageName={garageName} />, portalRoot)
    : null;

  return (
    <>
      {/* Screen overlay */}
      <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
        <div className="w-full max-w-4xl">
          {/* Control bar */}
          <div className="bg-white rounded-xl shadow-xl mb-4 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Client Intake Form</h2>
              <p className="text-sm text-gray-500 mt-0.5">Print or save as PDF for new clients to complete offline.</p>
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

          {/* On-screen preview */}
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            <PrintableForm garageName={garageName} />
          </div>
        </div>
      </div>

      {/* Portal — renders into body for correct print targeting */}
      {printPortal}
    </>
  );
}

// ── Printable document ────────────────────────────────────────────────────────

function PrintableForm({ garageName }: { garageName?: string }) {
  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });

  const doc: React.CSSProperties = {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '9pt',
    color: '#111',
    lineHeight: '1.35',
    padding: '0',
  };

  return (
    <div style={doc}>

      {/* ═══════════════════════════════ PAGE 1 ══════════════════════════════ */}
      <div style={{ padding: '4mm 2mm' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '3px solid #0d9488', marginBottom: '10px' }}>
          <img src="/MyFuelApp_logo.png" alt="MyFuelApp" style={{ height: '44px', width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '15pt', fontWeight: 'bold', color: '#0d9488', letterSpacing: '0.3px' }}>
              LOCAL ACCOUNT CLIENT INTAKE FORM
            </div>
            <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
              Garage-Managed Client Registration — Complete all required fields in block letters
            </div>
            {garageName && (
              <div style={{ fontSize: '9px', color: '#0d9488', fontWeight: 'bold', marginTop: '3px' }}>
                {garageName}
              </div>
            )}
            <div style={{ fontSize: '8px', color: '#9ca3af', marginTop: '2px' }}>Date: {today}</div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '3px', padding: '5px 9px', marginBottom: '10px', fontSize: '8.5pt', color: '#166534' }}>
          <strong>Instructions:</strong> Complete all fields marked <span style={{ color: '#dc2626' }}>*</span>. Use block letters. Return this form to the garage to have your account set up. Once loaded, vehicles and drivers can only be updated via the Client Portal.
        </div>

        {/* Section 1 */}
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
            <F label="Postal Code" />
          </Grid>
          <div style={{ marginTop: '5px' }}>
            <div style={labelStyle}>Province</div>
            <Row>
              {['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','Northern Cape','North West','Western Cape'].map(p => (
                <CB key={p} label={p} />
              ))}
            </Row>
          </div>
        </Section>

        {/* Section 2 */}
        <Section number="2" title="Main Contact Person" subtitle="Will receive the Client Portal login credentials">
          <Grid cols={2}>
            <F label="First Name" required />
            <F label="Surname" required />
            <F label="Email Address" required hint="Used as Client Portal login" />
            <F label="Mobile Number" required />
            <F label="Office / Direct Number" />
            <F label="Job Title / Position" />
          </Grid>
          <Note>The garage will set an initial password. The client can change it after first login.</Note>
        </Section>

        {/* Section 3 */}
        <Section number="3" title="Local Account Details" subtitle="Fuel account settings at this garage">
          <Grid cols={3}>
            <F label="Account Number" required hint="Assigned by garage" />
            <F label="Monthly Spend Limit (R)" hint="Leave blank for no limit" />
            <F label="Deposit Amount (R)" hint="If applicable" />
          </Grid>
          <Grid cols={1} style={{ marginTop: '5px' }}>
            <F label="Account Notes / Special Instructions" />
          </Grid>
        </Section>

        {/* Section 6 — Declaration (end of page 1) */}
        <Section number="6" title="Declaration &amp; Signature">
          <div style={{ fontSize: '8.5pt', color: '#374151', marginBottom: '10px', lineHeight: '1.55' }}>
            I, the undersigned, confirm that the information provided on this form is accurate and complete. I authorise {garageName || 'the garage'} to open a local fuel account on behalf of the organisation named above and to process fuel transactions for the vehicles and drivers listed. I understand that vehicle and driver information can only be updated via the Client Portal and that account number changes require written authorisation from the primary contact.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <SigBlock label="Signature — Authorised Signatory (Client)" />
            <SigBlock label="Signature — Garage Representative" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginTop: '10px' }}>
            <SigBlock label="Print Name" short />
            <SigBlock label="Capacity / Title" short />
            <SigBlock label="Captured By" short />
            <SigBlock label="Date" short />
          </div>
        </Section>

        <Footer today={today} page={1} />
      </div>

      {/* ═══════════════════════════════ PAGE 2 ══════════════════════════════ */}
      <div style={{ pageBreakBefore: 'always', padding: '4mm 2mm' }}>

        {/* Page 2 header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '2px solid #0d9488', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/MyFuelApp_logo.png" alt="MyFuelApp" style={{ height: '28px', width: 'auto' }} />
            <div style={{ fontSize: '11pt', fontWeight: 'bold', color: '#0d9488' }}>LOCAL ACCOUNT CLIENT INTAKE FORM</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '8px', color: '#9ca3af' }}>
            {garageName && <div style={{ color: '#0d9488', fontWeight: 'bold', fontSize: '9px' }}>{garageName}</div>}
            Vehicles &amp; Drivers — Page 2
          </div>
        </div>

        {/* Section 4 — Vehicles */}
        <Section number="4" title="Vehicles" subtitle="Complete one block per vehicle. Photocopy this page for additional vehicles.">
          <TemplateNote>Template — one block per vehicle. Attach photocopied pages for additional vehicles.</TemplateNote>
          <VehicleBlock index={1} />
          <VehicleBlock index={2} />
          <VehicleBlock index={3} />
        </Section>

        {/* Section 5 — Drivers */}
        <Section number="5" title="Drivers" subtitle="Complete one block per driver. Photocopy this page for additional drivers.">
          <TemplateNote>Template — one block per driver. Attach photocopied pages for additional drivers.</TemplateNote>
          <DriverBlock index={1} />
          <DriverBlock index={2} />
        </Section>

        <Footer today={today} page={2} />
      </div>

    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '7.5pt',
  fontWeight: 'bold',
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  marginBottom: '2px',
};

function Section({ number, title, subtitle, children }: {
  number: string; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#0d9488', color: 'white', padding: '4px 9px', borderRadius: '3px 3px 0 0', marginBottom: '7px' }}>
        <div style={{ background: 'white', color: '#0d9488', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px', flexShrink: 0 }}>
          {number}
        </div>
        <div>
          <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '7.5pt', opacity: 0.85 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: '0 3px' }}>{children}</div>
    </div>
  );
}

function Grid({ cols, children, style }: { cols: 1 | 2 | 3 | 4; children: React.ReactNode; style?: React.CSSProperties }) {
  const templates = { 1: '1fr', 2: '1fr 1fr', 3: '1fr 1fr 1fr', 4: '1fr 1fr 1fr 1fr' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: templates[cols], gap: '5px 13px', ...style }}>
      {children}
    </div>
  );
}

function F({ label, required, wide, hint }: { label: string; required?: boolean; wide?: boolean; hint?: string }) {
  return (
    <div style={{ gridColumn: wide ? 'span 2' : undefined, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={labelStyle}>
        {label}
        {required && <span style={{ color: '#dc2626' }}> *</span>}
        {hint && <span style={{ fontWeight: 'normal', textTransform: 'none', color: '#6b7280', letterSpacing: 0 }}> ({hint})</span>}
      </div>
      <div style={{ borderBottom: '1px solid #9ca3af', height: '13px' }} />
    </div>
  );
}

function CB({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8pt', color: '#374151', flexShrink: 0 }}>
      <div style={{ width: '9px', height: '9px', border: '1px solid #6b7280', borderRadius: '1.5px', flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>{children}</div>;
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', margin: '6px 0 5px' }}>
      <div style={{ height: '1px', flex: 1, background: '#d1d5db' }} />
      <span style={{ fontSize: '7.5pt', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ height: '1px', flex: 1, background: '#d1d5db' }} />
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '3px', padding: '4px 8px', fontSize: '8pt', color: '#1e40af', marginTop: '5px' }}>
      {children}
    </div>
  );
}

function TemplateNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px dashed #f59e0b', borderRadius: '3px', padding: '3px 8px', fontSize: '8pt', color: '#92400e', marginBottom: '7px', textAlign: 'center' }}>
      {children}
    </div>
  );
}

function VehicleBlock({ index }: { index: number }) {
  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '3px', padding: '6px 8px', marginBottom: '7px', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '5px', borderBottom: '1px solid #ccfbf1', paddingBottom: '3px' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px 13px', marginTop: '5px' }}>
        <div>
          <div style={labelStyle}>Vehicle Type <span style={{ color: '#dc2626' }}>*</span></div>
          <Row>
            <CB label="ULP (Petrol)" />
            <CB label="Diesel" />
            <CB label="Hybrid Petrol" />
            <CB label="Hybrid Diesel" />
            <CB label="Electric" />
          </Row>
        </div>
        <div>
          <div style={labelStyle}>Fuel Type</div>
          <Row>
            <CB label="ULP-93" />
            <CB label="ULP-95" />
            <CB label="Diesel 10ppm" />
            <CB label="Diesel 50ppm" />
            <CB label="Diesel 500ppm" />
          </Row>
        </div>
        <div>
          <div style={labelStyle}>License Code <span style={{ color: '#dc2626' }}>*</span></div>
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
          <div style={labelStyle}>PrDP Required?</div>
          <Row>
            <CB label="Yes" />
            <CB label="No" />
          </Row>
          <div style={{ marginTop: '6px' }} />
          <Grid cols={1}>
            <F label="Odometer Reading (km)" />
          </Grid>
        </div>
      </div>
    </div>
  );
}

function DriverBlock({ index }: { index: number }) {
  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '3px', padding: '6px 8px', marginBottom: '7px', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '5px', borderBottom: '1px solid #ccfbf1', paddingBottom: '3px' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px 13px', marginTop: '5px' }}>
        <div>
          <div style={labelStyle}>License Code</div>
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
          <div style={labelStyle}>Licence Restrictions</div>
          <Row>
            <CB label="None" />
            <CB label="Glasses / Contacts" />
            <CB label="Automatic only" />
            <CB label="Other" />
          </Row>
        </div>
        <div>
          <div style={labelStyle}>PrDP Permit?</div>
          <Row>
            <CB label="Yes" />
            <CB label="No" />
          </Row>
          <div style={{ marginTop: '3px' }}>
            <div style={labelStyle}>PrDP Type</div>
            <Row>
              <CB label="Passengers" />
              <CB label="Dangerous Goods" />
              <CB label="Abnormal Loads" />
            </Row>
          </div>
        </div>
        <div>
          <div style={labelStyle}>Medical Certificate on File?</div>
          <Row>
            <CB label="Yes" />
            <CB label="No" />
          </Row>
        </div>
      </div>
      <Grid cols={3} style={{ marginTop: '5px' }}>
        <F label="PrDP Expiry Date" hint="DD/MM/YYYY" />
        <F label="License Issue Date" hint="DD/MM/YYYY" />
        <F label="Physical Address / City / Province" />
      </Grid>
    </div>
  );
}

function SigBlock({ label, short }: { label: string; short?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ borderBottom: '1px solid #374151', height: short ? '14px' : '26px' }} />
      <div style={{ fontSize: '7.5pt', color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function Footer({ today, page }: { today: string; page: number }) {
  return (
    <div style={{ marginTop: '8px', borderTop: '0.5px solid #e5e7eb', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '7pt', color: '#9ca3af' }}>
      <span>MyFuelApp — Local Account Client Intake Form</span>
      <span>Page {page} of 2 — Confidential</span>
      <span>{today}</span>
    </div>
  );
}
