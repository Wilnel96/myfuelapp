import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, CheckCircle, XCircle, Loader2, CreditCard as Edit2, Save, X, AlertCircle, Search, Plus, Ban, Power, MapPin, Phone, Mail, User, CreditCard, FileText, Calendar, Download, Send, ChevronDown, ChevronRight, Receipt, ArrowLeft } from 'lucide-react';
import GarageStatementsPayments from './GarageStatementsPayments';
import GarageClientSignup from './GarageClientSignup';

interface Organization {
  id: string;
  name: string;
  vat_number: string | null;
  city: string | null;
  province: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  country: string | null;
  phone_number: string | null;
  company_registration_number: string | null;
  monthly_spending_limit: number | null;
  daily_spending_limit: number | null;
  parent_org_id: string | null;
  managing_garage_id: string | null;
  is_garage_managed: boolean;
}

interface OrgUser {
  id: string;
  first_name: string | null;
  surname: string | null;
  email: string;
  phone_mobile: string | null;
  phone_office: string | null;
  title: string | null;
  is_main_user: boolean;
}

interface LocalAccount {
  id: string;
  organization_id: string;
  is_active: boolean;
  notes: string | null;
  account_number: string | null;
  monthly_spend_limit: number | null;
  deposit_amount: number | null;
}

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
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  odometer_reading: number;
  email_sent: boolean;
  email_sent_at: string | null;
  oil_quantity?: number;
  oil_unit_price?: number;
  oil_total_amount?: number;
  oil_type?: string;
  oil_brand?: string;
  period_start?: string;
  period_end?: string;
  payment_status?: string;
  payment_due_date?: string;
}

interface FeeInvoice {
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
  status: string;
  organization?: { name: string };
}

interface GarageContactPerson {
  name: string;
  surname: string;
  email: string;
  is_primary?: boolean;
  can_change_account_numbers?: boolean;
  can_edit_client_info?: boolean;
  can_view_invoices?: boolean;
  can_create_invoices?: boolean;
  can_manage_statements?: boolean;
  can_manage_payments?: boolean;
  can_add_clients?: boolean;
  can_view_reports?: boolean;
}

interface GarageLocalAccountsProps {
  garageId: string;
  garageName: string;
  garageEmail: string;
  garagePassword: string;
  garageContacts?: GarageContactPerson[];
  initialView?: 'active' | 'view-invoices' | 'create-statements' | 'payments' | 'add-client' | 'fee-invoices' | 'all';
  onBack?: () => void;
}

