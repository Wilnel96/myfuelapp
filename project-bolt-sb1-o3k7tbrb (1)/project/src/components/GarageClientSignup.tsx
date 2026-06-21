import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Search, UserPlus, Users, ArrowLeft, CheckCircle, AlertCircle, Loader2, Printer, CreditCard } from 'lucide-react';
import GarageNewClientSetup from './GarageNewClientSetup';
import GarageClientIntakeForm, { IntakeFormType } from './GarageClientIntakeForm';

interface Organization {
  id: string;
  name: string;
  vat_number: string | null;
  city: string | null;
  province: string | null;
  company_registration_number: string | null;
}

interface LocalAccount {
  organization_id: string;
}

interface GarageClientSignupProps {
  garageId: string;
  garageName: string;
  garageEmail: string;
  garagePassword: string;
  /** Already-linked org IDs so we can exclude them from the existing client list */
  linkedOrgIds: string[];
  onBack: () => void;
  /** Called after successfully linking an existing client with account details */
  onLinked: (orgId: string, accountNumber: string, monthlyLimit: number | null, notes: string | null) => Promise<void>;
  /** Called after a new client has been created via the signup form */
  onNewClientCreated: () => void;
}

type Step = 'choose' | 'search-existing' | 'link-account' | 'new-client';

export default function GarageClientSignup({
  garageId,
  garageName,
  garageEmail,
  garagePassword,
  linkedOrgIds,
  onBack,
  onLinked,
  onNewClientCreated,
}: GarageClientSignupProps) {
  const [step, setStep] = useState<Step>('choose');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [notes, setNotes] = useState('');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [intakeFormType, setIntakeFormType] = useState<IntakeFormType>('organisation');

  useEffect(() => {
    if (step === 'search-existing') {
      loadOrganizations();
    }
  }, [step]);

  const loadOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, vat_number, city, province, company_registration_number')
        .eq('organization_type', 'client')
        .eq('is_management_org', false)
        .order('name');
      if (error) throw error;
      setOrganizations(data || []);
    } catch (err: any) {
      setError('Failed to load clients: ' + err.message);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const availableOrgs = organizations.filter(
    (org) =>
      !linkedOrgIds.includes(org.id) &&
      (searchTerm === '' ||
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.vat_number && org.vat_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (org.company_registration_number &&
          org.company_registration_number.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const handleSelectExisting = (org: Organization) => {
    setSelectedOrg(org);
    setAccountNumber('');
    setMonthlyLimit('');
    setNotes('');
    setError('');
    setSuccessMsg('');
    setStep('link-account');
  };

  const handleLinkAccount = async () => {
    if (!selectedOrg || !accountNumber.trim()) {
      setError('Account number is required');
      return;
    }
    setLinking(true);
    setError('');
    try {
      const limit = monthlyLimit.trim() ? parseFloat(monthlyLimit) : null;
      await onLinked(selectedOrg.id, accountNumber.trim(), limit, notes.trim() || null);
      setSuccessMsg(`${selectedOrg.name} has been linked successfully.`);
      setTimeout(() => onBack(), 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to link account');
    } finally {
      setLinking(false);
    }
  };

  // ── Render: new client setup wizard ──────────────────────────────────────
  if (step === 'new-client') {
    return (
      <GarageNewClientSetup
        garageId={garageId}
        garageName={garageName}
        garageEmail={garageEmail}
        garagePassword={garagePassword}
        onBack={() => setStep('choose')}
        onComplete={onNewClientCreated}
      />
    );
  }

  // ── Render: link account details ─────────────────────────────────────────
  if (step === 'link-account' && selectedOrg) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => { setStep('search-existing'); setError(''); }}
            className="text-green-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Building2 className="w-5 h-5" />
          <div>
            <h2 className="text-base font-semibold">Link MyFuelApp Registered Client</h2>
            <p className="text-xs text-green-100">{selectedOrg.name}</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {successMsg && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {successMsg}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-900">{selectedOrg.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {[selectedOrg.city, selectedOrg.province].filter(Boolean).join(', ') || 'No location on file'}
              {selectedOrg.vat_number && ` • VAT: ${selectedOrg.vat_number}`}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="e.g., ACC-0042"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Spend Limit (R)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Leave blank for no limit"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              placeholder="Optional notes about this account"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setStep('search-existing'); setError(''); }}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              Back
            </button>
            <button
              onClick={handleLinkAccount}
              disabled={linking || !accountNumber.trim()}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {linking ? 'Linking...' : 'Link Account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: search existing clients ──────────────────────────────────────
  if (step === 'search-existing') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => setStep('choose')}
            className="text-green-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Search className="w-5 h-5" />
          <div>
            <h2 className="text-base font-semibold">Search MyFuelApp Registered Clients</h2>
            <p className="text-xs text-green-100">Select a registered client to link to {garageName}</p>
          </div>
        </div>

        <div className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, VAT or registration number..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            {loadingOrgs ? (
              <div className="flex items-center justify-center gap-2 py-10 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading clients...
              </div>
            ) : availableOrgs.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                {searchTerm ? 'No clients match your search.' : 'No unlinked clients found.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {availableOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSelectExisting(org)}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors flex items-center gap-3"
                  >
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{org.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {[org.city, org.province].filter(Boolean).join(', ') || 'No location'}
                        {org.vat_number && ` • VAT: ${org.vat_number}`}
                      </p>
                    </div>
                    <span className="text-xs text-green-600 font-medium flex-shrink-0">Select</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-gray-500 text-center">
            {availableOrgs.length} client{availableOrgs.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>
    );
  }

  // ── Render: initial choice ────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={onBack}
            className="text-green-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Building2 className="w-5 h-5" />
          <h2 className="text-base font-semibold">Add Local Account Client</h2>
        </div>
        <p className="text-xs text-green-100 ml-8">
          {garageName} — Local Account
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
          <strong>Garage-Managed Local Accounts</strong> — Use this section to register clients whose fuel account is managed by {garageName}. For clients who sign up independently with a credit/debit card, they register via the MyFuelApp client portal.
        </div>

        <button
          onClick={() => { setStep('search-existing'); setError(''); }}
          className="w-full bg-white border-2 border-green-200 rounded-xl p-5 hover:border-green-400 hover:bg-green-50 transition-all text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors flex-shrink-0">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Existing MyFuelApp Client</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Link a client already registered on MyFuelApp (card or account holder) to a local account at {garageName}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStep('new-client')}
          className="w-full bg-white border-2 border-teal-200 rounded-xl p-5 hover:border-teal-400 hover:bg-teal-50 transition-all text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center group-hover:bg-teal-200 transition-colors flex-shrink-0">
              <UserPlus className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">New Garage-Managed Client</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Register a brand-new client with a garage-managed local fuel account — no card required
              </p>
            </div>
          </div>
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Credit / Debit Card Clients</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Clients who pay by card register themselves via the <strong>MyFuelApp Client Portal</strong>. Direct them to sign up there — no action required here.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Print a blank intake form for the client to complete offline:</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setIntakeFormType('organisation'); setShowIntakeForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Organisation Setup Form
            </button>
            <button
              onClick={() => { setIntakeFormType('individual'); setShowIntakeForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Individual Setup Form
            </button>
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
