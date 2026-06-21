import { useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, User, Car, Users, Check,
  Plus, Trash2, AlertCircle, CheckCircle, Loader2, Info, Printer,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import GarageClientIntakeForm from './GarageClientIntakeForm';

// ── Types ────────────────────────────────────────────────────────────────────

interface OrgForm {
  name: string;
  entity_type: string;
  company_registration_number: string;
  vat_number: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  phone_number: string;
}

interface UserForm {
  name: string;
  surname: string;
  email: string;
  password: string;
  phone_mobile: string;
  phone_office: string;
}

interface VehicleForm {
  registration_number: string;
  make: string;
  model: string;
  year: string;
  vehicle_type: string;
  fuel_type: string;
  license_code_required: string;
  license_disk_expiry: string;
  vin_number: string;
  prdp_required: boolean;
  tank_capacity: string;
}

interface DriverForm {
  first_name: string;
  surname: string;
  id_number: string;
  phone_number: string;
  email: string;
  license_number: string;
  license_type: string;
  license_expiry_date: string;
  has_prdp: boolean;
  prdp_expiry_date: string;
}

interface GarageNewClientSetupProps {
  garageId: string;
  garageName: string;
  garageEmail: string;
  garagePassword: string;
  onBack: () => void;
  onComplete: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SA_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
];

const ENTITY_TYPES = [
  'Private Company (Pty) Ltd', 'Public Company (Ltd)', 'Close Corporation (CC)',
  'Sole Proprietor', 'Sole Trader', 'Partnership', 'Trust', 'Non-Profit Organisation',
  'Government Institution', 'Other',
];

const VEHICLE_TYPES = [
  { value: 'ULP', label: 'ULP (Petrol)' },
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'HYBRID-ULP', label: 'Hybrid Petrol' },
  { value: 'HYBRID-DIESEL', label: 'Hybrid Diesel' },
  { value: 'ELECTRIC', label: 'Electric' },
];

const FUEL_TYPES_BY_VEHICLE: Record<string, string[]> = {
  ULP: ['ULP-93', 'ULP-95'],
  DIESEL: ['Diesel-10', 'Diesel-50', 'Diesel-500'],
  'HYBRID-ULP': ['ULP-93', 'ULP-95'],
  'HYBRID-DIESEL': ['Diesel-10', 'Diesel-50', 'Diesel-500'],
  ELECTRIC: [],
};

const LICENSE_CODES = ['Code B', 'Code C', 'Code C1', 'Code EC', 'Code EC1', 'Code EB'];

const EMPTY_VEHICLE: VehicleForm = {
  registration_number: '', make: '', model: '', year: String(new Date().getFullYear()),
  vehicle_type: 'ULP', fuel_type: 'ULP-95', license_code_required: 'Code B',
  license_disk_expiry: '', vin_number: '', prdp_required: false, tank_capacity: '',
};

const EMPTY_DRIVER: DriverForm = {
  first_name: '', surname: '', id_number: '', phone_number: '', email: '',
  license_number: '', license_type: 'Code B', license_expiry_date: '',
  has_prdp: false, prdp_expiry_date: '',
};

type Step = 'org' | 'user' | 'account' | 'vehicles' | 'drivers' | 'review';

