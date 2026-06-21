import { useState, useEffect } from 'react';
import { Users, Plus, CreditCard as Edit2, Trash2, Search, AlertCircle, CheckCircle, X, Scan, RotateCcw, ArrowLeft, TrendingUp, Calendar, Lock, Unlock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LicenseScanner, { ParsedLicenseData } from './LicenseScanner';

interface Driver {
  id: string;
  organization_id: string;
  user_id: string | null;
  first_name: string;
  surname: string;
  id_number: string;
  date_of_birth: string;
  phone_number: string;
  email: string | null;
  address_line_1: string | null;
  address_line_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  license_number: string;
  license_type: string;
  license_issue_date: string;
  license_expiry_date: string;
  license_restrictions: string | null;
  has_prdp: boolean;
  prdp_type: string | null;
  prdp_expiry_date: string | null;
  medical_certificate_on_file: boolean;
  status: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  organizations?: {
    name: string;
  };
}

interface DriverFormData {
  first_name: string;
  surname: string;
  id_number: string;
  date_of_birth: string;
  phone_number: string;
  email: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  postal_code: string;
  license_number: string;
  license_type: string;
  license_issue_date: string;
  license_expiry_date: string;
  license_restrictions: string;
  driver_restriction: string;
  vehicle_restriction: string;
  prpd_restriction: string;
  has_prdp: boolean;
  prdp_type: string;
  prdp_expiry_date: string;
  medical_certificate_on_file: boolean;
  status: string;
  organization_id?: string;
}

interface Organization {
  id: string;
  name: string;
}

interface PaymentSettings {
  id: string;
  driver_id: string;
  daily_spending_limit: number;
  monthly_spending_limit: number;
  payment_enabled: boolean;
  is_pin_active: boolean;
  failed_pin_attempts: number;
  locked_until: string | null;
  last_payment_at: string | null;
}

interface SpendingData {
  daily_spent: number;
  monthly_spent: number;
  daily_limit: number;
  monthly_limit: number;
}

interface DriverManagementProps {
  onNavigate?: (view: string | null) => void;
}

export default function DriverManagement({ onNavigate }: DriverManagementProps = {}) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [showOrgSelector, setShowOrgSelector] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [canAddDriver, setCanAddDriver] = useState(false);
  const [canEditDriver, setCanEditDriver] = useState(false);
  const [canDeleteDriver, setCanDeleteDriver] = useState(false);
  const [idDobMismatch, setIdDobMismatch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(50);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [spendingData, setSpendingData] = useState<SpendingData | null>(null);
  const [loadingPaymentData, setLoadingPaymentData] = useState(false);
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);

  const [formData, setFormData] = useState<DriverFormData>({
    first_name: '',
    surname: '',
    id_number: '',
    date_of_birth: '',
    phone_number: '',
    email: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    province: '',
    postal_code: '',
    license_number: '',
    license_type: 'Code B',
    license_issue_date: '',
    license_expiry_date: '',
    license_restrictions: '',
    driver_restriction: '',
    vehicle_restriction: '',
    prpd_restriction: '',
    has_prdp: false,
    prdp_type: '',
    prdp_expiry_date: '',
    medical_certificate_on_file: false,
    status: 'active',
    organization_id: '',
  });

  const [paymentFormData, setPaymentFormData] = useState({
    dailyLimit: 5000,
    monthlyLimit: 50000,
    paymentEnabled: true,
    dailyLimitEnabled: true,
    monthlyLimitEnabled: true,
  });

  useEffect(() => {
    loadDrivers(1, searchTerm, selectedOrgId);
    loadOrganizations();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    loadDrivers(1, searchTerm, selectedOrgId);
  }, [selectedOrgId]);

  useEffect(() => {
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }

    const timeout = setTimeout(() => {
      setCurrentPage(1);
      loadDrivers(1, searchTerm, selectedOrgId);
    }, 300);

    setSearchDebounce(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchTerm]);

  const loadOrganizations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);

        const isSuper = profile.role === 'super_admin';

        // Load driver-specific permissions for non-super-admin users
        if (!isSuper) {
          const { data: orgUser } = await supabase
            .from('organization_users')
            .select('is_main_user, is_secondary_main_user, can_add_drivers, can_edit_drivers, can_delete_drivers')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          const full = orgUser?.is_main_user || orgUser?.is_secondary_main_user || false;
          setCanAddDriver(full || orgUser?.can_add_drivers || false);
          setCanEditDriver(full || orgUser?.can_edit_drivers || false);
          setCanDeleteDriver(full || orgUser?.can_delete_drivers || false);
        } else {
          setCanAddDriver(true);
          setCanEditDriver(true);
          setCanDeleteDriver(true);
        }

        // Check if user is in management organization
        const { data: userOrg } = await supabase
          .from('organizations')
          .select('is_management_org, organization_type')
          .eq('id', profile.organization_id)
          .maybeSingle();

        const isManagementUser = userOrg?.is_management_org === true && userOrg?.organization_type === 'management';

        if (isManagementUser) {
          // Management users see ALL client organizations
          const { data } = await supabase
            .from('organizations')
            .select('id, name, is_management_org')
            .eq('organization_type', 'client')
            .order('name');

          if (data) setOrganizations(data);
        } else {
          // Client users only see their own organization
          const { data: ownOrg } = await supabase
            .from('organizations')
            .select('id, name, is_management_org')
            .eq('id', profile.organization_id)
            .maybeSingle();

          const allOrgs = ownOrg ? [ownOrg] : [];
          setOrganizations(allOrgs);

          // Client user only has their own organization, auto-select and hide selector
          if (allOrgs.length === 1) {
            setSelectedOrgId(allOrgs[0].id);
            setShowOrgSelector(false);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load organizations:', err);
    }
  };

  const loadDrivers = async (page: number = currentPage, search: string = searchTerm, orgFilter: string = selectedOrgId) => {
    setLoadingDrivers(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingDrivers(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

      if (profile) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let orgIds = [profile.organization_id];

        if (profile.role === 'super_admin') {
          let query = supabase
            .from('drivers')
            .select('*, organizations(name)', { count: 'exact' })
            .order('surname')
            .range(from, to);

          if (orgFilter !== 'all') {
            query = query.eq('organization_id', orgFilter);
          }

          if (search.trim()) {
            query = query.or(`first_name.ilike.%${search}%,surname.ilike.%${search}%,id_number.ilike.%${search}%,license_number.ilike.%${search}%`);
          }

          const { data, error, count } = await query;

          if (error) throw error;
          setDrivers(data || []);
          setFilteredDrivers(data || []);
          if (count !== null) setTotalCount(count);
        } else {
          // Client users only see drivers from their own organization
          let query = supabase
            .from('drivers')
            .select('*, organizations(name)', { count: 'exact' })
            .in('organization_id', orgIds)
            .order('surname')
            .range(from, to);

          if (orgFilter !== 'all') {
            query = query.eq('organization_id', orgFilter);
          }

          if (search.trim()) {
            query = query.or(`first_name.ilike.%${search}%,surname.ilike.%${search}%,id_number.ilike.%${search}%,license_number.ilike.%${search}%`);
          }

          const { data, error, count } = await query;

          if (error) throw error;
          setDrivers(data || []);
          setFilteredDrivers(data || []);
          if (count !== null) setTotalCount(count);
        }
      }
    } catch (err: any) {
      setError('Failed to load drivers: ' + err.message);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const loadPaymentData = async (driverId: string) => {
    try {
      setLoadingPaymentData(true);

      const [settingsResult, spendingResult] = await Promise.all([
        supabase
          .from('driver_payment_settings')
          .select('*')
          .eq('driver_id', driverId)
          .maybeSingle(),
        supabase
          .rpc('get_driver_current_spending', { p_driver_id: driverId })
          .maybeSingle(),
      ]);

      if (settingsResult.data) {
        setPaymentSettings(settingsResult.data);
        setPaymentFormData({
          dailyLimit: settingsResult.data.daily_spending_limit ? Number(settingsResult.data.daily_spending_limit) : 5000,
          monthlyLimit: settingsResult.data.monthly_spending_limit ? Number(settingsResult.data.monthly_spending_limit) : 50000,
          paymentEnabled: settingsResult.data.payment_enabled,
          dailyLimitEnabled: settingsResult.data.daily_spending_limit !== null,
          monthlyLimitEnabled: settingsResult.data.monthly_spending_limit !== null,
        });
      }

      if (spendingResult.data) {
        setSpendingData(spendingResult.data);
      }
    } catch (err: any) {
      console.error('Failed to load payment data:', err);
    } finally {
      setLoadingPaymentData(false);
    }
  };

  const openModal = (driver?: Driver, orgId?: string) => {
    if (driver) {
      setEditingDriver(driver);
      const restrictions = parseRestrictions(driver.license_restrictions);
      setFormData({
        first_name: driver.first_name,
        surname: driver.surname,
        id_number: driver.id_number,
        date_of_birth: driver.date_of_birth,
        phone_number: driver.phone_number,
        email: driver.email || '',
        address_line_1: driver.address_line_1 || '',
        address_line_2: driver.address_line_2 || '',
        city: driver.city || '',
        province: driver.province || '',
        postal_code: driver.postal_code || '',
        license_number: driver.license_number,
        license_type: driver.license_type,
        license_issue_date: driver.license_issue_date,
        license_expiry_date: driver.license_expiry_date,
        license_restrictions: driver.license_restrictions || '',
        driver_restriction: restrictions.driver_restriction,
        vehicle_restriction: restrictions.vehicle_restriction,
        prpd_restriction: restrictions.prpd_restriction,
        has_prdp: driver.has_prdp,
        prdp_type: driver.prdp_type || '',
        prdp_expiry_date: driver.prdp_expiry_date || '',
        medical_certificate_on_file: driver.medical_certificate_on_file,
        status: driver.status,
      });

      // Load payment data for existing driver
      loadPaymentData(driver.id);
    } else {
      setEditingDriver(null);
      setPaymentSettings(null);
      setSpendingData(null);
      setFormData({
        first_name: '',
        surname: '',
        id_number: '',
        date_of_birth: '',
        phone_number: '',
        email: '',
        address_line_1: '',
        address_line_2: '',
        city: '',
        province: '',
        postal_code: '',
        license_number: '',
        license_type: 'Code B',
        license_issue_date: '',
        license_expiry_date: '',
        license_restrictions: '',
        driver_restriction: '',
        vehicle_restriction: '',
        prpd_restriction: '',
        has_prdp: false,
        prdp_type: '',
        prdp_expiry_date: '',
        medical_certificate_on_file: false,
        status: 'active',
        organization_id: orgId || '',
      });
    }
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleSavePaymentSettings = async () => {
    if (!editingDriver) return;

    try {
      setSavingPaymentSettings(true);
      setError('');

      const { error: updateError } = await supabase
        .from('driver_payment_settings')
        .update({
          daily_spending_limit: paymentFormData.dailyLimitEnabled ? paymentFormData.dailyLimit : null,
          monthly_spending_limit: paymentFormData.monthlyLimitEnabled ? paymentFormData.monthlyLimit : null,
          payment_enabled: paymentFormData.paymentEnabled,
        })
        .eq('driver_id', editingDriver.id);

      if (updateError) throw updateError;

      setSuccess('Payment settings updated successfully!');
      await loadPaymentData(editingDriver.id);
    } catch (err: any) {
      setError(err.message || 'Failed to update payment settings');
    } finally {
      setSavingPaymentSettings(false);
    }
  };

  const handleUnlockAccount = async () => {
    if (!editingDriver) return;

    try {
      setSavingPaymentSettings(true);
      setError('');

      const { error: updateError } = await supabase
        .from('driver_payment_settings')
        .update({
          failed_pin_attempts: 0,
          locked_until: null,
        })
        .eq('driver_id', editingDriver.id);

      if (updateError) throw updateError;

      setSuccess('Driver account unlocked successfully!');
      await loadPaymentData(editingDriver.id);
    } catch (err: any) {
      setError(err.message || 'Failed to unlock account');
    } finally {
      setSavingPaymentSettings(false);
    }
  };

  const handleResetPIN = async () => {
    if (!editingDriver) return;

    if (!confirm('This will completely reset the driver\'s PIN. They will need to set up a new PIN on their next login. Continue?')) {
      return;
    }

    try {
      setSavingPaymentSettings(true);
      setError('');

      const { error: updateError } = await supabase
        .from('driver_payment_settings')
        .update({
          pin_hash: null,
          pin_salt: null,
          is_pin_active: false,
          require_pin_change: false,
          failed_pin_attempts: 0,
          locked_until: null,
        })
        .eq('driver_id', editingDriver.id);

      if (updateError) throw updateError;

      setSuccess('PIN has been reset. Driver must set up a new PIN on next login.');
      await loadPaymentData(editingDriver.id);
    } catch (err: any) {
      setError(err.message || 'Failed to reset PIN');
    } finally {
      setSavingPaymentSettings(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDriver(null);
    setPaymentSettings(null);
    setSpendingData(null);
    setError('');
    setSuccess('');
    setIdDobMismatch('');
  };

  const handleLicenseScan = (data: ParsedLicenseData) => {
    const newIdNumber = data.idNumber || formData.id_number;
    const newDob = data.dateOfBirth || formData.date_of_birth;

    setFormData({
      first_name: data.firstName || formData.first_name,
      surname: data.lastName || formData.surname,
      id_number: newIdNumber,
      date_of_birth: newDob,
      phone_number: formData.phone_number,
      email: formData.email,
      address_line_1: data.address || formData.address_line_1,
      address_line_2: formData.address_line_2,
      city: formData.city,
      province: formData.province,
      postal_code: formData.postal_code,
      license_number: data.licenseNumber || formData.license_number,
      license_type: data.licenseType || formData.license_type,
      license_issue_date: data.licenseIssueDate || formData.license_issue_date,
      license_expiry_date: data.licenseExpiryDate || formData.license_expiry_date,
      license_restrictions: formData.license_restrictions,
      driver_restriction: formData.driver_restriction,
      vehicle_restriction: formData.vehicle_restriction,
      prpd_restriction: formData.prpd_restriction,
      status: formData.status,
      organization_id: formData.organization_id,
    });

    validateIdNumberDob(newIdNumber, newDob);
    setShowScanner(false);
    setSuccess('License scanned successfully! Review and complete remaining fields.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (idDobMismatch) {
      setError('Please correct the date of birth to match the ID number before submitting');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (editingDriver) {
        const restrictionString = buildRestrictionString(
          formData.driver_restriction,
          formData.vehicle_restriction,
          formData.prpd_restriction
        );

        const { error } = await supabase
          .from('drivers')
          .update({
            first_name: formData.first_name,
            surname: formData.surname,
            id_number: formData.id_number,
            date_of_birth: formData.date_of_birth,
            phone_number: formData.phone_number,
            email: formData.email,
            address_line_1: formData.address_line_1,
            address_line_2: formData.address_line_2,
            city: formData.city,
            province: formData.province,
            postal_code: formData.postal_code,
            license_number: formData.license_number,
            license_type: formData.license_type,
            license_issue_date: formData.license_issue_date,
            license_expiry_date: formData.license_expiry_date,
            license_restrictions: restrictionString,
            has_prdp: formData.has_prdp,
            prdp_type: formData.has_prdp ? formData.prdp_type : null,
            prdp_expiry_date: formData.has_prdp ? formData.prdp_expiry_date : null,
            medical_certificate_on_file: formData.medical_certificate_on_file,
            status: formData.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingDriver.id);

        if (error) throw error;
        setSuccess('Driver updated successfully');
      } else {
        const orgId = formData.organization_id || profile?.organization_id;
        if (!orgId) throw new Error('Organization is required');

        const restrictionString = buildRestrictionString(
          formData.driver_restriction,
          formData.vehicle_restriction,
          formData.prpd_restriction
        );

        const { error } = await supabase
          .from('drivers')
          .insert({
            first_name: formData.first_name,
            surname: formData.surname,
            id_number: formData.id_number,
            date_of_birth: formData.date_of_birth,
            phone_number: formData.phone_number,
            email: formData.email,
            address_line_1: formData.address_line_1,
            address_line_2: formData.address_line_2,
            city: formData.city,
            province: formData.province,
            postal_code: formData.postal_code,
            license_number: formData.license_number,
            license_type: formData.license_type,
            license_issue_date: formData.license_issue_date,
            license_expiry_date: formData.license_expiry_date,
            license_restrictions: restrictionString,
            has_prdp: formData.has_prdp,
            prdp_type: formData.has_prdp ? formData.prdp_type : null,
            prdp_expiry_date: formData.has_prdp ? formData.prdp_expiry_date : null,
            medical_certificate_on_file: formData.medical_certificate_on_file,
            status: formData.status,
            organization_id: orgId,
          });

        if (error) throw error;
        setSuccess('Driver added successfully');
      }

      loadDrivers();
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to save driver');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this driver? Note: The driver will remain in the system database for audit and reporting purposes.')) return;

    try {
      const { data, error } = await supabase.rpc('soft_delete_driver', { driver_id: id });
      if (error) throw error;

      if (data && !data.success) {
        setError(data.error || 'Failed to delete driver');
        return;
      }

      setSuccess('Driver deleted successfully');
      loadDrivers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Failed to delete driver: ' + err.message);
    }
  };

  const handleReactivate = async (id: string) => {
    if (!confirm('Are you sure you want to reactivate this driver?')) return;

    try {
      const { data, error } = await supabase.rpc('reactivate_driver', { driver_id: id });
      if (error) throw error;

      if (data && !data.success) {
        setError(data.error || 'Failed to reactivate driver');
        return;
      }

      setSuccess('Driver reactivated successfully');
      loadDrivers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Failed to reactivate driver: ' + err.message);
    }
  };

  const isLicenseExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  const parseRestrictions = (restrictionString: string | null) => {
    const parts = (restrictionString || '').split(',').map(s => s.trim());
    return {
      driver_restriction: parts.find(p => /^[0-2]$/.test(p)) || '',
      vehicle_restriction: parts.find(p => /^[0-4]$/.test(p)) || '',
      prpd_restriction: parts.find(p => /^[PDG]$/i.test(p))?.toUpperCase() || '',
    };
  };

  const buildRestrictionString = (driver: string, vehicle: string, prpd: string) => {
    const parts = [driver, vehicle, prpd].filter(p => p !== '');
    return parts.join(', ');
  };

  const validateIdNumberDob = (idNumber: string, dateOfBirth: string) => {
    if (!idNumber || !dateOfBirth || idNumber.length < 6) {
      setIdDobMismatch('');
      return true;
    }

    const idYear = idNumber.substring(0, 2);
    const idMonth = idNumber.substring(2, 4);
    const idDay = idNumber.substring(4, 6);

    const dob = new Date(dateOfBirth);
    const birthYear = dob.getFullYear();
    const birthMonth = dob.getMonth() + 1;
    const birthDay = dob.getDate();

    const fullYear = parseInt(idYear) <= 23 ? 2000 + parseInt(idYear) : 1900 + parseInt(idYear);

    if (
      fullYear !== birthYear ||
      parseInt(idMonth) !== birthMonth ||
      parseInt(idDay) !== birthDay
    ) {
      setIdDobMismatch(
        `ID number indicates birth date: ${idDay}/${idMonth}/${fullYear}, but entered DOB is: ${birthDay}/${birthMonth}/${birthYear}`
      );
      return false;
    }

    setIdDobMismatch('');
    return true;
  };

  const getProgressColor = (spent: number, limit: number | null): string => {
    if (limit === null) return 'bg-gray-400';
    const percentage = (spent / limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressPercentage = (spent: number, limit: number | null): number => {
    if (limit === null) return 0;
    return Math.min((spent / limit) * 100, 100);
  };

  if (showScanner) {
    return (
      <LicenseScanner
        onScan={handleLicenseScan}
        onCancel={() => setShowScanner(false)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-gray-700" />
          <h1 className="text-xl font-bold text-gray-900">Driver Management</h1>
        </div>
        <div className="flex items-center gap-3">
          {canAddDriver && (
          <button
            onClick={() => openModal(undefined, selectedOrgId !== 'all' ? selectedOrgId : undefined)}
            disabled={selectedOrgId === 'all' || selectedOrgId === 'none'}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            title={selectedOrgId === 'all' || selectedOrgId === 'none' ? 'Please select a specific organization first' : ''}
          >
            <Plus className="w-5 h-5" />
            Add Driver
          </button>
          )}
          {onNavigate && (
            <button
              onClick={() => onNavigate(null)}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-4 py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Main Menu
            </button>
          )}
        </div>
      </div>

      {(error || success) && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
          {error ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span>{error || success}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search drivers by name, ID, license, mobile, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {showOrgSelector && (
            <div>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {userRole === 'super_admin' && <option value="all">All Organizations</option>}
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                {userRole === 'super_admin' && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Organization</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">ID Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mobile Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">License Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">License Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">License Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingDrivers ? (
                <tr>
                  <td colSpan={userRole === 'super_admin' ? 9 : 8} className="px-4 py-12 text-center text-gray-500">
                    Loading drivers...
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={userRole === 'super_admin' ? 9 : 8} className="px-4 py-12 text-center text-gray-500">
                    {searchTerm ? 'No drivers found matching your search' : 'No drivers registered yet'}
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => (
                  <tr key={driver.id} className={`hover:bg-gray-50 ${driver.deleted_at ? 'bg-gray-50 opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className={`font-medium ${driver.deleted_at ? 'text-gray-500' : 'text-gray-900'}`}>
                          {driver.first_name} {driver.surname}
                          {driver.deleted_at && <span className="ml-2 text-xs text-red-600">(Deleted)</span>}
                        </p>
                        {driver.email && <p className="text-xs text-gray-500">{driver.email}</p>}
                      </div>
                    </td>
                    {userRole === 'super_admin' && (
                      <td className="px-4 py-3 text-sm text-gray-700">{driver.organizations?.name || 'N/A'}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-700">{driver.id_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{driver.phone_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{driver.license_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{driver.license_type}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isLicenseExpired(driver.license_expiry_date) ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                        {new Date(driver.license_expiry_date).toLocaleDateString()}
                        {isLicenseExpired(driver.license_expiry_date) && ' (Expired)'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {driver.deleted_at ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Inactive
                        </span>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          driver.status === 'active' ? 'bg-green-100 text-green-800' :
                          driver.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {driver.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {driver.deleted_at ? (
                          <button
                            onClick={() => handleReactivate(driver.id)}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                            title="Reactivate Driver"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reactivate
                          </button>
                        ) : (
                          <>
                            {canEditDriver && (
                            <button
                              onClick={() => openModal(driver)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Edit Driver"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            )}
                            {canDeleteDriver && (
                            <button
                              onClick={() => handleDelete(driver.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalCount > pageSize && (
          <div className="px-6 py-4 flex items-center justify-between border-t">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
              <span className="font-medium">{totalCount}</span> drivers
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  setCurrentPage(newPage);
                  loadDrivers(newPage, searchTerm, selectedOrgId);
                }}
                disabled={currentPage === 1}
                className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {currentPage} of {Math.ceil(totalCount / pageSize)}
              </span>
              <button
                onClick={() => {
                  const newPage = Math.min(Math.ceil(totalCount / pageSize), currentPage + 1);
                  setCurrentPage(newPage);
                  loadDrivers(newPage, searchTerm, selectedOrgId);
                }}
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-lg">
              <h2 className="text-xl font-bold text-gray-900">
                {editingDriver ? 'Edit Driver' : 'Add New Driver'}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="driver-form"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
                >
                  {loading ? 'Saving...' : editingDriver ? 'Update Driver' : 'Add Driver'}
                </button>
              </div>
            </div>

            <form id="driver-form" onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {!editingDriver && formData.organization_id && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Adding driver to:</span> {organizations.find(org => org.id === formData.organization_id)?.name}
                  </p>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">{success}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Personal Information</h3>
                  {!editingDriver && (
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      <Scan className="w-4 h-4" />
                      Scan License
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Surname *</label>
                    <input
                      type="text"
                      required
                      value={formData.surname}
                      onChange={(e) => setFormData({ ...formData, surname: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.id_number}
                      onChange={(e) => {
                        const newIdNumber = e.target.value;
                        setFormData({ ...formData, id_number: newIdNumber });
                        validateIdNumberDob(newIdNumber, formData.date_of_birth);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                    <input
                      type="date"
                      required
                      value={formData.date_of_birth}
                      onChange={(e) => {
                        const newDob = e.target.value;
                        setFormData({ ...formData, date_of_birth: newDob });
                        validateIdNumberDob(formData.id_number, newDob);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {idDobMismatch && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {idDobMismatch}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.address_line_1}
                    onChange={(e) => setFormData({ ...formData, address_line_1: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Address line 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.address_line_2}
                    onChange={(e) => setFormData({ ...formData, address_line_2: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Address line 2 (optional)"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                    <select
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Province</option>
                      <option value="Eastern Cape">Eastern Cape</option>
                      <option value="Free State">Free State</option>
                      <option value="Gauteng">Gauteng</option>
                      <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                      <option value="Limpopo">Limpopo</option>
                      <option value="Mpumalanga">Mpumalanga</option>
                      <option value="Northern Cape">Northern Cape</option>
                      <option value="North West">North West</option>
                      <option value="Western Cape">Western Cape</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Postal code"
                    />
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide pt-4">Driver's License Details</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.license_number}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Type *</label>
                    <select
                      required
                      value={formData.license_type}
                      onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Code A1">Code A1 (Light Motorcycle &lt; 125cc)</option>
                      <option value="Code A">Code A (Motorcycle &gt; 125cc)</option>
                      <option value="Code B">Code B (Light Vehicle + Trailer &lt; 750kg GVM)</option>
                      <option value="Code EB">Code EB (Light Vehicle + Trailer &gt; 750kg GVM)</option>
                      <option value="Code C1">Code C1 (Vehicle &lt; 16000kg GVM + Trailer &lt; 750kg GVM)</option>
                      <option value="Code EC1">Code EC1 (Vehicle &lt; 16000kg GVM + Trailer &gt; 750kg GVM)</option>
                      <option value="Code C">Code C (Vehicle &gt; 16000kg GVM + Trailer &lt; 750kg GVM)</option>
                      <option value="Code EC">Code EC (Any Size Vehicle + Trailer &gt; 750kg GVM)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Issue Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.license_issue_date}
                      onChange={(e) => setFormData({ ...formData, license_issue_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.license_expiry_date}
                      onChange={(e) => setFormData({ ...formData, license_expiry_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">License Restrictions</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Driver Restriction</label>
                      <select
                        value={formData.driver_restriction}
                        onChange={(e) => setFormData({ ...formData, driver_restriction: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">None</option>
                        <option value="0">0 - No restriction</option>
                        <option value="1">1 - Glasses/Contact lenses</option>
                        <option value="2">2 - Artificial limb</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Vehicle Restriction</label>
                      <select
                        value={formData.vehicle_restriction}
                        onChange={(e) => setFormData({ ...formData, vehicle_restriction: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">None</option>
                        <option value="0">0 - No restriction</option>
                        <option value="1">1 - Automatic transmission only</option>
                        <option value="2">2 - Electrically powered</option>
                        <option value="3">3 - Physically disabled</option>
                        <option value="4">4 - Bus &gt; 16000 kg (GVM) permitted</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">PrDP Categories</label>
                      <select
                        value={formData.prpd_restriction}
                        onChange={(e) => setFormData({ ...formData, prpd_restriction: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">None</option>
                        <option value="P">P - Passenger transport</option>
                        <option value="D">D - Dangerous goods</option>
                        <option value="G">G - Goods transport</option>
                      </select>
                    </div>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide pt-4">Professional Driving Permit (PrDP)</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Has PrDP? *</label>
                    <select
                      required
                      value={formData.has_prdp ? 'yes' : 'no'}
                      onChange={(e) => setFormData({ ...formData, has_prdp: e.target.value === 'yes' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>

                  {formData.has_prdp && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PrDP Type *</label>
                        <select
                          required={formData.has_prdp}
                          value={formData.prdp_type}
                          onChange={(e) => setFormData({ ...formData, prdp_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select PrDP Type</option>
                          <option value="PrDP - Passengers">PrDP - Passengers</option>
                          <option value="PrDP - Goods">PrDP - Goods</option>
                          <option value="PrDP - Dangerous Goods">PrDP - Dangerous Goods</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PrDP Expiry Date *</label>
                        <input
                          type="date"
                          required={formData.has_prdp}
                          value={formData.prdp_expiry_date}
                          onChange={(e) => setFormData({ ...formData, prdp_expiry_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medical Certificate on File *</label>
                  <select
                    required
                    value={formData.medical_certificate_on_file ? 'yes' : 'no'}
                    onChange={(e) => setFormData({ ...formData, medical_certificate_on_file: e.target.value === 'yes' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                {editingDriver && paymentSettings && (
                  <>
                    <div className="border-t border-gray-300 my-6"></div>

                    <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-4">Payment Settings & Spending Limits</h3>

                    {loadingPaymentData ? (
                      <div className="py-8 text-center text-gray-500">
                        Loading payment data...
                      </div>
                    ) : (
                      <>
                        {spendingData && (
                          <div className="space-y-4 mb-6">
                            <h4 className="font-medium text-gray-900 flex items-center space-x-2 text-sm">
                              <TrendingUp className="w-4 h-4" />
                              <span>Current Spending</span>
                            </h4>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-2">Daily Spending</p>
                                <p className="text-2xl font-bold mb-2">
                                  R{spendingData.daily_spent.toFixed(2)}
                                </p>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                  <div
                                    className={`h-2 rounded-full transition-all ${getProgressColor(spendingData.daily_spent, spendingData.daily_limit)}`}
                                    style={{ width: `${getProgressPercentage(spendingData.daily_spent, spendingData.daily_limit)}%` }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500">
                                  Limit: {spendingData.daily_limit !== null ? `R${spendingData.daily_limit.toFixed(2)}` : 'Unlimited'}
                                </p>
                              </div>

                              <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-2">Monthly Spending</p>
                                <p className="text-2xl font-bold mb-2">
                                  R{spendingData.monthly_spent.toFixed(2)}
                                </p>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                  <div
                                    className={`h-2 rounded-full transition-all ${getProgressColor(spendingData.monthly_spent, spendingData.monthly_limit)}`}
                                    style={{ width: `${getProgressPercentage(spendingData.monthly_spent, spendingData.monthly_limit)}%` }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500">
                                  Limit: {spendingData.monthly_limit !== null ? `R${spendingData.monthly_limit.toFixed(2)}` : 'Unlimited'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-4 mb-6">
                          <h4 className="font-medium text-gray-900 text-sm">Payment Status</h4>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                              <p className="text-sm text-gray-600 mb-1">PIN Status</p>
                              <p className={`font-medium ${paymentSettings.is_pin_active ? 'text-green-600' : 'text-yellow-600'}`}>
                                {paymentSettings.is_pin_active ? 'Active' : 'Not Set'}
                              </p>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4">
                              <p className="text-sm text-gray-600 mb-1">Account Status</p>
                              <p className={`font-medium ${paymentSettings.locked_until && new Date(paymentSettings.locked_until) > new Date() ? 'text-red-600' : 'text-green-600'}`}>
                                {paymentSettings.locked_until && new Date(paymentSettings.locked_until) > new Date() ? 'Locked' : 'Active'}
                              </p>
                            </div>
                          </div>

                          {paymentSettings.failed_pin_attempts > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <p className="text-sm text-yellow-800">
                                Failed PIN attempts: {paymentSettings.failed_pin_attempts}/3
                              </p>
                            </div>
                          )}

                          {paymentSettings.locked_until && new Date(paymentSettings.locked_until) > new Date() && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <p className="text-sm text-red-800 mb-3">
                                Account is locked until {new Date(paymentSettings.locked_until).toLocaleString()}
                              </p>
                              <button
                                type="button"
                                onClick={handleUnlockAccount}
                                disabled={savingPaymentSettings}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:bg-gray-400 flex items-center space-x-2"
                              >
                                <Unlock className="w-4 h-4" />
                                <span>Unlock Account</span>
                              </button>
                            </div>
                          )}

                          {paymentSettings.last_payment_at && (
                            <div className="bg-gray-50 rounded-lg p-4">
                              <p className="text-sm text-gray-600 mb-1">Last Payment</p>
                              <p className="font-medium flex items-center space-x-2">
                                <Calendar className="w-4 h-4" />
                                <span>{new Date(paymentSettings.last_payment_at).toLocaleString()}</span>
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4 mb-6">
                          <h4 className="font-medium text-gray-900 text-sm">Spending Limits</h4>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Daily Spending Limit (R)
                              </label>
                              <label className="flex items-center space-x-2 text-sm cursor-pointer bg-yellow-100 px-3 py-2 rounded-lg border-2 border-yellow-400">
                                <input
                                  type="checkbox"
                                  checked={!paymentFormData.dailyLimitEnabled}
                                  onChange={(e) => setPaymentFormData({ ...paymentFormData, dailyLimitEnabled: !e.target.checked })}
                                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-gray-900 font-semibold">No Limit (Unlimited)</span>
                              </label>
                            </div>
                            <input
                              type="number"
                              value={paymentFormData.dailyLimit}
                              onChange={(e) => setPaymentFormData({ ...paymentFormData, dailyLimit: Number(e.target.value) })}
                              disabled={!paymentFormData.dailyLimitEnabled}
                              min="0"
                              step="100"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {paymentFormData.dailyLimitEnabled ? 'Maximum amount driver can spend per day' : 'No daily spending limit applied'}
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Monthly Spending Limit (R)
                              </label>
                              <label className="flex items-center space-x-2 text-sm cursor-pointer bg-yellow-100 px-3 py-2 rounded-lg border-2 border-yellow-400">
                                <input
                                  type="checkbox"
                                  checked={!paymentFormData.monthlyLimitEnabled}
                                  onChange={(e) => setPaymentFormData({ ...paymentFormData, monthlyLimitEnabled: !e.target.checked })}
                                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-gray-900 font-semibold">No Limit (Unlimited)</span>
                              </label>
                            </div>
                            <input
                              type="number"
                              value={paymentFormData.monthlyLimit}
                              onChange={(e) => setPaymentFormData({ ...paymentFormData, monthlyLimit: Number(e.target.value) })}
                              disabled={!paymentFormData.monthlyLimitEnabled}
                              min="0"
                              step="1000"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {paymentFormData.monthlyLimitEnabled ? 'Maximum amount driver can spend per month' : 'No monthly spending limit applied'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">Enable NFC Payments</p>
                              <p className="text-sm text-gray-500">Allow driver to make instant NFC payments</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={paymentFormData.paymentEnabled}
                                onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentEnabled: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={handleSavePaymentSettings}
                            disabled={savingPaymentSettings}
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                          >
                            {savingPaymentSettings ? 'Saving...' : 'Update & Save Payment Settings by Selecting this Button'}
                          </button>
                        </div>

                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-900 flex items-center space-x-2 text-sm">
                            <Lock className="w-4 h-4" />
                            <span>Security Actions</span>
                          </h4>

                          <button
                            type="button"
                            onClick={handleResetPIN}
                            disabled={savingPaymentSettings}
                            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 text-sm font-medium"
                          >
                            Reset PIN (Forgotten PIN)
                          </button>
                          <p className="text-xs text-gray-500 px-1">
                            Completely resets the driver's PIN. Use this when a driver has forgotten their PIN. They will be required to set up a new PIN on their next login.
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