export default function GarageLocalAccounts({ garageId, garageName, garageEmail, garagePassword, garageContacts = [], initialView = 'all', onBack }: GarageLocalAccountsProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [localAccounts, setLocalAccounts] = useState<LocalAccount[]>([]);
  const [organizationUsers, setOrganizationUsers] = useState<Record<string, OrgUser[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountNumberInput, setAccountNumberInput] = useState('');
  const [accountLimitInput, setAccountLimitInput] = useState('');
  const [depositInput, setDepositInput] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGarageClientSignup, setShowGarageClientSignup] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [viewingOrgId, setViewingOrgId] = useState<string | null>(null);
  const [orgInvoices, setOrgInvoices] = useState<FuelInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedFinancialOrgId, setSelectedFinancialOrgId] = useState<string | null>(null);
  const [financialInvoices, setFinancialInvoices] = useState<FuelInvoice[]>([]);
  const [loadingFinancialInvoices, setLoadingFinancialInvoices] = useState(false);
  const [showFinancialSection, setShowFinancialSection] = useState(false);
  const [financialSubView, setFinancialSubView] = useState<'menu' | 'invoices' | 'statements' | 'payments' | 'fee-invoices'>(() => {
    if (initialView === 'view-invoices') return 'invoices';
    if (initialView === 'create-statements') return 'statements';
    if (initialView === 'payments') return 'payments';
    if (initialView === 'fee-invoices') return 'fee-invoices';
    return 'menu';
  });
  const [viewingStatementsOrgId, setViewingStatementsOrgId] = useState<string | null>(null);
  const [viewingStatementsOrgName, setViewingStatementsOrgName] = useState<string>('');
  const [capturingPaymentOrgId, setCapturingPaymentOrgId] = useState<string | null>(null);
  const [capturingPaymentOrgName, setCapturingPaymentOrgName] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'eft' | 'card' | 'other'>('eft');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentsMode, setPaymentsMode] = useState<'capture' | 'search'>('capture');
  const [searchPayments, setSearchPayments] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFilterOrg, setSearchFilterOrg] = useState('');
  const [searchFilterFrom, setSearchFilterFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0];
  });
  const [searchFilterTo, setSearchFilterTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchFilterMethod, setSearchFilterMethod] = useState('');
  const isDraggingRef = useRef(false);

  // Org info editing state (for managed clients)
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editingOrgTab, setEditingOrgTab] = useState<'account' | 'client-info'>('account');
  const [orgEditFields, setOrgEditFields] = useState({
    name: '', vat_number: '', company_registration_number: '',
    address_line_1: '', address_line_2: '', city: '', province: '',
    postal_code: '', country: '', phone_number: '',
  });
  const [savingOrgInfo, setSavingOrgInfo] = useState(false);

  // Fee invoices state
  const [feeInvoices, setFeeInvoices] = useState<FeeInvoice[]>([]);
  const [loadingFeeInvoices, setLoadingFeeInvoices] = useState(false);
  const [feeInvoiceOrgId, setFeeInvoiceOrgId] = useState<string>('');
  const [feeInvoicePeriod, setFeeInvoicePeriod] = useState<string>('');
  const [generatingFeeInvoice, setGeneratingFeeInvoice] = useState(false);
  const [feeInvoiceError, setFeeInvoiceError] = useState('');
  const [feeInvoiceSuccess, setFeeInvoiceSuccess] = useState('');
  const [feeInvoiceStatusFilter, setFeeInvoiceStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [garageId]);

  useEffect(() => {
    if (financialSubView === 'fee-invoices' && organizations.length > 0) {
      loadFeeInvoices();
    }
  }, [financialSubView, organizations]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch organizations via regular query (public data)
      const orgsResult = await supabase
        .from('organizations')
        .select(`
          id, name, vat_number, city, province,
          address_line_1, address_line_2, postal_code, country,
          phone_number, company_registration_number,
          monthly_spending_limit, daily_spending_limit,
          parent_org_id, managing_garage_id, is_garage_managed
        `)
        .eq('organization_type', 'client')
        .order('name');

      if (orgsResult.error) throw orgsResult.error;

      // Get the current session for authenticated requests
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Fetch garage accounts via secure Edge Function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garage-local-accounts`;
      const accountsResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          action: 'list',
          garageEmail,
          garagePassword,
        }),
      });

      if (!accountsResponse.ok) {
        const error = await accountsResponse.json();
        throw new Error(error.error || 'Failed to load accounts');
      }

      const accountsData = await accountsResponse.json();

      setOrganizations(orgsResult.data || []);
      setLocalAccounts(accountsData.data || []);

      const allOrgIds = (orgsResult.data || []).map(o => o.id);

      if (allOrgIds.length > 0) {
        const usersResult = await supabase
          .from('organization_users')
          .select('id, organization_id, first_name, surname, email, phone_mobile, phone_office, title, is_main_user')
          .in('organization_id', allOrgIds)
          .eq('is_active', true);

        if (usersResult.error) {
          console.error('Error loading organization users:', usersResult.error);
          setError(`Failed to load contact information: ${usersResult.error.message}`);
        } else if (usersResult.data) {
          const usersByOrg: Record<string, OrgUser[]> = {};
          usersResult.data.forEach(user => {
            if (!usersByOrg[user.organization_id]) {
              usersByOrg[user.organization_id] = [];
            }
            usersByOrg[user.organization_id].push(user);
          });
          setOrganizationUsers(usersByOrg);
          console.log('Loaded organization users:', usersByOrg);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFeeInvoices = async () => {
    setLoadingFeeInvoices(true);
    setFeeInvoiceError('');
    try {
      const query = supabase
        .from('invoices')
        .select('id, organization_id, invoice_number, invoice_date, billing_period_start, billing_period_end, subtotal, vat_amount, total_amount, amount_paid, amount_outstanding, payment_terms, payment_due_date, status, organization:organizations(name)')
        .in('organization_id', organizations.filter(o => o.is_garage_managed && o.managing_garage_id === garageId).map(o => o.id))
        .order('invoice_date', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      setFeeInvoices((data || []) as unknown as FeeInvoice[]);
    } catch (err: any) {
      setFeeInvoiceError(err.message);
    } finally {
      setLoadingFeeInvoices(false);
    }
  };

  const generateFeeInvoice = async () => {
    if (!feeInvoiceOrgId || !feeInvoicePeriod) return;
    setGeneratingFeeInvoice(true);
    setFeeInvoiceError('');
    setFeeInvoiceSuccess('');
    try {
      const [year, month] = feeInvoicePeriod.split('-').map(Number);
      const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-garage-fee-invoices`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ garage_id: garageId, organization_id: feeInvoiceOrgId, billing_period_start: periodStart, billing_period_end: periodEnd }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to generate invoice');
      setFeeInvoiceSuccess(`Invoice ${result.invoice_number} created for ${result.organization} — R${result.total_amount?.toFixed(2)}`);
      await loadFeeInvoices();
    } catch (err: any) {
      setFeeInvoiceError(err.message);
    } finally {
      setGeneratingFeeInvoice(false);
    }
  };

  const toggleAccountStatus = async (account: LocalAccount, newStatus: boolean) => {
    try {
      setSaving(account.id);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garage-local-accounts`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          action: 'update',
          garageEmail,
          garagePassword,
          accountId: account.id,
          accountData: { is_active: newStatus },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update account');
      }

      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const openAddModal = (org: Organization) => {
    setSelectedOrganization(org);
    setAccountNumberInput('');
    setAccountLimitInput('');
    setNotesInput('');
    setShowAddModal(true);
  };

  const handleAddAccount = async () => {
    if (!selectedOrganization || !accountNumberInput.trim()) {
      setError('Account number is required');
      return;
    }

    try {
      setSaving(selectedOrganization.id);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const monthlySpendLimit = accountLimitInput.trim() ? parseFloat(accountLimitInput) : null;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garage-local-accounts`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          action: 'create',
          garageEmail,
          garagePassword,
          accountData: {
            organization_id: selectedOrganization.id,
            is_active: true,
            account_number: accountNumberInput.trim(),
            monthly_spend_limit: monthlySpendLimit,
            notes: notesInput.trim() || null,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create account');
      }

      await loadData();
      setShowAddModal(false);
      setSelectedOrganization(null);
      setAccountNumberInput('');
      setAccountLimitInput('');
      setNotesInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleCancelAddModal = () => {
    setShowAddModal(false);
    setSelectedOrganization(null);
    setAccountNumberInput('');
    setAccountLimitInput('');
    setNotesInput('');
    setError('');
  };

  const isAccountActive = (organizationId: string): boolean => {
    const account = localAccounts.find(a => a.organization_id === organizationId);
    return account ? account.is_active : false;
  };

  const getAccount = (organizationId: string): LocalAccount | undefined => {
    return localAccounts.find(a => a.organization_id === organizationId);
  };

  const handleSaveAccount = async (accountId: string) => {
    try {
      setSaving(accountId);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const monthlySpendLimit = accountLimitInput.trim() ? parseFloat(accountLimitInput) : null;
      const depositAmount = depositInput.trim() ? parseFloat(depositInput) : null;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garage-local-accounts`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          action: 'update',
          garageEmail,
          garagePassword,
          accountId,
          accountData: {
            account_number: accountNumberInput || null,
            monthly_spend_limit: monthlySpendLimit,
            deposit_amount: depositAmount,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update account');
      }

      await loadData();
      setEditingAccountId(null);
      setAccountNumberInput('');
      setAccountLimitInput('');
      setDepositInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setEditingOrgId(null);
    setAccountNumberInput('');
    setAccountLimitInput('');
    setDepositInput('');
  };

  // Derive current user's permissions from contact_persons
  const currentUserPermissions = (() => {
    const contact = garageContacts.find(
      c => c.email?.toLowerCase() === garageEmail?.toLowerCase()
    );
    if (!contact || contact.is_primary) {
      return {
        can_change_account_numbers: true,
        can_edit_client_info: true,
        can_view_invoices: true,
        can_create_invoices: true,
        can_manage_statements: true,
        can_manage_payments: true,
        can_add_clients: true,
        can_view_reports: true,
      };
    }
    return {
      can_change_account_numbers: contact.can_change_account_numbers ?? false,
      can_edit_client_info: contact.can_edit_client_info ?? false,
      can_view_invoices: contact.can_view_invoices ?? true,
      can_create_invoices: contact.can_create_invoices ?? false,
      can_manage_statements: contact.can_manage_statements ?? false,
      can_manage_payments: contact.can_manage_payments ?? false,
      can_add_clients: contact.can_add_clients ?? false,
      can_view_reports: contact.can_view_reports ?? true,
    };
  })();

  const startEditAccount = (account: LocalAccount, org: Organization) => {
    setEditingAccountId(account.id);
    setEditingOrgId(org.id);
    setEditingOrgTab('account');
    setAccountNumberInput(account.account_number || '');
    setAccountLimitInput(account.monthly_spend_limit ? account.monthly_spend_limit.toString() : '');
    setDepositInput(account.deposit_amount ? account.deposit_amount.toString() : '');
    setOrgEditFields({
      name: org.name || '',
      vat_number: org.vat_number || '',
      company_registration_number: org.company_registration_number || '',
      address_line_1: org.address_line_1 || '',
      address_line_2: org.address_line_2 || '',
      city: org.city || '',
      province: org.province || '',
      postal_code: org.postal_code || '',
      country: org.country || 'South Africa',
      phone_number: org.phone_number || '',
    });
  };

  const handleSaveOrgInfo = async (organizationId: string) => {
    setSavingOrgInfo(true);
    setError('');
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garage-local-accounts`;
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          action: 'update-org-info',
          garageEmail,
          garagePassword,
          organizationId,
          orgData: orgEditFields,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update client information');
      }
      setSuccessMessage('Client information updated successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingOrgInfo(false);
    }
  };

  const loadOrganizationInvoices = async (organizationId: string) => {
    try {
      setLoadingInvoices(true);
      const { data, error } = await supabase
        .from('fuel_transaction_invoices')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('garage_name', garageName)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const transformedData = (data || []).map(invoice => ({
        ...invoice,
        period_start: invoice.transaction_date,
        period_end: invoice.transaction_date,
        payment_status: 'pending',
        payment_due_date: invoice.invoice_date
      }));

      setOrgInvoices(transformedData);
    } catch (err: any) {
      console.error('Error loading invoices:', err.message);
      setOrgInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleViewOrganization = (orgId: string) => {
    setViewingOrgId(orgId);
    loadOrganizationInvoices(orgId);
  };

  const loadFinancialInvoices = async (organizationId: string) => {
    try {
      setLoadingFinancialInvoices(true);

      // Use SECURITY DEFINER RPC to fetch invoices for this garage+org combination,
      // avoiding RLS issues and the unreliable garage_name text match.
      const { data, error } = await supabase.rpc('get_statement_invoices', {
        p_garage_id: garageId,
        p_organization_id: organizationId,
        p_period_start: '2000-01-01',
        p_period_end: '2099-12-31',
      });

      if (error) throw error;

      const transformedData = (data || []).map((invoice: any) => ({
        ...invoice,
        invoice_date: invoice.invoice_date || invoice.transaction_date,
        period_start: invoice.transaction_date,
        period_end: invoice.transaction_date,
        payment_status: 'pending',
        payment_due_date: invoice.invoice_date || invoice.transaction_date,
        garage_name: garageName,
        garage_address: '',
        subtotal: Number(invoice.total_amount),
        vat_amount: 0,
      }));

      setFinancialInvoices(transformedData);
    } catch (err: any) {
      console.error('Error loading financial invoices:', err.message);
      setFinancialInvoices([]);
    } finally {
      setLoadingFinancialInvoices(false);
    }
  };

  const handleSelectFinancialOrg = (orgId: string) => {
    setSelectedFinancialOrgId(orgId);
    loadFinancialInvoices(orgId);
  };

  const handleDownloadInvoice = async (invoice: FuelInvoice, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      const { generateFuelInvoicePDF, downloadPDFBlob } = await import('../lib/invoicePdfGenerator');

      const { data: garageData, error: fetchError } = await supabase
        .from('garages')
        .select('name, address_line_1, address_line_2, city, province, postal_code, vat_number')
        .eq('id', garageId)
        .single();

      if (fetchError) {
        console.error('Error fetching garage data:', fetchError);
      }

      const garageAddress = garageData
        ? [
            garageData.address_line_1,
            garageData.address_line_2,
            garageData.city,
            garageData.province,
            garageData.postal_code
          ].filter(Boolean).join(', ')
        : '';

      const pdfBlob = await generateFuelInvoicePDF({
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        transaction_date: invoice.transaction_date,
        vehicle_registration: invoice.vehicle_registration,
        driver_name: invoice.driver_name,
        garage_name: garageData?.name || garageName,
        garage_vat_number: garageData?.vat_number,
        garage_address: garageAddress,
        fuel_type: invoice.fuel_type,
        liters: invoice.liters,
        price_per_liter: invoice.price_per_liter,
        total_amount: invoice.total_amount,
        oil_quantity: invoice.oil_quantity,
        oil_type: invoice.oil_type,
        oil_brand: invoice.oil_brand,
        oil_unit_price: invoice.oil_unit_price,
        oil_total_amount: invoice.oil_total_amount
      });

      downloadPDFBlob(pdfBlob, `fuel-invoice-${invoice.invoice_number}.pdf`);
    } catch (err) {
      console.error('Error downloading invoice:', err);
      alert('Failed to download invoice. Please try again.');
    }
  };

  const handleEmailInvoice = async (invoice: FuelInvoice) => {
    setError('');
    setSuccessMessage('');

    try {
      setSuccessMessage(`Email functionality for invoice ${invoice.invoice_number} is not yet implemented. This feature will be available soon.`);

      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getOrganizationName = (orgId: string): string => {
    const org = organizations.find(o => o.id === orgId);
    return org ? org.name : 'Unknown Organization';
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (org.vat_number && org.vat_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeAccounts = localAccounts.filter(a => a.is_active);
  const inactiveAccounts = localAccounts.filter(a => !a.is_active);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading client accounts...</span>
      </div>
    );
  }

  const viewingOrg = viewingOrgId ? organizations.find(o => o.id === viewingOrgId) : null;
  const viewingOrgUsers = viewingOrgId ? organizationUsers[viewingOrgId] || [] : [];
  const mainUser = viewingOrgUsers.find(u => u.is_main_user);
  const viewingAccount = viewingOrgId ? localAccounts.find(a => a.organization_id === viewingOrgId) : null;

  if (viewingStatementsOrgId) {
    return (
      <GarageStatementsPayments
        garageId={garageId}
        garageName={garageName}
        organizationId={viewingStatementsOrgId}
        organizationName={viewingStatementsOrgName}
        onBack={() => {
          setViewingStatementsOrgId(null);
          setViewingStatementsOrgName('');
        }}
      />
    );
  }

  if (showGarageClientSignup) {
    return (
      <GarageClientSignup
        garageId={garageId}
        garageName={garageName}
        garageEmail={garageEmail}
        garagePassword={garagePassword}
        linkedOrgIds={localAccounts.map((a) => a.organization_id)}
        onBack={() => setShowGarageClientSignup(false)}
        onLinked={async (orgId, accountNumber, monthlyLimit, notes) => {
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garage-local-accounts`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({
              action: 'create',
              garageEmail,
              garagePassword,
              accountData: {
                organization_id: orgId,
                is_active: true,
                account_number: accountNumber,
                monthly_spend_limit: monthlyLimit,
                notes,
              },
            }),
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create account');
          }
          await loadData();
          setShowGarageClientSignup(false);
        }}
        onNewClientCreated={() => {
          loadData();
          setShowGarageClientSignup(false);
        }}
      />
    );
  }

  return (
    <>
      {viewingOrg && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              isDraggingRef.current = false;
            }
          }}
          onMouseMove={() => {
            isDraggingRef.current = true;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDraggingRef.current) {
              setViewingOrgId(null);
            }
            isDraggingRef.current = false;
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-4 border-b border-gray-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{viewingOrg.name}</h3>
                  <p className="text-xs text-gray-500">Client Organization Details</p>
                </div>
              </div>
              <button
                onClick={() => setViewingOrgId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
              {/* Company Information */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" />
                  Company Information
                </h4>
                <div className="space-y-2">
                  {/* Organization Name */}
                  <div className="pb-2 border-b border-gray-200">
                    <span className="text-gray-600 text-xs">Organization Name:</span>
                    <div className="mt-0.5 font-semibold text-gray-900 text-base">{viewingOrg.name}</div>
                  </div>

                  {/* Registration and VAT */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {viewingOrg.company_registration_number && (
                      <div>
                        <span className="text-gray-600">Registration:</span>
                        <span className="ml-2 font-medium text-gray-900">{viewingOrg.company_registration_number}</span>
                      </div>
                    )}
                    {viewingOrg.vat_number && (
                      <div>
                        <span className="text-gray-600">VAT Number:</span>
                        <span className="ml-2 font-medium text-gray-900">{viewingOrg.vat_number}</span>
                      </div>
                    )}
                    {viewingOrg.phone_number && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Phone:</span>
                        <span className="ml-2 font-medium text-gray-900">{viewingOrg.phone_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Physical Address
                </h4>
                <div className="text-xs text-gray-900">
                  {viewingOrg.address_line_1 && <div>{viewingOrg.address_line_1}</div>}
                  {viewingOrg.address_line_2 && <div>{viewingOrg.address_line_2}</div>}
                  {(viewingOrg.city || viewingOrg.province || viewingOrg.postal_code) && (
                    <div>
                      {[viewingOrg.city, viewingOrg.province, viewingOrg.postal_code].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {viewingOrg.country && <div>{viewingOrg.country}</div>}
                  {!viewingOrg.address_line_1 && !viewingOrg.city && (
                    <div className="text-gray-500 italic">No address on file</div>
                  )}
                </div>
              </div>

              {/* Local Account Details */}
              {viewingAccount && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                  <h4 className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5" />
                    Local Account Details
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="bg-white rounded p-2">
                      <span className="text-gray-600">Account Number:</span>
                      <span className="ml-2 font-bold text-gray-900">
                        {viewingAccount.account_number || <span className="text-red-600 italic">Not set - Required!</span>}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white rounded p-2">
                        <span className="text-gray-600">Monthly Spend Limit:</span>
                        <div className="font-medium text-gray-900 mt-0.5">
                          {viewingAccount.monthly_spend_limit ? `R ${viewingAccount.monthly_spend_limit.toFixed(2)}` : (
                            <span className="text-gray-500 italic">No limit</span>
                          )}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <span className="text-gray-600">Deposit:</span>
                        <div className="font-bold text-gray-900 mt-0.5">
                          {viewingAccount.deposit_amount ? `R ${viewingAccount.deposit_amount.toFixed(2)}` : (
                            <span className="text-gray-500 italic">No deposit</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {viewingAccount.notes && (
                      <div className="bg-white rounded p-2">
                        <span className="text-gray-600">Notes:</span>
                        <div className="text-gray-900 mt-0.5">{viewingAccount.notes}</div>
                      </div>
                    )}
                    <div className="bg-white rounded p-2">
                      <span className="text-gray-600">Account Status:</span>
                      <span className={`ml-2 font-medium ${viewingAccount.is_active ? 'text-green-700' : 'text-red-700'}`}>
                        {viewingAccount.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Spending Limits */}
              {(viewingOrg.daily_spending_limit || viewingOrg.monthly_spending_limit) && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5" />
                    Organization Spending Limits
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {viewingOrg.daily_spending_limit && (
                      <div>
                        <span className="text-gray-600">Daily Limit:</span>
                        <span className="ml-2 font-medium text-gray-900">R {viewingOrg.daily_spending_limit.toFixed(2)}</span>
                      </div>
                    )}
                    {viewingOrg.monthly_spending_limit && (
                      <div>
                        <span className="text-gray-600">Monthly Limit:</span>
                        <span className="ml-2 font-medium text-gray-900">R {viewingOrg.monthly_spending_limit.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Persons */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  Contact Persons
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Main User */}
                  <div className="bg-white rounded-lg p-2 border border-blue-200">
                    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-blue-100">
                      <User className="w-3 h-3 text-blue-600" />
                      <h5 className="text-xs font-semibold text-blue-900">Main User / Account Owner</h5>
                    </div>
                    {mainUser ? (
                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="text-gray-600">Name:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {[mainUser.first_name, mainUser.surname].filter(Boolean).join(' ') || 'Not specified'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Email:</span>
                          <span className="ml-2 font-medium text-gray-900">{mainUser.email}</span>
                        </div>
                        {mainUser.phone_mobile && (
                          <div>
                            <span className="text-gray-600">Mobile:</span>
                            <span className="ml-2 font-medium text-gray-900">{mainUser.phone_mobile}</span>
                          </div>
                        )}
                        {mainUser.phone_office && (
                          <div>
                            <span className="text-gray-600">Office:</span>
                            <span className="ml-2 font-medium text-gray-900">{mainUser.phone_office}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic">No main user information on file</div>
                    )}
                  </div>

                  {/* Billing Contact */}
                  <div className="bg-white rounded-lg p-2 border border-amber-200">
                    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-amber-100">
                      <Mail className="w-3 h-3 text-amber-600" />
                      <h5 className="text-xs font-semibold text-amber-900">Billing User</h5>
                    </div>
                    {(() => {
                      const billingUser = organizationUsers[viewingOrg.id]?.find(u => u.title === 'Billing User');
                      return billingUser ? (
                        <div className="space-y-1.5 text-xs">
                          {(billingUser.first_name || billingUser.surname) && (
                            <div>
                              <span className="text-gray-600">Name:</span>
                              <span className="ml-2 font-medium text-gray-900">
                                {[billingUser.first_name, billingUser.surname].filter(Boolean).join(' ')}
                              </span>
                            </div>
                          )}
                          {billingUser.email && (
                            <div>
                              <span className="text-gray-600">Email:</span>
                              <span className="ml-2 font-medium text-gray-900">{billingUser.email}</span>
                            </div>
                          )}
                          {billingUser.phone_mobile && (
                            <div>
                              <span className="text-gray-600">Mobile:</span>
                              <span className="ml-2 font-medium text-gray-900">{billingUser.phone_mobile}</span>
                            </div>
                          )}
                          {billingUser.phone_office && (
                            <div>
                              <span className="text-gray-600">Office:</span>
                              <span className="ml-2 font-medium text-gray-900">{billingUser.phone_office}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 italic">No billing user on file</div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Fuel Invoices */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Fuel Transaction Invoices
                </h4>
                {loadingInvoices ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="ml-2 text-xs text-gray-500">Loading invoices...</span>
                  </div>
                ) : orgInvoices.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {orgInvoices.map((invoice) => (
                      <div key={invoice.id} className="bg-white rounded-lg p-2 border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-gray-600" />
                              <span className="text-xs font-semibold text-gray-900">{invoice.invoice_number}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-600">
                                {new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-xs font-bold text-gray-900">
                                R {invoice.total_amount.toFixed(2)}
                              </span>
                            </div>
                            <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                              invoice.payment_status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : invoice.payment_status === 'overdue'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5 pt-2 border-t border-gray-100">
                          <div>
                            <span className="text-gray-500">Period:</span>
                            <span className="ml-1">
                              {new Date(invoice.period_start).toLocaleDateString('en-ZA')} - {new Date(invoice.period_end).toLocaleDateString('en-ZA')}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Due Date:</span>
                            <span className="ml-1">{new Date(invoice.payment_due_date).toLocaleDateString('en-ZA')}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <div>
                              <span className="text-gray-500">Subtotal:</span>
                              <span className="ml-1 font-medium">R {invoice.subtotal.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">VAT:</span>
                              <span className="ml-1 font-medium">R {invoice.vat_amount.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Total:</span>
                              <span className="ml-1 font-bold">R {invoice.total_amount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic py-2">No invoices found for this organization</div>
                )}
              </div>
            </div>
            </div>

            <div className="px-3 py-1 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setViewingOrgId(null)}
                className="w-full px-2 py-0.5 bg-gray-200 text-gray-800 rounded text-xs font-medium hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && selectedOrganization && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 pt-16"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              isDraggingRef.current = false;
            }
          }}
          onMouseMove={() => {
            isDraggingRef.current = true;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && saving === null && !isDraggingRef.current) {
              handleCancelAddModal();
            }
            isDraggingRef.current = false;
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[calc(100vh-8rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 p-4 border-b border-gray-200">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Plus className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">
                  Add Local Account
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Adding <strong>{selectedOrganization.name}</strong> as a client
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Account Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountNumberInput}
                    onChange={(e) => setAccountNumberInput(e.target.value)}
                    placeholder="Enter the account number"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-0.5">
                    The account number this client has in your system
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Monthly Spend Limit (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">R</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={accountLimitInput}
                      onChange={(e) => setAccountLimitInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Maximum monthly spending for this client (resets each month)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Add any notes about this account"
                    rows={2}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded p-2">
                    <p className="text-xs text-red-800">{error}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-3 py-1 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={handleCancelAddModal}
                disabled={saving === selectedOrganization.id}
                className="flex-1 px-2 py-0.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!accountNumberInput.trim() || saving === selectedOrganization.id}
                className="flex-1 px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                {saving === selectedOrganization.id ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Add Client'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {initialView === 'active' ? 'Active Accounts' :
               initialView === 'view-invoices' ? 'View Fuel Invoices' :
               initialView === 'create-statements' ? 'Create Statements' :
               initialView === 'payments' ? 'Payments' :
               initialView === 'add-client' ? 'Add New Client' :
               'MyFuelApp Local Accounts'}
            </h2>
          </div>
          <span className="text-sm text-gray-600">
            {activeAccounts.length} active client{activeAccounts.length !== 1 ? 's' : ''}
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {initialView === 'active' ? 'View and manage your active local account clients' :
           initialView === 'view-invoices' ? 'View and download fuel invoices for your local account clients' :
           initialView === 'create-statements' ? 'Generate and manage monthly statements for your clients' :
           initialView === 'payments' ? 'Record and manage payments received from clients' :
           initialView === 'add-client' ? 'Add new organizations to your local account client list' :
           `Manage which organizations have local accounts at ${garageName}. These clients can refuel at your garage using their account number.`}
        </p>

        {error && !showAddModal && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {successMessage && !showAddModal && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-800">{successMessage}</p>
            </div>
          </div>
        )}

        {(initialView === 'all' || initialView === 'add-client') && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search organizations by name or VAT number..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
        )}

        <div className="space-y-6">
          {(initialView === 'active' || initialView === 'all') && activeAccounts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Active Accounts</h3>
              <div className="space-y-2">
                {activeAccounts.map((account) => {
                  const org = organizations.find(o => o.id === account.organization_id);
                  if (!org) return null;

                  const isSaving = saving === account.id || saving === org.id;
                  const isEditingAccount = editingAccountId === account.id;

                  return (
                    <div
                      key={account.id}
                      className="p-3 border border-green-200 bg-green-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between p-1 rounded">
                        <div className="flex items-center space-x-3 flex-1">
                          <Building2 className="w-5 h-5 text-green-600" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                              {org.is_garage_managed && org.managing_garage_id === garageId ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
                                  Managed Client
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                  External Local Account
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600">
                              {org.city || 'City not specified'}
                              {org.vat_number && ` • VAT: ${org.vat_number}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isEditingAccount && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewOrganization(org.id);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                              >
                                <User className="w-3.5 h-3.5" />
                                View Details
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAccountStatus(account, false);
                                }}
                                disabled={isSaving}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-50 transition-colors"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Deactivate
                              </button>
                            </>
                          )}
                          {isSaving ? (
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                      </div>

                      <div className="mt-3 ml-8 pl-3 border-l-2 border-green-300">
                        {isEditingAccount ? (
                          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm" onClick={e => e.stopPropagation()}>
                            {/* Tab bar */}
                            <div className="flex border-b border-gray-200 mb-4 gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingOrgTab('account')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${editingOrgTab === 'account' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                              >
                                Account Settings
                              </button>
                              {org.is_garage_managed && org.managing_garage_id === garageId && (
                                <button
                                  type="button"
                                  onClick={() => setEditingOrgTab('client-info')}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${editingOrgTab === 'client-info' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                                >
                                  Client Information
                                </button>
                              )}
                            </div>

                            {editingOrgTab === 'account' && (
                              <div className="space-y-3">
                                {/* Account Number — gated by permission */}
                                {currentUserPermissions.can_change_account_numbers ? (
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-700 w-32 flex-shrink-0">Account Number</label>
                                    <input
                                      type="text"
                                      value={accountNumberInput}
                                      onChange={(e) => setAccountNumberInput(e.target.value)}
                                      placeholder="Enter account number"
                                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    Account number changes require the primary garage user.
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-medium text-gray-700 w-32 flex-shrink-0">Monthly Spend Limit</label>
                                  <div className="flex-1 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">R</span>
                                    <input
                                      type="number" step="0.01" min="0"
                                      value={accountLimitInput}
                                      onChange={(e) => setAccountLimitInput(e.target.value)}
                                      placeholder="No limit"
                                      className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-medium text-gray-700 w-32 flex-shrink-0">Deposit</label>
                                  <div className="flex-1 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">R</span>
                                    <input
                                      type="number" step="0.01" min="0"
                                      value={depositInput}
                                      onChange={(e) => setDepositInput(e.target.value)}
                                      placeholder="0.00"
                                      className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={() => handleSaveAccount(account.id)}
                                    disabled={isSaving}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {editingOrgTab === 'client-info' && (
                              <div className="space-y-3">
                                {!currentUserPermissions.can_edit_client_info ? (
                                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    You do not have permission to edit client information.
                                  </div>
                                ) : (
                                  <>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Organisation Name</label>
                                        <input type="text" value={orgEditFields.name}
                                          onChange={e => setOrgEditFields(f => ({ ...f, name: e.target.value }))}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                                        <input type="text" value={orgEditFields.phone_number}
                                          onChange={e => setOrgEditFields(f => ({ ...f, phone_number: e.target.value }))}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">VAT Number</label>
                                        <input type="text" value={orgEditFields.vat_number}
                                          onChange={e => setOrgEditFields(f => ({ ...f, vat_number: e.target.value }))}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Company Reg. No.</label>
                                        <input type="text" value={orgEditFields.company_registration_number}
                                          onChange={e => setOrgEditFields(f => ({ ...f, company_registration_number: e.target.value }))}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 1</label>
                                      <input type="text" value={orgEditFields.address_line_1}
                                        onChange={e => setOrgEditFields(f => ({ ...f, address_line_1: e.target.value }))}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 2</label>
                                      <input type="text" value={orgEditFields.address_line_2}
                                        onChange={e => setOrgEditFields(f => ({ ...f, address_line_2: e.target.value }))}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                                        <input type="text" value={orgEditFields.city}
                                          onChange={e => setOrgEditFields(f => ({ ...f, city: e.target.value }))}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Province</label>
                                        <select value={orgEditFields.province}
                                          onChange={e => setOrgEditFields(f => ({ ...f, province: e.target.value }))}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                          <option value="">Select</option>
                                          {['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','Northern Cape','North West','Western Cape'].map(p => (
                                            <option key={p} value={p}>{p}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Postal Code</label>
                                        <input type="text" value={orgEditFields.postal_code}
                                          onChange={e => setOrgEditFields(f => ({ ...f, postal_code: e.target.value }))}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                      <button
                                        onClick={() => handleSaveOrgInfo(org.id)}
                                        disabled={savingOrgInfo}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                        {savingOrgInfo ? 'Saving…' : 'Save Client Info'}
                                      </button>
                                      <button
                                        onClick={handleCancelEdit}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        Cancel
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 space-y-1">
                                <p className="text-xs text-gray-700">
                                  <span className="font-medium">Account Number: </span>
                                  {account.account_number ? (
                                    <span className="text-gray-900 font-bold">{account.account_number}</span>
                                  ) : (
                                    <span className="text-red-600 font-semibold">
                                      <AlertCircle className="w-3 h-3 inline" /> REQUIRED
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-700">
                                  <span className="font-medium">Monthly Spend Limit: </span>
                                  {account.monthly_spend_limit ? (
                                    <span className="text-gray-900 font-bold">R {account.monthly_spend_limit.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-gray-500 italic">No limit set</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-700">
                                  <span className="font-medium">Deposit: </span>
                                  {account.deposit_amount ? (
                                    <span className="text-gray-900 font-bold">R {account.deposit_amount.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-gray-500 italic">No deposit</span>
                                  )}
                                </p>
                                {account.notes && (
                                  <p className="text-xs text-gray-600">
                                    <span className="font-medium">Notes: </span>
                                    {account.notes}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingStatementsOrgId(account.organization_id);
                                  setViewingStatementsOrgName(org.name);
                                }}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                Statements
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditAccount(account, org);
                                }}
                                className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded ${account.account_number ? 'text-blue-700 bg-blue-100 hover:bg-blue-200' : 'text-red-700 bg-red-100 hover:bg-red-200 animate-pulse'}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(initialView === 'active' || initialView === 'all') && inactiveAccounts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Inactive Accounts</h3>
              <div className="space-y-2">
                {inactiveAccounts.map((account) => {
                  const org = organizations.find(o => o.id === account.organization_id);
                  if (!org) return null;

                  const isSaving = saving === account.id;

                  return (
                    <div
                      key={account.id}
                      className="p-3 border border-gray-200 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <Building2 className="w-5 h-5 text-gray-400" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{org.name}</p>
                            <p className="text-xs text-gray-500">
                              {org.city || 'City not specified'}
                              {account.account_number && ` • Account: ${account.account_number}`}
                              {account.monthly_spend_limit && ` • Limit: R${account.monthly_spend_limit.toFixed(2)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAccountStatus(account, true)}
                            disabled={isSaving}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            <Power className="w-3.5 h-3.5" />
                            Activate
                          </button>
                          {isSaving ? (
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(initialView === 'add-client' || initialView === 'all') && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Add Client to Local Account</h3>
            <button
              onClick={() => setShowGarageClientSignup(true)}
              className="w-full flex items-center gap-3 bg-white border-2 border-green-200 rounded-xl p-4 hover:border-green-400 hover:bg-green-50 transition-all group"
            >
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors flex-shrink-0">
                <Plus className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">Add New or Existing Client</p>
                <p className="text-xs text-gray-500 mt-0.5">Search existing clients or register a new one</p>
              </div>
            </button>
          </div>
          )}

          {/* Financial Information Section */}
          {(initialView === 'view-invoices' || initialView === 'create-statements' || initialView === 'payments' || initialView === 'fee-invoices' || initialView === 'all') && (
          <div className="mt-6">
            {financialSubView === 'menu' ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-green-700" />
                  <h3 className="text-sm font-semibold text-green-900">Financial Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setFinancialSubView('invoices')}
                    className="bg-white border-2 border-green-200 rounded-lg p-4 hover:border-green-400 hover:shadow-md transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <Receipt className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">View Fuel Invoices</h4>
                        <p className="text-xs text-gray-600 mt-0.5">View and download client invoices</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFinancialSubView('statements')}
                    className="bg-white border-2 border-green-200 rounded-lg p-4 hover:border-green-400 hover:shadow-md transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">Create Statements</h4>
                        <p className="text-xs text-gray-600 mt-0.5">Generate and manage client statements</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFinancialSubView('payments')}
                    className="bg-white border-2 border-green-200 rounded-lg p-4 hover:border-green-400 hover:shadow-md transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                        <CreditCard className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">Payments</h4>
                        <p className="text-xs text-gray-600 mt-0.5">Record and manage client payments</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFinancialSubView('fee-invoices')}
                    className="bg-white border-2 border-green-200 rounded-lg p-4 hover:border-green-400 hover:shadow-md transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                        <FileText className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">Fee Invoices</h4>
                        <p className="text-xs text-gray-600 mt-0.5">Generate and view monthly management fee invoices</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            ) : financialSubView === 'invoices' ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-900">View Fuel Invoices</h3>
                  </div>
                  <button
                    onClick={() => {
                      setFinancialSubView('menu');
                      setSelectedFinancialOrgId(null);
                      setFinancialInvoices([]);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Back
                  </button>
                </div>

                {/* Client Selection */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Select Client to View Invoices
                  </label>
                  <select
                    value={selectedFinancialOrgId || ''}
                    onChange={(e) => {
                      const orgId = e.target.value;
                      if (orgId) {
                        handleSelectFinancialOrg(orgId);
                      } else {
                        setSelectedFinancialOrgId(null);
                        setFinancialInvoices([]);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Select a local account client --</option>
                    {activeAccounts.map((account) => {
                      const org = organizations.find(o => o.id === account.organization_id);
                      if (!org) return null;
                      return (
                        <option key={account.id} value={org.id}>
                          {org.name} {account.account_number ? `(Acc: ${account.account_number})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Invoices Display */}
                {selectedFinancialOrgId && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Client Invoices
                      </h4>
                      {financialInvoices.length > 0 && (
                        <span className="text-xs text-gray-600">
                          {financialInvoices.length} invoice{financialInvoices.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {loadingFinancialInvoices ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">Loading invoices...</span>
                      </div>
                    ) : financialInvoices.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {financialInvoices.map((invoice) => (
                          <div key={invoice.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-semibold text-gray-900">{invoice.invoice_number}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}
                                  </div>
                                  <div>
                                    Period: {new Date(invoice.period_start).toLocaleDateString('en-ZA')} - {new Date(invoice.period_end).toLocaleDateString('en-ZA')}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 justify-end mb-1">
                                  <span className="text-sm font-bold text-gray-900">
                                    R {invoice.total_amount.toFixed(2)}
                                  </span>
                                </div>
                                <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                                  invoice.payment_status === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : invoice.payment_status === 'overdue'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-3 pt-2 border-t border-gray-200">
                              <div className="text-xs">
                                <span className="text-gray-500">Subtotal:</span>
                                <div className="font-medium text-gray-900">R {invoice.subtotal.toFixed(2)}</div>
                              </div>
                              <div className="text-xs">
                                <span className="text-gray-500">VAT:</span>
                                <div className="font-medium text-gray-900">R {invoice.vat_amount.toFixed(2)}</div>
                              </div>
                              <div className="text-xs">
                                <span className="text-gray-500">Due Date:</span>
                                <div className="font-medium text-gray-900">{new Date(invoice.payment_due_date).toLocaleDateString('en-ZA')}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                              <button
                                onClick={(e) => handleDownloadInvoice(invoice, e)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </button>
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEmailInvoice(invoice); }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Email
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No invoices found for this client</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : financialSubView === 'statements' ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Create Statements</h3>
                  </div>
                  <button
                    onClick={() => {
                      setFinancialSubView('menu');
                      setViewingStatementsOrgId(null);
                      setViewingStatementsOrgName('');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Back
                  </button>
                </div>

                {/* Client Selection for Statements */}
                {!viewingStatementsOrgId ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Select Client to Create/View Statements
                    </label>
                    <select
                      onChange={(e) => {
                        const orgId = e.target.value;
                        if (orgId) {
                          const org = organizations.find(o => o.id === orgId);
                          if (org) {
                            setViewingStatementsOrgId(orgId);
                            setViewingStatementsOrgName(org.name);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">-- Select a local account client --</option>
                      {activeAccounts.map((account) => {
                        const org = organizations.find(o => o.id === account.organization_id);
                        if (!org) return null;
                        return (
                          <option key={account.id} value={org.id}>
                            {org.name} {account.account_number ? `(Acc: ${account.account_number})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <GarageStatementsPayments
                    garageId={garageId}
                    garageName={garageName}
                    organizationId={viewingStatementsOrgId}
                    organizationName={viewingStatementsOrgName}
                    initialTab="statements"
                    directPaymentMode={false}
                    onBack={() => {
                      setViewingStatementsOrgId(null);
                      setViewingStatementsOrgName('');
                    }}
                  />
                )}
              </div>
            ) : financialSubView === 'payments' ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Payments</h3>
                  </div>
                  <button
                    onClick={() => {
                      setFinancialSubView('menu');
                      setCapturingPaymentOrgId(null);
                      setCapturingPaymentOrgName('');
                      setPaymentDate(new Date().toISOString().split('T')[0]);
                      setPaymentAmount('');
                      setPaymentMethod('eft');
                      setPaymentReference('');
                      setPaymentNotes('');
                      setPaymentsMode('capture');
                      setSearchPayments([]);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Back
                  </button>
                </div>

                {/* Mode toggle tabs */}
                <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
                  <button
                    onClick={() => setPaymentsMode('capture')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      paymentsMode === 'capture'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Capture Payment
                  </button>
                  <button
                    onClick={async () => {
                      setPaymentsMode('search');
                      setSearchLoading(true);
                      try {
                        const from = searchFilterFrom;
                        const to = searchFilterTo;
                        let query = supabase
                          .from('garage_debtor_payments')
                          .select('*')
                          .eq('garage_id', garageId)
                          .gte('payment_date', from)
                          .lte('payment_date', to)
                          .order('payment_date', { ascending: false });
                        if (searchFilterOrg) query = query.eq('organization_id', searchFilterOrg);
                        if (searchFilterMethod) query = query.eq('payment_method', searchFilterMethod);
                        const { data, error: qErr } = await query;
                        if (qErr) throw qErr;
                        setSearchPayments(data || []);
                      } catch (err: any) {
                        setError(err.message);
                      } finally {
                        setSearchLoading(false);
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      paymentsMode === 'search'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                    Search Payments
                  </button>
                </div>

                {/* Capture Payment mode */}
                {paymentsMode === 'capture' && (
                  !capturingPaymentOrgId ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Select Client to Capture Payment
                      </label>
                      <select
                        onChange={(e) => {
                          const orgId = e.target.value;
                          if (orgId) {
                            const org = organizations.find(o => o.id === orgId);
                            if (org) {
                              setCapturingPaymentOrgId(orgId);
                              setCapturingPaymentOrgName(org.name);
                            }
                          }
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">-- Select a local account client --</option>
                        {activeAccounts.map((account) => {
                          const org = organizations.find(o => o.id === account.organization_id);
                          if (!org) return null;
                          return (
                            <option key={account.id} value={org.id}>
                              {org.name} {account.account_number ? `(Acc: ${account.account_number})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-semibold mb-4">Record Payment for {capturingPaymentOrgName}</h4>
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
                            min="0"
                            placeholder="0.00"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Payment Method</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'eft' | 'card' | 'other')}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          >
                            <option value="eft">EFT</option>
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Reference</label>
                          <input
                            type="text"
                            placeholder="Payment reference (optional)"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <textarea
                          placeholder="Additional notes (optional)"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
                              setError('Please enter a valid payment amount');
                              return;
                            }
                            try {
                              setSavingPayment(true);
                              setError('');
                              const { data: paymentNumber, error: numberError } = await supabase.rpc('generate_payment_number', {
                                p_garage_id: garageId,
                                p_organization_id: capturingPaymentOrgId
                              });
                              if (numberError) throw numberError;
                              const { error: insertError } = await supabase
                                .from('garage_debtor_payments')
                                .insert({
                                  garage_id: garageId,
                                  organization_id: capturingPaymentOrgId,
                                  payment_number: paymentNumber,
                                  payment_date: paymentDate,
                                  amount: parseFloat(paymentAmount),
                                  payment_method: paymentMethod,
                                  reference: paymentReference || null,
                                  notes: paymentNotes || null
                                });
                              if (insertError) throw insertError;
                              setSuccessMessage(`Payment ${paymentNumber} recorded successfully!`);
                              setTimeout(() => setSuccessMessage(''), 3000);
                              setCapturingPaymentOrgId(null);
                              setCapturingPaymentOrgName('');
                              setPaymentDate(new Date().toISOString().split('T')[0]);
                              setPaymentAmount('');
                              setPaymentMethod('eft');
                              setPaymentReference('');
                              setPaymentNotes('');
                            } catch (err: any) {
                              setError(err.message || 'Failed to record payment');
                            } finally {
                              setSavingPayment(false);
                            }
                          }}
                          disabled={savingPayment}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {savingPayment ? 'Recording...' : 'Record Payment'}
                        </button>
                        <button
                          onClick={() => {
                            setCapturingPaymentOrgId(null);
                            setCapturingPaymentOrgName('');
                            setPaymentDate(new Date().toISOString().split('T')[0]);
                            setPaymentAmount('');
                            setPaymentMethod('eft');
                            setPaymentReference('');
                            setPaymentNotes('');
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )
                )}

                {/* Search Payments mode */}
                {paymentsMode === 'search' && (
                  <div>
                    {/* Filter controls */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                          <select
                            value={searchFilterOrg}
                            onChange={(e) => setSearchFilterOrg(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                          >
                            <option value="">All clients</option>
                            {activeAccounts.map((account) => {
                              const org = organizations.find(o => o.id === account.organization_id);
                              if (!org) return null;
                              return (
                                <option key={account.id} value={org.id}>{org.name}</option>
                              );
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                          <input
                            type="date"
                            value={searchFilterFrom}
                            onChange={(e) => setSearchFilterFrom(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                          <input
                            type="date"
                            value={searchFilterTo}
                            onChange={(e) => setSearchFilterTo(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
                          <select
                            value={searchFilterMethod}
                            onChange={(e) => setSearchFilterMethod(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                          >
                            <option value="">All methods</option>
                            <option value="eft">EFT</option>
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={async () => {
                            setSearchLoading(true);
                            try {
                              let query = supabase
                                .from('garage_debtor_payments')
                                .select('*')
                                .eq('garage_id', garageId)
                                .gte('payment_date', searchFilterFrom)
                                .lte('payment_date', searchFilterTo)
                                .order('payment_date', { ascending: false });
                              if (searchFilterOrg) query = query.eq('organization_id', searchFilterOrg);
                              if (searchFilterMethod) query = query.eq('payment_method', searchFilterMethod);
                              const { data, error: qErr } = await query;
                              if (qErr) throw qErr;
                              setSearchPayments(data || []);
                            } catch (err: any) {
                              setError(err.message);
                            } finally {
                              setSearchLoading(false);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          <Search className="w-4 h-4" />
                          Search
                        </button>
                        {searchPayments.length > 0 && (
                          <span className="text-sm text-gray-500">
                            {searchPayments.length} result{searchPayments.length !== 1 ? 's' : ''}
                            <span className="ml-2 font-semibold text-green-700">
                              = R {searchPayments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Results table */}
                    {searchLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment #</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {searchPayments.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                                  No payments found — adjust the filters and click Search
                                </td>
                              </tr>
                            ) : (
                              searchPayments.map((p) => {
                                const org = organizations.find(o => o.id === p.organization_id);
                                return (
                                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.payment_number}</td>
                                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                      {new Date(p.payment_date).toLocaleDateString('en-ZA')}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{org?.name || '—'}</td>
                                    <td className="px-4 py-3">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 uppercase">
                                        {p.payment_method}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{p.reference || <span className="text-gray-300">—</span>}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-green-600 whitespace-nowrap">
                                      R {Number(p.amount).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{p.notes || <span className="text-gray-300">—</span>}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          {searchPayments.length > 0 && (
                            <tfoot>
                              <tr className="bg-gray-50 border-t-2 border-gray-200">
                                <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-700 text-right">Total</td>
                                <td className="px-4 py-3 text-right font-bold text-green-600 whitespace-nowrap">
                                  R {searchPayments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)}
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
            ) : financialSubView === 'fee-invoices' ? (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Fee Invoices</h3>
                  </div>
                  <button
                    onClick={() => {
                      setFeeInvoiceError('');
                      setFeeInvoiceSuccess('');
                      if (initialView === 'fee-invoices') {
                        onBack?.();
                      } else {
                        setFinancialSubView('menu');
                      }
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Back
                  </button>
                </div>

                {/* Generate new invoice */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-orange-900 mb-3">Generate Fee Invoice</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                      <select
                        value={feeInvoiceOrgId}
                        onChange={e => setFeeInvoiceOrgId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="">-- Select client --</option>
                        {organizations.filter(o => o.is_garage_managed && o.managing_garage_id === garageId).map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Billing Period</label>
                      <select
                        value={feeInvoicePeriod}
                        onChange={e => setFeeInvoicePeriod(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="">-- Select period --</option>
                        {Array.from({ length: 13 }, (_, i) => {
                          const d = new Date();
                          d.setMonth(d.getMonth() - i + 1);
                          const y = d.getFullYear();
                          const m = d.getMonth();
                          const val = `${y}-${String(m + 1).padStart(2, '0')}`;
                          const label = new Date(y, m, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
                          return <option key={val} value={val}>{label}</option>;
                        })}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={generateFeeInvoice}
                        disabled={!feeInvoiceOrgId || !feeInvoicePeriod || generatingFeeInvoice}
                        className="w-full bg-orange-600 text-white px-4 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
                      >
                        {generatingFeeInvoice ? (
                          <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Generating...</>
                        ) : (
                          <><Plus className="w-4 h-4" />Generate Invoice</>
                        )}
                      </button>
                    </div>
                  </div>
                  {feeInvoiceError && (
                    <div className="mt-3 flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {feeInvoiceError}
                    </div>
                  )}
                  {feeInvoiceSuccess && (
                    <div className="mt-3 flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {feeInvoiceSuccess}
                    </div>
                  )}
                </div>

                {/* Filter + list */}
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-xs font-medium text-gray-700">Status:</label>
                  {(['all', 'issued', 'paid', 'partially_paid', 'overdue'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFeeInvoiceStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${feeInvoiceStatusFilter === s ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {s === 'all' ? 'All' : s === 'partially_paid' ? 'Partial' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                {loadingFeeInvoices ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {feeInvoices
                          .filter(inv => feeInvoiceStatusFilter === 'all' || inv.status === feeInvoiceStatusFilter)
                          .length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                              No fee invoices found
                            </td>
                          </tr>
                        ) : feeInvoices
                            .filter(inv => feeInvoiceStatusFilter === 'all' || inv.status === feeInvoiceStatusFilter)
                            .map(inv => {
                              const statusColors: Record<string, string> = {
                                issued: 'bg-blue-50 text-blue-700',
                                paid: 'bg-green-50 text-green-700',
                                partially_paid: 'bg-yellow-50 text-yellow-700',
                                overdue: 'bg-red-50 text-red-700',
                                cancelled: 'bg-gray-100 text-gray-500',
                              };
                              const color = statusColors[inv.status] || 'bg-gray-100 text-gray-600';
                              const periodLabel = `${new Date(inv.billing_period_start).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}`;
                              return (
                                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{inv.invoice_number}</td>
                                  <td className="px-4 py-3 text-gray-700">{(inv.organization as any)?.name || '—'}</td>
                                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{periodLabel}</td>
                                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                    {new Date(inv.payment_due_date).toLocaleDateString('en-ZA')}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
                                      {inv.status === 'partially_paid' ? 'Partial' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                                    R {Number(inv.total_amount).toFixed(2)}
                                  </td>
                                  <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${Number(inv.amount_outstanding) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    R {Number(inv.amount_outstanding).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                      </tbody>
                      {feeInvoices.filter(inv => feeInvoiceStatusFilter === 'all' || inv.status === feeInvoiceStatusFilter).length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-50 border-t-2 border-gray-200">
                            <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-700 text-right">Totals</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                              R {feeInvoices.filter(inv => feeInvoiceStatusFilter === 'all' || inv.status === feeInvoiceStatusFilter).reduce((s, i) => s + Number(i.total_amount), 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-red-600 whitespace-nowrap">
                              R {feeInvoices.filter(inv => feeInvoiceStatusFilter === 'all' || inv.status === feeInvoiceStatusFilter).reduce((s, i) => s + Number(i.amount_outstanding), 0).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          )}
        </div>

        {initialView === 'all' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-blue-900 text-sm font-medium">About Local Accounts:</p>
          <ul className="text-blue-800 text-sm mt-2 space-y-1 list-disc list-inside">
            <li>Add organizations that have accounts at your garage</li>
            <li>Account numbers are used by drivers during refueling</li>
            <li>Only drivers from active accounts can refuel at your garage</li>
            <li>Toggle accounts on/off as needed without deleting the relationship</li>
          </ul>
        </div>
        )}
      </div>
    </>
  );
}