const STEPS: { key: Step; label: string; icon: any }[] = [
  { key: 'org', label: 'Organisation', icon: Building2 },
  { key: 'user', label: 'Main User', icon: User },
  { key: 'account', label: 'Account', icon: CheckCircle },
  { key: 'vehicles', label: 'Vehicles', icon: Car },
  { key: 'drivers', label: 'Drivers', icon: Users },
  { key: 'review', label: 'Review', icon: Check },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const UC = 'uppercase';

function StepBar({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex(s => s.key === current);
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200 overflow-x-auto">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              active ? 'bg-green-600 text-white' :
              done ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-400'
            }`}>
              {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-0.5 mx-1 ${i < currentIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GarageNewClientSetup({
  garageId, garageName, garageEmail, garagePassword, onBack, onComplete,
}: GarageNewClientSetupProps) {
  const [step, setStep] = useState<Step>('org');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [intakeFormType, setIntakeFormType] = useState<'organisation' | 'individual'>('organisation');
  const [clientType, setClientType] = useState<'organisation' | 'individual'>('organisation');
  const [individualFirstName, setIndividualFirstName] = useState('');
  const [individualSurname, setIndividualSurname] = useState('');

  // Form state
  const [orgForm, setOrgForm] = useState<OrgForm>({
    name: '', entity_type: 'Private Company (Pty) Ltd',
    company_registration_number: '', vat_number: '',
    address_line_1: '', address_line_2: '', city: '', province: '',
    postal_code: '', country: 'South Africa', phone_number: '',
  });
  const [userForm, setUserForm] = useState<UserForm>({
    name: '', surname: '', email: '', password: '', phone_mobile: '', phone_office: '',
  });
  const [accountNumber, setAccountNumber] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [vehicles, setVehicles] = useState<VehicleForm[]>([]);
  const [drivers, setDrivers] = useState<DriverForm[]>([]);

  // Inline add state
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState<VehicleForm>({ ...EMPTY_VEHICLE });
  const [addingDriver, setAddingDriver] = useState(false);
  const [driverDraft, setDriverDraft] = useState<DriverForm>({ ...EMPTY_DRIVER });
  const [vehicleError, setVehicleError] = useState('');
  const [driverError, setDriverError] = useState('');

  const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const authCreds = { garageEmail, garagePassword };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };
  };

  const up = (v: string) => v.toUpperCase();

  // ── Step: Org ──────────────────────────────────────────────────────────────

  const validateOrg = () => {
    if (clientType === 'individual') {
      if (!individualFirstName.trim() || !individualSurname.trim()) return 'Name and surname are required for individual accounts.';
    } else {
      if (!orgForm.name.trim()) return 'Organisation name is required.';
    }
    if (!orgForm.city.trim()) return 'City is required.';
    return null;
  };

  const getOrgNameForSubmit = () =>
    clientType === 'individual'
      ? `${individualFirstName.trim()} ${individualSurname.trim()}`.toUpperCase()
      : orgForm.name;

  // ── Step: User ─────────────────────────────────────────────────────────────

  const validateUser = () => {
    if (!userForm.name.trim() || !userForm.surname.trim()) return 'Name and surname are required.';
    if (!userForm.email.trim()) return 'Email is required.';
    if (!userForm.password || userForm.password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  // ── Step: Account ──────────────────────────────────────────────────────────

  const validateAccount = () => {
    if (!accountNumber.trim()) return 'Account number is required.';
    return null;
  };

  // ── Create organisation + user + account ──────────────────────────────────

  const handleCreateOrg = async () => {
    const err = validateOrg();
    if (err) { setError(err); return; }
    const err2 = validateUser();
    if (err2) { setError(err2); return; }
    const err3 = validateAccount();
    if (err3) { setError(err3); return; }

    setSubmitting(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const payload = {
        organization: {
          name: getOrgNameForSubmit(),
          entity_type: orgForm.entity_type || null,
          company_registration_number: orgForm.company_registration_number.trim().toUpperCase() || null,
          vat_number: orgForm.vat_number.trim().toUpperCase() || null,
          address_line_1: orgForm.address_line_1.trim().toUpperCase() || null,
          address_line_2: orgForm.address_line_2.trim().toUpperCase() || null,
          city: orgForm.city.trim().toUpperCase(),
          province: orgForm.province || null,
          postal_code: orgForm.postal_code.trim() || null,
          country: orgForm.country || 'South Africa',
          phone_number: orgForm.phone_number.trim() || null,
          organization_type: 'client',
          is_management_org: false,
          status: 'active',
          payment_option: 'Local Account',
          managing_garage_id: garageId,
          is_garage_managed: true,
        },
        users: [{
          name: userForm.name.trim().toUpperCase(),
          surname: userForm.surname.trim().toUpperCase(),
          email: userForm.email.trim().toLowerCase(),
          password: userForm.password,
          phone_office: userForm.phone_office.trim() || null,
          phone_mobile: userForm.phone_mobile.trim() || null,
          is_main_user: true,
          role: 'main_user',
          title: 'Main User',
          can_add_vehicles: true,
          can_edit_vehicles: true,
          can_delete_vehicles: true,
          can_add_drivers: true,
          can_edit_drivers: true,
          can_delete_drivers: true,
          can_view_reports: true,
          can_edit_organization_info: true,
          can_view_fuel_transactions: true,
          can_create_reports: true,
          can_view_custom_reports: true,
          can_manage_users: true,
          can_view_financial_data: true,
        }],
        garage_account_number: accountNumber.trim().toUpperCase(),
        monthly_spend_limit: monthlyLimit.trim() ? parseFloat(monthlyLimit) : null,
      };

      const res = await fetch(`${apiBase}/client-self-signup`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create client');

      setCreatedOrgId(json.organization_id);
      setStep('vehicles');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Add vehicle ────────────────────────────────────────────────────────────

  const commitVehicle = () => {
    if (!vehicleDraft.registration_number.trim()) { setVehicleError('Registration number is required.'); return; }
    if (!vehicleDraft.make.trim()) { setVehicleError('Make is required.'); return; }
    if (!vehicleDraft.model.trim()) { setVehicleError('Model is required.'); return; }
    setVehicles(v => [...v, { ...vehicleDraft }]);
    setVehicleDraft({ ...EMPTY_VEHICLE });
    setAddingVehicle(false);
    setVehicleError('');
  };

  // ── Add driver ────────────────────────────────────────────────────────────

  const commitDriver = () => {
    if (!driverDraft.first_name.trim() || !driverDraft.surname.trim()) { setDriverError('First name and surname are required.'); return; }
    setDrivers(d => [...d, { ...driverDraft }]);
    setDriverDraft({ ...EMPTY_DRIVER });
    setAddingDriver(false);
    setDriverError('');
  };

  // ── Final submit: save vehicles + drivers ─────────────────────────────────

  const handleFinish = async () => {
    if (!createdOrgId) return;
    setSubmitting(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const base = { ...authCreds, organizationId: createdOrgId };

      if (vehicles.length > 0) {
        const res = await fetch(`${apiBase}/garage-managed-client-setup`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'add-vehicles', ...base, vehicles: vehicles.map(v => ({
            ...v,
            year: parseInt(v.year) || new Date().getFullYear(),
            tank_capacity: v.tank_capacity ? parseFloat(v.tank_capacity) : 0,
            fuel_type: v.vehicle_type === 'ELECTRIC' ? null : v.fuel_type,
          })) }),
        });
        if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed to save vehicles'); }
      }

      if (drivers.length > 0) {
        const res = await fetch(`${apiBase}/garage-managed-client-setup`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'add-drivers', ...base, drivers }),
        });
        if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed to save drivers'); }
      }

      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const goNext = () => {
    setError('');
    if (step === 'org') {
      const err = validateOrg();
      if (err) { setError(err); return; }
      setStep('user');
    } else if (step === 'user') {
      const err = validateUser();
      if (err) { setError(err); return; }
      setStep('account');
    } else if (step === 'account') {
      handleCreateOrg();
    } else if (step === 'vehicles') {
      setStep('drivers');
    } else if (step === 'drivers') {
      setStep('review');
    }
  };

  const goBack = () => {
    setError('');
    if (step === 'org') { onBack(); return; }
    if (step === 'user') { setStep('org'); return; }
    if (step === 'account') { setStep('user'); return; }
    // Once org is created we don't allow going back to account/user/org
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 uppercase';
  const smInputCls = 'w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 uppercase';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white px-6 py-4 flex items-center gap-3">
        {!createdOrgId && (
          <button onClick={goBack} className="text-teal-200 hover:text-white transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold">New Garage-Managed Client Setup</h2>
          <p className="text-xs text-teal-100 mt-0.5">{garageName} — Local Account</p>
        </div>
      </div>

      <StepBar current={step} />

      <div className="p-6">
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-800 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── STEP: Organisation ─────────────────────────────────────────── */}
        {step === 'org' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-gray-600">Enter the client's details. All fields are saved in upper case.</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => { setIntakeFormType('organisation'); setShowIntakeForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Org Setup Form
                </button>
                <button
                  onClick={() => { setIntakeFormType('individual'); setShowIntakeForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Individual Setup Form
                </button>
              </div>
            </div>

            {/* Client type toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setClientType('organisation')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${clientType === 'organisation' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'}`}
              >
                <Building2 className="w-4 h-4" />
                Organisation
              </button>
              <button
                type="button"
                onClick={() => setClientType('individual')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${clientType === 'individual' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}
              >
                <User className="w-4 h-4" />
                Individual
              </button>
            </div>

            {clientType === 'individual' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input value={individualFirstName} onChange={e => setIndividualFirstName(up(e.target.value))}
                    className={inputCls} placeholder="E.G. JOHN" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Surname <span className="text-red-500">*</span></label>
                  <input value={individualSurname} onChange={e => setIndividualSurname(up(e.target.value))}
                    className={inputCls} placeholder="E.G. SMITH" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organisation Name <span className="text-red-500">*</span></label>
                <input value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: up(e.target.value) }))}
                  className={inputCls} placeholder="E.G. ABC TRANSPORT (PTY) LTD" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
                <select value={orgForm.entity_type} onChange={e => setOrgForm(f => ({ ...f, entity_type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                  {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input value={orgForm.phone_number} onChange={e => setOrgForm(f => ({ ...f, phone_number: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="0XX XXX XXXX" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Reg. No.</label>
                <input value={orgForm.company_registration_number} onChange={e => setOrgForm(f => ({ ...f, company_registration_number: up(e.target.value) }))}
                  className={inputCls} placeholder="2020/123456/07" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                <input value={orgForm.vat_number} onChange={e => setOrgForm(f => ({ ...f, vat_number: up(e.target.value) }))}
                  className={inputCls} placeholder="4XXXXXXXXX" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
              <input value={orgForm.address_line_1} onChange={e => setOrgForm(f => ({ ...f, address_line_1: up(e.target.value) }))}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input value={orgForm.address_line_2} onChange={e => setOrgForm(f => ({ ...f, address_line_2: up(e.target.value) }))}
                className={inputCls} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                <input value={orgForm.city} onChange={e => setOrgForm(f => ({ ...f, city: up(e.target.value) }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                <select value={orgForm.province} onChange={e => setOrgForm(f => ({ ...f, province: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                  <option value="">Select</option>
                  {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                <input value={orgForm.postal_code} onChange={e => setOrgForm(f => ({ ...f, postal_code: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Main User ────────────────────────────────────────────── */}
        {step === 'user' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-sm text-blue-800">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              The main user will manage this client account through the Client Portal. This is a garage-managed local account — payment is not by card.
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Main User Details</p>
              {clientType === 'individual' && (individualFirstName || individualSurname) && (
                <button
                  type="button"
                  onClick={() => setUserForm(f => ({ ...f, name: individualFirstName, surname: individualSurname }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Use client's details as Main User
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: up(e.target.value) }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surname <span className="text-red-500">*</span></label>
                <input value={userForm.surname} onChange={e => setUserForm(f => ({ ...f, surname: up(e.target.value) }))}
                  className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value.toLowerCase() }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 lowercase" placeholder="user@company.co.za" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
              <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="Min. 6 characters" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input value={userForm.phone_mobile} onChange={e => setUserForm(f => ({ ...f, phone_mobile: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="0821234567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Office Number</label>
                <input value={userForm.phone_office} onChange={e => setUserForm(f => ({ ...f, phone_office: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="0123456789" />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Account ──────────────────────────────────────────────── */}
        {step === 'account' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Set the local account details for this client at {garageName}.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number <span className="text-red-500">*</span></label>
              <input value={accountNumber} onChange={e => setAccountNumber(up(e.target.value))}
                className={inputCls} placeholder="E.G. ACC-0001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Spend Limit (R)</label>
              <input type="number" min="0" step="100" value={monthlyLimit} onChange={e => setMonthlyLimit(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="Leave blank for no limit" />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Clicking <strong>Create Client</strong> will register the organisation and create the main user login. You will then add vehicles and drivers.
            </div>
          </div>
        )}

        {/* ── STEP: Vehicles ─────────────────────────────────────────────── */}
        {step === 'vehicles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Vehicles</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add the client's vehicles now. After setup, only the client can modify vehicle information.
                </p>
              </div>
              {!addingVehicle && (
                <button onClick={() => { setAddingVehicle(true); setVehicleDraft({ ...EMPTY_VEHICLE }); setVehicleError(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Vehicle
                </button>
              )}
            </div>

            {vehicles.length > 0 && (
              <div className="space-y-2">
                {vehicles.map((v, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{v.registration_number} — {v.make} {v.model} ({v.year})</p>
                      <p className="text-xs text-gray-500">{v.vehicle_type}{v.fuel_type ? ` • ${v.fuel_type}` : ''}</p>
                    </div>
                    <button onClick={() => setVehicles(vs => vs.filter((_, j) => j !== i))}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {addingVehicle && (
              <div className="border border-teal-200 rounded-xl p-4 bg-teal-50/30 space-y-3">
                {vehicleError && (
                  <div className="flex items-center gap-2 text-red-700 text-xs bg-red-50 border border-red-200 rounded p-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{vehicleError}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Registration <span className="text-red-500">*</span></label>
                    <input value={vehicleDraft.registration_number} onChange={e => setVehicleDraft(v => ({ ...v, registration_number: up(e.target.value) }))}
                      className={smInputCls} placeholder="ABC 123 GP" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Make <span className="text-red-500">*</span></label>
                    <input value={vehicleDraft.make} onChange={e => setVehicleDraft(v => ({ ...v, make: up(e.target.value) }))}
                      className={smInputCls} placeholder="TOYOTA" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Model <span className="text-red-500">*</span></label>
                    <input value={vehicleDraft.model} onChange={e => setVehicleDraft(v => ({ ...v, model: up(e.target.value) }))}
                      className={smInputCls} placeholder="HILUX" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                    <input type="number" min="1990" max={new Date().getFullYear() + 1} value={vehicleDraft.year}
                      onChange={e => setVehicleDraft(v => ({ ...v, year: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Type</label>
                    <select value={vehicleDraft.vehicle_type} onChange={e => {
                      const vt = e.target.value;
                      const ft = FUEL_TYPES_BY_VEHICLE[vt]?.[0] || '';
                      setVehicleDraft(v => ({ ...v, vehicle_type: vt, fuel_type: ft }));
                    }} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                      {VEHICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {vehicleDraft.vehicle_type !== 'ELECTRIC' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Fuel Type</label>
                      <select value={vehicleDraft.fuel_type} onChange={e => setVehicleDraft(v => ({ ...v, fuel_type: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                        {(FUEL_TYPES_BY_VEHICLE[vehicleDraft.vehicle_type] || []).map(ft => <option key={ft} value={ft}>{ft}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">License Code</label>
                    <select value={vehicleDraft.license_code_required} onChange={e => setVehicleDraft(v => ({ ...v, license_code_required: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                      {LICENSE_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">License Disk Expiry</label>
                    <input type="date" value={vehicleDraft.license_disk_expiry} onChange={e => setVehicleDraft(v => ({ ...v, license_disk_expiry: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tank Capacity (L)</label>
                    <input type="number" min="0" value={vehicleDraft.tank_capacity} onChange={e => setVehicleDraft(v => ({ ...v, tank_capacity: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="e.g. 70" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">VIN Number</label>
                    <input value={vehicleDraft.vin_number} onChange={e => setVehicleDraft(v => ({ ...v, vin_number: up(e.target.value) }))}
                      className={smInputCls} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={commitVehicle}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors">
                    <Check className="w-3.5 h-3.5" /> Add Vehicle
                  </button>
                  <button onClick={() => { setAddingVehicle(false); setVehicleError(''); }}
                    className="text-xs text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {vehicles.length === 0 && !addingVehicle && (
              <p className="text-sm text-gray-400 text-center py-4">No vehicles added yet. You can skip this step.</p>
            )}
          </div>
        )}

        {/* ── STEP: Drivers ──────────────────────────────────────────────── */}
        {step === 'drivers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Drivers</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add the client's drivers now. After setup, only the client can modify driver information.
                </p>
              </div>
              {!addingDriver && (
                <button onClick={() => { setAddingDriver(true); setDriverDraft({ ...EMPTY_DRIVER }); setDriverError(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Driver
                </button>
              )}
            </div>

            {drivers.length > 0 && (
              <div className="space-y-2">
                {drivers.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.first_name} {d.surname}</p>
                      <p className="text-xs text-gray-500">{d.id_number || 'No ID'}{d.phone_number ? ` • ${d.phone_number}` : ''}</p>
                    </div>
                    <button onClick={() => setDrivers(ds => ds.filter((_, j) => j !== i))}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {addingDriver && (
              <div className="border border-teal-200 rounded-xl p-4 bg-teal-50/30 space-y-3">
                {driverError && (
                  <div className="flex items-center gap-2 text-red-700 text-xs bg-red-50 border border-red-200 rounded p-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{driverError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input value={driverDraft.first_name} onChange={e => setDriverDraft(d => ({ ...d, first_name: up(e.target.value) }))}
                      className={smInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Surname <span className="text-red-500">*</span></label>
                    <input value={driverDraft.surname} onChange={e => setDriverDraft(d => ({ ...d, surname: up(e.target.value) }))}
                      className={smInputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ID Number</label>
                    <input value={driverDraft.id_number} onChange={e => setDriverDraft(d => ({ ...d, id_number: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                    <input value={driverDraft.phone_number} onChange={e => setDriverDraft(d => ({ ...d, phone_number: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={driverDraft.email} onChange={e => setDriverDraft(d => ({ ...d, email: e.target.value.toLowerCase() }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 lowercase" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">License Number</label>
                    <input value={driverDraft.license_number} onChange={e => setDriverDraft(d => ({ ...d, license_number: up(e.target.value) }))}
                      className={smInputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">License Code</label>
                    <select value={driverDraft.license_type} onChange={e => setDriverDraft(d => ({ ...d, license_type: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                      {LICENSE_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">License Expiry</label>
                    <input type="date" value={driverDraft.license_expiry_date} onChange={e => setDriverDraft(d => ({ ...d, license_expiry_date: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={driverDraft.has_prdp} onChange={e => setDriverDraft(d => ({ ...d, has_prdp: e.target.checked }))}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                      <span className="text-xs font-medium text-gray-700">Has PrDP</span>
                    </label>
                  </div>
                </div>
                {driverDraft.has_prdp && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">PrDP Expiry Date</label>
                    <input type="date" value={driverDraft.prdp_expiry_date} onChange={e => setDriverDraft(d => ({ ...d, prdp_expiry_date: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={commitDriver}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors">
                    <Check className="w-3.5 h-3.5" /> Add Driver
                  </button>
                  <button onClick={() => { setAddingDriver(false); setDriverError(''); }}
                    className="text-xs text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {drivers.length === 0 && !addingDriver && (
              <p className="text-sm text-gray-400 text-center py-4">No drivers added yet. You can skip this step.</p>
            )}
          </div>
        )}

        {/* ── STEP: Review ───────────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2 text-sm text-green-800">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Client organisation and main user account have been created. Review the summary below, then click <strong>Complete Setup</strong>.
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              <div className="px-4 py-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Organisation</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{getOrgNameForSubmit()}</p>
                <p className="text-xs text-gray-500">{[orgForm.city, orgForm.province].filter(Boolean).join(', ')}</p>
              </div>
              <div className="px-4 py-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Main User</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{userForm.name} {userForm.surname}</p>
                <p className="text-xs text-gray-500">{userForm.email}</p>
              </div>
              <div className="px-4 py-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Local Account at {garageName}</p>
                <p className="text-sm text-gray-900 mt-1">Account No: <span className="font-semibold">{accountNumber}</span></p>
                {monthlyLimit && <p className="text-xs text-gray-500">Monthly limit: R{parseFloat(monthlyLimit).toFixed(2)}</p>}
              </div>
              <div className="px-4 py-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicles — {vehicles.length}</p>
                {vehicles.length === 0
                  ? <p className="text-xs text-gray-400 mt-1">None added</p>
                  : vehicles.map((v, i) => (
                    <p key={i} className="text-xs text-gray-700 mt-0.5">{v.registration_number} — {v.make} {v.model}</p>
                  ))}
              </div>
              <div className="px-4 py-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Drivers — {drivers.length}</p>
                {drivers.length === 0
                  ? <p className="text-xs text-gray-400 mt-1">None added</p>
                  : drivers.map((d, i) => (
                    <p key={i} className="text-xs text-gray-700 mt-0.5">{d.first_name} {d.surname}</p>
                  ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              Once setup is complete, vehicle and driver information can only be modified by the client through their own portal.
            </div>
          </div>
        )}

        {/* ── Navigation buttons ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <div>
            {!createdOrgId && (
              <button onClick={goBack}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 'review' ? (
              <button
                onClick={handleFinish}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {submitting ? 'Saving…' : 'Complete Setup'}
              </button>
            ) : step === 'vehicles' || step === 'drivers' ? (
              <button
                onClick={goNext}
                disabled={submitting || addingVehicle || addingDriver}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : step === 'account' ? (
              <button
                onClick={goNext}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {submitting ? 'Creating…' : 'Create Client'}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showIntakeForm && (
        <GarageClientIntakeForm
          garageName={garageName}
          formType={intakeFormType}
          onClose={() => setShowIntakeForm(false)}
        />
      )}
    </div>
  );
}
