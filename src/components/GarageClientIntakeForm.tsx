import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

export type IntakeFormType = 'organisation' | 'individual' | 'individual-card';

interface GarageClientIntakeFormProps {
  garageName?: string;
  formType?: IntakeFormType;
  onClose: () => void;
}

// ── Print styles ──────────────────────────────────────────────────────────────

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
    margin: 10mm 12mm 10mm 12mm;
  }
  html { margin: 0; }
}
#intake-print-root { display: none; }
@media print { #intake-print-root { display: block; } }
`;

// ── Main component ────────────────────────────────────────────────────────────

export default function GarageClientIntakeForm({ garageName, formType = 'organisation', onClose }: GarageClientIntakeFormProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);

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

  const Form = formType === 'individual' ? IndividualPrintableForm : formType === 'individual-card' ? IndividualCardPrintableForm : OrgPrintableForm;

  const printPortal = portalRoot
    ? createPortal(<Form garageName={garageName} />, portalRoot)
    : null;

  const title = formType === 'individual' ? 'Individual Local Account Setup Form' : formType === 'individual-card' ? 'Individual Card Payment Setup Form' : 'Organisation Client Setup Form';

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
        <div className="w-full max-w-4xl">
          <div className="bg-white rounded-xl shadow-xl mb-4 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
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

          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            <Form garageName={garageName} />
          </div>
        </div>
      </div>

      {printPortal}
    </>
  );
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '7pt',
  fontWeight: 'bold',
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  marginBottom: '2px',
};

function MiniHeader({ garageName, subtitle, today }: { garageName?: string; subtitle: string; today: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '5px', borderBottom: '2px solid #0d9488', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src="/MyFuelApp_logo.png" alt="MyFuelApp" style={{ height: '26px', width: 'auto' }} />
        <div style={{ fontSize: '10.5pt', fontWeight: 'bold', color: '#0d9488' }}>LOCAL ACCOUNT CLIENT INTAKE FORM</div>
      </div>
      <div style={{ textAlign: 'right', fontSize: '7.5px', color: '#9ca3af' }}>
        {garageName && <div style={{ color: '#0d9488', fontWeight: 'bold', fontSize: '8.5px' }}>{garageName}</div>}
        <div>{subtitle}</div>
        <div>{today}</div>
      </div>
    </div>
  );
}

function Section({ number, title, subtitle, children }: {
  number: string; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0d9488', color: 'white', padding: '3px 8px', borderRadius: '3px 3px 0 0', marginBottom: '5px' }}>
        <div style={{ background: 'white', color: '#0d9488', borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '8px', flexShrink: 0 }}>
          {number}
        </div>
        <div>
          <div style={{ fontSize: '9.5pt', fontWeight: 'bold' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '7pt', opacity: 0.85 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: '0 2px' }}>{children}</div>
    </div>
  );
}

function Grid({ cols, children, style }: { cols: 1 | 2 | 3 | 4; children: React.ReactNode; style?: React.CSSProperties }) {
  const templates = { 1: '1fr', 2: '1fr 1fr', 3: '1fr 1fr 1fr', 4: '1fr 1fr 1fr 1fr' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: templates[cols], gap: '4px 10px', ...style }}>
      {children}
    </div>
  );
}

function F({ label, required, wide, hint }: { label: string; required?: boolean; wide?: boolean; hint?: string }) {
  return (
    <div style={{ gridColumn: wide ? 'span 2' : undefined, display: 'flex', flexDirection: 'column', gap: '1px' }}>
      <div style={labelStyle}>
        {label}
        {required && <span style={{ color: '#dc2626' }}> *</span>}
        {hint && <span style={{ fontWeight: 'normal', textTransform: 'none', color: '#6b7280', letterSpacing: 0 }}> ({hint})</span>}
      </div>
      <div style={{ borderBottom: '1px solid #9ca3af', height: '12px' }} />
    </div>
  );
}

function CB({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '7.5pt', color: '#374151', flexShrink: 0 }}>
      <div style={{ width: '8px', height: '8px', border: '1px solid #6b7280', borderRadius: '1px', flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>{children}</div>;
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
      <div style={{ height: '1px', flex: 1, background: '#d1d5db' }} />
      <span style={{ fontSize: '7pt', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ height: '1px', flex: 1, background: '#d1d5db' }} />
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '3px', padding: '3px 7px', fontSize: '7.5pt', color: '#1e40af', marginTop: '4px' }}>
      {children}
    </div>
  );
}

function TemplateNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px dashed #f59e0b', borderRadius: '3px', padding: '3px 8px', fontSize: '7.5pt', color: '#92400e', marginBottom: '5px', textAlign: 'center' }}>
      {children}
    </div>
  );
}

function VehicleBlock({ index }: { index: number }) {
  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '3px', padding: '5px 7px', marginBottom: '6px', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: '7.5pt', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px', borderBottom: '1px solid #ccfbf1', paddingBottom: '2px' }}>
        Vehicle {index}
      </div>
      <Grid cols={4}>
        <F label="Registration Number" required />
        <F label="Make" required hint="e.g. Toyota" />
        <F label="Model" required hint="e.g. Hilux" />
        <F label="Year" hint="e.g. 2022" />
        <F label="VIN Number" />
        <F label="Fleet / Vehicle No." />
        <F label="Tank Capacity (L)" />
        <F label="License Disk Expiry" hint="DD/MM/YYYY" />
      </Grid>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr 1fr', gap: '4px 10px', marginTop: '4px' }}>
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
          <Row><CB label="Yes" /><CB label="No" /></Row>
          <div style={{ marginTop: '4px' }}>
            <F label="Odometer (km)" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DriverBlock({ index }: { index: number }) {
  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '3px', padding: '3px 6px', marginBottom: '3px', pageBreakInside: 'avoid' }}>
      <div style={{ fontSize: '7.5pt', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px', borderBottom: '1px solid #ccfbf1', paddingBottom: '1px' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr', gap: '2px 10px', marginTop: '2px' }}>
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
            <CB label="Glasses/Contacts" />
            <CB label="Automatic only" />
            <CB label="Other" />
          </Row>
        </div>
        <div>
          <div style={labelStyle}>PrDP Permit?</div>
          <Row><CB label="Yes" /><CB label="No" /></Row>
          <div style={{ marginTop: '2px' }}>
            <div style={labelStyle}>PrDP Type</div>
            <Row>
              <CB label="Passengers" />
              <CB label="Dangerous Goods" />
              <CB label="Abnormal" />
            </Row>
          </div>
        </div>
        <div>
          <Grid cols={1}>
            <F label="PrDP Expiry" hint="DD/MM/YYYY" />
            <F label="Medical Cert on File?" />
          </Grid>
        </div>
      </div>
    </div>
  );
}

function SigBlock({ label, short }: { label: string; short?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ borderBottom: '1px solid #374151', height: short ? '13px' : '24px' }} />
      <div style={{ fontSize: '7pt', color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function Footer({ today, page, pages }: { today: string; page: number; pages: number }) {
  return (
    <div style={{ marginTop: '6px', borderTop: '0.5px solid #e5e7eb', paddingTop: '3px', display: 'flex', justifyContent: 'space-between', fontSize: '6.5pt', color: '#9ca3af' }}>
      <span>MyFuelApp — Local Account Client Setup Form</span>
      <span>Page {page} of {pages} — Confidential</span>
      <span>{today}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ORGANISATION FORM (3 pages)
// ══════════════════════════════════════════════════════════════════════════════

function OrgPrintableForm({ garageName }: { garageName?: string }) {
  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
  const pageStyle: React.CSSProperties = {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '8.5pt',
    color: '#111',
    lineHeight: '1.3',
    width: '100%',
  };

  return (
    <div style={pageStyle}>

      {/* PAGE 1 — Org / Contact / Account / Declaration */}
      <div style={{ padding: '3mm 2mm', pageBreakAfter: 'always' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '5px', borderBottom: '2.5px solid #0d9488', marginBottom: '7px' }}>
          <img src="/MyFuelApp_logo.png" alt="MyFuelApp" style={{ height: '36px', width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13pt', fontWeight: 'bold', color: '#0d9488', letterSpacing: '0.2px' }}>
              LOCAL ACCOUNT — ORGANISATION SETUP FORM
            </div>
            <div style={{ fontSize: '8px', color: '#555', marginTop: '1px' }}>
              Garage-Managed Client Setup — Complete all required fields in block letters
            </div>
            {garageName && (
              <div style={{ fontSize: '8.5px', color: '#0d9488', fontWeight: 'bold', marginTop: '2px' }}>{garageName}</div>
            )}
            <div style={{ fontSize: '7.5px', color: '#9ca3af', marginTop: '1px' }}>Date: {today}</div>
          </div>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '3px', padding: '3px 8px', marginBottom: '7px', fontSize: '8pt', color: '#166534' }}>
          <strong>Instructions:</strong> Complete all fields marked <span style={{ color: '#dc2626' }}>*</span>. Use block letters. Return this form to the garage to have your account set up.
        </div>

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
          <Grid cols={4}>
            <F label="Address Line 1" required wide />
            <F label="City / Town" required />
            <F label="Postal Code" />
          </Grid>
          <Grid cols={4} style={{ marginTop: '4px' }}>
            <F label="Address Line 2" wide />
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={labelStyle}>Province <span style={{ color: '#dc2626' }}>*</span></div>
              <Row>
                {['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','N. Cape','North West','Western Cape'].map(p => (
                  <CB key={p} label={p} />
                ))}
              </Row>
            </div>
          </Grid>
        </Section>

        <Section number="2" title="Main Contact Person" subtitle="Will receive the Client Portal login credentials">
          <Grid cols={3}>
            <F label="First Name" required />
            <F label="Surname" required />
            <F label="Job Title / Position" />
            <F label="Email Address" required hint="Client Portal login" />
            <F label="Mobile Number" required />
            <F label="Office / Direct Number" />
          </Grid>
          <Note>The garage will set an initial password. The client can change it after first login.</Note>
        </Section>

        <Section number="3" title="Local Account Details" subtitle="Fuel account settings at this garage">
          <Grid cols={4}>
            <F label="Account Number" required hint="Assigned by garage" />
            <F label="Monthly Spend Limit (R)" hint="Blank = no limit" />
            <F label="Deposit Amount (R)" hint="If applicable" />
            <F label="Account Notes / Instructions" />
          </Grid>
        </Section>

        <Section number="4" title="Declaration &amp; Signature">
          <div style={{ fontSize: '8pt', color: '#374151', marginBottom: '7px', lineHeight: '1.5' }}>
            I, the undersigned, confirm that the information provided on this form is accurate and complete. I authorise {garageName || 'the garage'} to open a local fuel account on behalf of the organisation named above and to process fuel transactions for the vehicles and drivers listed. I understand that vehicle and driver information can only be updated via the Client Portal and that account number changes require written authorisation from the primary contact.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
            <SigBlock label="Signature — Authorised Signatory (Client)" />
            <SigBlock label="Signature — Garage Representative" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
            <SigBlock label="Print Name" short />
            <SigBlock label="Capacity / Title" short />
            <SigBlock label="Captured By (Garage)" short />
            <SigBlock label="Date" short />
          </div>
        </Section>

        <Footer today={today} page={1} pages={3} />
      </div>

      {/* PAGE 2 — Vehicles */}
      <div style={{ pageBreakBefore: 'always', pageBreakAfter: 'always', padding: '3mm 2mm' }}>
        <MiniHeader garageName={garageName} subtitle="Vehicles — Page 2 of 3" today={today} />
        <Section number="5" title="Vehicles" subtitle="Complete one block per vehicle. Photocopy this page for additional vehicles.">
          <TemplateNote>Template — one block per vehicle. Photocopy this page if you have more than 5 vehicles.</TemplateNote>
          <VehicleBlock index={1} />
          <VehicleBlock index={2} />
          <VehicleBlock index={3} />
          <VehicleBlock index={4} />
          <VehicleBlock index={5} />
        </Section>
        <Footer today={today} page={2} pages={3} />
      </div>

      {/* PAGE 3 — Drivers */}
      <div style={{ pageBreakBefore: 'always', padding: '3mm 2mm' }}>
        <MiniHeader garageName={garageName} subtitle="Drivers — Page 3 of 3" today={today} />
        <Section number="6" title="Drivers" subtitle="Complete one block per driver. Photocopy this page for additional drivers.">
          <TemplateNote>Template — one block per driver. Photocopy this page if you have more than 4 drivers.</TemplateNote>
          <DriverBlock index={1} />
          <DriverBlock index={2} />
          <DriverBlock index={3} />
          <DriverBlock index={4} />
        </Section>
        <Footer today={today} page={3} pages={3} />
      </div>

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL FORM (1 page)
// ══════════════════════════════════════════════════════════════════════════════

function IndividualPrintableForm({ garageName }: { garageName?: string }) {
  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
  const pageStyle: React.CSSProperties = {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '8.5pt',
    color: '#111',
    lineHeight: '1.3',
    width: '100%',
  };

  return (
    <div style={pageStyle}>
      <div style={{ padding: '3mm 2mm' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '5px', borderBottom: '2.5px solid #0d9488', marginBottom: '7px' }}>
          <img src="/MyFuelApp_logo.png" alt="MyFuelApp" style={{ height: '36px', width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13pt', fontWeight: 'bold', color: '#0d9488', letterSpacing: '0.2px' }}>
              LOCAL ACCOUNT — INDIVIDUAL CLIENT SETUP FORM
            </div>
            <div style={{ fontSize: '8px', color: '#555', marginTop: '1px' }}>
              Personal Account Setup — Complete all required fields in block letters
            </div>
            {garageName && (
              <div style={{ fontSize: '8.5px', color: '#0d9488', fontWeight: 'bold', marginTop: '2px' }}>{garageName}</div>
            )}
            <div style={{ fontSize: '7.5px', color: '#9ca3af', marginTop: '1px' }}>Date: {today}</div>
          </div>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '3px', padding: '3px 8px', marginBottom: '7px', fontSize: '8pt', color: '#166534' }}>
          <strong>Instructions:</strong> Complete all fields marked <span style={{ color: '#dc2626' }}>*</span>. Use block letters. Return this form to the garage to have your personal fuel account set up.
        </div>

        {/* Section 1 — Personal Details */}
        <Section number="1" title="Personal Details" subtitle="Account holder information">
          <Grid cols={4}>
            <F label="Title" hint="Mr / Mrs / Ms / Dr" />
            <F label="First Name" required />
            <F label="Surname" required />
            <F label="SA ID Number" required hint="13-digit" />
            <F label="Date of Birth" hint="DD/MM/YYYY" />
            <F label="Mobile Number" required />
            <F label="Office / Work Number" />
            <F label="Email Address" required hint="Used as portal login" />
          </Grid>
          <Divider label="Residential Address" />
          <Grid cols={4}>
            <F label="Address Line 1" required wide />
            <F label="City / Town" required />
            <F label="Postal Code" />
          </Grid>
          <Grid cols={4} style={{ marginTop: '4px' }}>
            <F label="Address Line 2" wide />
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={labelStyle}>Province <span style={{ color: '#dc2626' }}>*</span></div>
              <Row>
                {['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','N. Cape','North West','Western Cape'].map(p => (
                  <CB key={p} label={p} />
                ))}
              </Row>
            </div>
          </Grid>
        </Section>

        {/* Section 2 — Account */}
        <Section number="2" title="Account Details" subtitle="Fuel account settings at this garage">
          <Grid cols={4}>
            <F label="Account Number" required hint="Assigned by garage" />
            <F label="Monthly Spend Limit (R)" hint="Blank = no limit" />
            <F label="Deposit Amount (R)" hint="If applicable" />
            <F label="Account Notes" />
          </Grid>
        </Section>

        {/* Section 3 — Declaration */}
        <Section number="3" title="Declaration &amp; Signature">
          <div style={{ fontSize: '8pt', color: '#374151', marginBottom: '7px', lineHeight: '1.5' }}>
            I, the undersigned, confirm that the information provided on this form is accurate and complete. I authorise {garageName || 'the garage'} to open a personal local fuel account in my name and to process fuel transactions for the vehicles listed overleaf. I understand that my account details can be managed via the Client Portal and that account changes may require written authorisation.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
            <SigBlock label="Signature — Account Holder" />
            <SigBlock label="Signature — Garage Representative" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
            <SigBlock label="Print Name" short />
            <SigBlock label="SA ID Number" short />
            <SigBlock label="Captured By (Garage)" short />
            <SigBlock label="Date" short />
          </div>
        </Section>

        <Footer today={today} page={1} pages={2} />
      </div>

      {/* PAGE 2 — Vehicles & Drivers */}
      <div style={{ padding: '3mm 2mm', pageBreakBefore: 'always' }}>

        {/* Page 2 header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '2px solid #0d9488', marginBottom: '6px' }}>
          <img src="/MyFuelApp_logo.png" alt="MyFuelApp" style={{ height: '28px', width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#0d9488' }}>LOCAL ACCOUNT — INDIVIDUAL CLIENT SETUP FORM</div>
            <div style={{ fontSize: '7.5px', color: '#555' }}>Vehicles &amp; Drivers — Page 2</div>
            {garageName && <div style={{ fontSize: '8px', color: '#0d9488', fontWeight: 'bold', marginTop: '1px' }}>{garageName}</div>}
          </div>
        </div>

        {/* Vehicles */}
        <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', borderBottom: '1.5px solid #0d9488', paddingBottom: '2px' }}>
          Vehicles
        </div>
        <VehicleBlock index={1} />
        <VehicleBlock index={2} />
        <VehicleBlock index={3} />
        <TemplateNote>Up to 3 vehicles. Photocopy this page if you have more than 3 vehicles.</TemplateNote>

        {/* Drivers */}
        <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '6px 0 4px', borderBottom: '1.5px solid #0d9488', paddingBottom: '2px' }}>
          Authorised Drivers
        </div>
        <DriverBlock index={1} />
        <DriverBlock index={2} />
        <TemplateNote>Up to 2 authorised drivers. Photocopy this page if you have more than 2 drivers.</TemplateNote>

        <Footer today={today} page={2} pages={2} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL — CARD PAYMENT FORM
// ══════════════════════════════════════════════════════════════════════════════

function IndividualCardPrintableForm({ garageName }: { garageName?: string }) {
  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
  const pageStyle: React.CSSProperties = {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '8.5pt',
    color: '#111',
    lineHeight: '1.3',
    width: '100%',
  };

  return (
    <div style={pageStyle}>
      <div style={{ padding: '3mm 2mm' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '5px', borderBottom: '2.5px solid #0d9488', marginBottom: '7px' }}>
          <img src="/MyFuelApp_logo.png" alt="MyFuelApp" style={{ height: '36px', width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13pt', fontWeight: 'bold', color: '#0d9488', letterSpacing: '0.2px' }}>
              CARD PAYMENT — INDIVIDUAL CLIENT SETUP FORM
            </div>
            <div style={{ fontSize: '8px', color: '#555', marginTop: '1px' }}>
              Personal Account Setup — Fuel paid by Credit/Debit Card via PIN + NFC
            </div>
            <div style={{ fontSize: '7.5px', color: '#9ca3af', marginTop: '1px' }}>Date: {today}</div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '3px', padding: '3px 8px', marginBottom: '7px', fontSize: '8pt', color: '#166534' }}>
          <strong>Instructions:</strong> Complete all fields marked <span style={{ color: '#dc2626' }}>*</span>. Use block letters.
        </div>

        {/* Portal note */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '3px', padding: '4px 8px', marginBottom: '8px', fontSize: '7.5pt', color: '#1e40af' }}>
          <strong>Note:</strong> You are the <strong>Main User</strong> and <strong>Billing User</strong> by default. These roles can be changed by logging in to the <strong>Client Portal</strong> and selecting <strong>Client User Management</strong>.
        </div>

        {/* Section 1 — Personal Details */}
        <Section number="1" title="Personal Details" subtitle="Account holder information">
          <Grid cols={4}>
            <F label="Title" hint="Mr / Mrs / Ms / Dr" />
            <F label="First Name" required />
            <F label="Surname" required />
            <F label="SA ID Number" required hint="13-digit" />
            <F label="Date of Birth" hint="DD/MM/YYYY" />
            <F label="Mobile Number" required />
            <F label="Office / Work Number" />
            <F label="Email Address" required hint="Portal login" />
          </Grid>
          <Divider label="Password" />
          <Grid cols={2}>
            <F label="Password" required hint="Min 6 characters — for portal sign-in" />
            <F label="Confirm Password" required />
          </Grid>
          <Divider label="Residential Address" />
          <Grid cols={4}>
            <F label="Address Line 1" required wide />
            <F label="City / Town" required />
            <F label="Postal Code" />
          </Grid>
          <Grid cols={4} style={{ marginTop: '4px' }}>
            <F label="Address Line 2" wide />
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={labelStyle}>Province <span style={{ color: '#dc2626' }}>*</span></div>
              <Row>
                {['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','N. Cape','North West','Western Cape'].map(p => (
                  <CB key={p} label={p} />
                ))}
              </Row>
            </div>
          </Grid>
        </Section>

        {/* Section 2 — Bank Account for Debit Order */}
        <Section number="2" title="Bank Account Details" subtitle="For monthly management fee debit order">
          <Note>Monthly vehicle and driver management fees are collected via debit order against this account.</Note>
          <div style={{ marginTop: '6px' }}>
            <Grid cols={4}>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={labelStyle}>Bank Name <span style={{ color: '#dc2626' }}>*</span></div>
                <Row>
                  {['Absa','African Bank','Capitec','Discovery','FNB','Investec','Nedbank','Standard Bank','Tyme Bank','Other'].map(b => (
                    <CB key={b} label={b} />
                  ))}
                </Row>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={labelStyle}>Account Type <span style={{ color: '#dc2626' }}>*</span></div>
                <Row>
                  <CB label="Current / Cheque" />
                  <CB label="Savings" />
                  <CB label="Transmission" />
                </Row>
              </div>
              <F label="Account Holder Name" required wide hint="As it appears on the account" />
              <F label="Account Number" required />
              <F label="Branch Code" required hint="e.g. 250655" />
            </Grid>
          </div>
        </Section>

        {/* Section 3 — Declaration */}
        <Section number="3" title="Declaration &amp; Signature">
          <div style={{ fontSize: '8pt', color: '#374151', marginBottom: '7px', lineHeight: '1.5' }}>
            I, the undersigned, confirm that the information provided is accurate and complete. I authorise Fuel Empowerment Systems (Pty) Ltd to raise a monthly debit order against my registered bank account for vehicle and driver management fees. I understand that my card details and account information can be managed via the Client Portal and that I am designated as the Main User and Billing User by default, which I may change via Client User Management.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
            <SigBlock label="Signature — Account Holder" />
            <SigBlock label="Date" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <SigBlock label="Print Name" short />
            <SigBlock label="SA ID Number" short />
            <SigBlock label="Date of Birth" short />
          </div>
        </Section>

        <Footer today={today} page={1} pages={2} />
      </div>

      {/* PAGE 2 — Vehicles & Drivers */}
      <div style={{ padding: '3mm 2mm', pageBreakBefore: 'always' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '2px solid #0d9488', marginBottom: '6px' }}>
          <img src="/MyFuelApp_logo.png" alt="MyFuelApp" style={{ height: '28px', width: 'auto' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#0d9488' }}>CARD PAYMENT — INDIVIDUAL CLIENT SETUP FORM</div>
            <div style={{ fontSize: '7.5px', color: '#555' }}>Vehicles &amp; Drivers — Page 2</div>
          </div>
        </div>
        <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', borderBottom: '1.5px solid #0d9488', paddingBottom: '2px' }}>
          Vehicles
        </div>
        <VehicleBlock index={1} />
        <VehicleBlock index={2} />
        <VehicleBlock index={3} />
        <TemplateNote>Up to 3 vehicles. Photocopy this page if you have more than 3 vehicles.</TemplateNote>
        <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '6px 0 4px', borderBottom: '1.5px solid #0d9488', paddingBottom: '2px' }}>
          Authorised Drivers
        </div>
        <DriverBlock index={1} />
        <DriverBlock index={2} />
        <TemplateNote>Up to 2 authorised drivers. Photocopy this page if you have more than 2 drivers.</TemplateNote>
        <Footer today={today} page={2} pages={2} />
      </div>
    </div>
  );
}
