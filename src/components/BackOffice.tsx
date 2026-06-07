import { useState, useEffect } from 'react';
import { Building2, Users, DollarSign, CreditCard, TrendingUp, Fuel, FileText, Store, Settings, Lock, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import OrganizationManagement from './OrganizationManagement';
import UserManagement from './UserManagement';
import ManagementFinancialInfo from './ManagementFinancialInfo';
import FeeStructureView from './FeeStructureView';
import FuelPriceUpdate from './FuelPriceUpdate';
import InvoiceManagement from './InvoiceManagement';
import ClientGarageAccounts from './ClientGarageAccounts';
import { OrganizationPaymentCard } from './OrganizationPaymentCard';
import ClientStandardSettings from './ClientStandardSettings';
import PriceZoneImport from './PriceZoneImport';

interface BackOfficeProps {
  userRole?: string;
  paymentOption?: string | null;
  onNavigateToMain?: () => void;
  onNavigate?: (view: string) => void;
}

interface MgmtPermissions {
  isMainUser: boolean;
  isSecondaryMainUser: boolean;
  can_access_back_office: boolean;
  can_view_org_info: boolean;
  can_edit_org_info: boolean;
  can_view_client_settings: boolean;
  can_edit_client_settings: boolean;
  can_view_invoice_management: boolean;
  can_edit_invoice_management: boolean;
  can_view_fuel_price_update: boolean;
  can_edit_fuel_price_update: boolean;
  can_manage_users: boolean;
  can_view_financial_data: boolean;
}

type BackOfficeView = 'menu' | 'management-org-menu' | 'org-info' | 'user-info' | 'financial-info' | 'fee-structure' | 'fuel-price-update' | 'invoice-management' | 'local-accounts' | 'payment-card' | 'client-standard-settings' | 'price-zone-import';

export default function BackOffice({ userRole, paymentOption, onNavigateToMain, onNavigate }: BackOfficeProps) {
  const [currentView, setCurrentView] = useState<BackOfficeView>('menu');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');
  const [mgmtPerms, setMgmtPerms] = useState<MgmtPermissions | null>(null);
  const [loadingPerms, setLoadingPerms] = useState(true);

  useEffect(() => {
    loadOrganizationInfo();
  }, []);

  const loadOrganizationInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id);

        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profile.organization_id)
          .maybeSingle();

        if (org?.name) setOrganizationName(org.name);
      }

      // Super admin always has full access
      if (profile?.role === 'super_admin') {
        setMgmtPerms({
          isMainUser: true,
          isSecondaryMainUser: false,
          can_access_back_office: true,
          can_view_org_info: true,
          can_edit_org_info: true,
          can_view_client_settings: true,
          can_edit_client_settings: true,
          can_view_invoice_management: true,
          can_edit_invoice_management: true,
          can_view_fuel_price_update: true,
          can_edit_fuel_price_update: true,
          can_manage_users: true,
          can_view_financial_data: true,
        });
        setLoadingPerms(false);
        return;
      }

      // For management org users, load their specific permissions
      if (userRole === 'super_admin' || profile?.role === 'super_admin') {
        setMgmtPerms({
          isMainUser: true,
          isSecondaryMainUser: false,
          can_access_back_office: true,
          can_view_org_info: true,
          can_edit_org_info: true,
          can_view_client_settings: true,
          can_edit_client_settings: true,
          can_view_invoice_management: true,
          can_edit_invoice_management: true,
          can_view_fuel_price_update: true,
          can_edit_fuel_price_update: true,
          can_manage_users: true,
          can_view_financial_data: true,
        });
        setLoadingPerms(false);
        return;
      }

      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('is_main_user, is_secondary_main_user, can_access_back_office, can_view_org_info, can_edit_org_info, can_view_client_settings, can_edit_client_settings, can_view_invoice_management, can_edit_invoice_management, can_view_fuel_price_update, can_edit_fuel_price_update, can_manage_users, can_view_financial_data')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (orgUser) {
        const isMainOrSecondary = orgUser.is_main_user || orgUser.is_secondary_main_user;
        setMgmtPerms({
          isMainUser: orgUser.is_main_user,
          isSecondaryMainUser: orgUser.is_secondary_main_user,
          can_access_back_office: isMainOrSecondary || orgUser.can_access_back_office,
          can_view_org_info: isMainOrSecondary || orgUser.can_view_org_info,
          can_edit_org_info: isMainOrSecondary || orgUser.can_edit_org_info,
          can_view_client_settings: isMainOrSecondary || orgUser.can_view_client_settings,
          can_edit_client_settings: isMainOrSecondary || orgUser.can_edit_client_settings,
          can_view_invoice_management: isMainOrSecondary || orgUser.can_view_invoice_management,
          can_edit_invoice_management: isMainOrSecondary || orgUser.can_edit_invoice_management,
          can_view_fuel_price_update: isMainOrSecondary || orgUser.can_view_fuel_price_update,
          can_edit_fuel_price_update: isMainOrSecondary || orgUser.can_edit_fuel_price_update,
          can_manage_users: isMainOrSecondary || orgUser.can_manage_users,
          can_view_financial_data: isMainOrSecondary || orgUser.can_view_financial_data,
        });
      } else {
        setMgmtPerms({
          isMainUser: false,
          isSecondaryMainUser: false,
          can_access_back_office: false,
          can_view_org_info: false,
          can_edit_org_info: false,
          can_view_client_settings: false,
          can_edit_client_settings: false,
          can_view_invoice_management: false,
          can_edit_invoice_management: false,
          can_view_fuel_price_update: false,
          can_edit_fuel_price_update: false,
          can_manage_users: false,
          can_view_financial_data: false,
        });
      }
    } catch (err) {
      console.error('Error loading organization info:', err);
    } finally {
      setLoadingPerms(false);
    }
  };

  if (loadingPerms) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // For management org users: block access unless main/secondary or explicitly granted
  if (userRole === 'super_admin' && mgmtPerms && !mgmtPerms.isMainUser && !mgmtPerms.isSecondaryMainUser && !mgmtPerms.can_access_back_office) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Lock className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Access Restricted</h3>
            <p className="text-amber-800 text-sm">
              You do not have permission to access the Back Office. Please contact the Main User to request access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'management-org-menu') {
    const managementOrgMenuItems = [
      ...(mgmtPerms?.can_view_org_info ? [{
        id: 'org-info',
        title: 'Management Organization Info',
        description: 'Manage management organization details',
        icon: Building2,
        color: 'blue',
      }] : []),
      {
        id: 'user-info',
        title: 'Management User Info',
        description: 'Manage management users and permissions',
        icon: Users,
        color: 'green',
      },
      {
        id: 'financial-info',
        title: 'Management Financial Info',
        description: 'Manage banking and financial details',
        icon: DollarSign,
        color: 'emerald',
      },
      ...(!mgmtPerms?.isMainUser && !mgmtPerms?.isSecondaryMainUser ? [{
        id: 'fee-structure',
        title: 'Fee Structure, Spending Limits and Payment Terms (View only)',
        description: 'View monthly fees, spending limits and payment terms',
        icon: TrendingUp,
        color: 'orange',
      }] : []),
    ];

    const getColorClasses = (color: string) => {
      const colors: Record<string, { bg: string; hover: string; icon: string }> = {
        blue: { bg: 'bg-blue-50', hover: 'hover:bg-blue-100 hover:border-blue-300', icon: 'text-blue-600' },
        green: { bg: 'bg-green-50', hover: 'hover:bg-green-100 hover:border-green-300', icon: 'text-green-600' },
        emerald: { bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100 hover:border-emerald-300', icon: 'text-emerald-600' },
        orange: { bg: 'bg-orange-50', hover: 'hover:bg-orange-100 hover:border-orange-300', icon: 'text-orange-600' },
      };
      return colors[color] || colors.blue;
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Management Organization Info</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('menu')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 px-2 py-1"
            >
              ← Back to Back Office
            </button>
            {onNavigateToMain && (
              <button
                onClick={onNavigateToMain}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 px-2 py-1"
              >
                ← Back to Main Menu
              </button>
            )}
          </div>
        </div>

        <p className="text-gray-600 text-sm">Select an option to manage management organization data</p>

        <div className="space-y-2">
          {managementOrgMenuItems.map((item) => {
            const Icon = item.icon;
            const colors = getColorClasses(item.color);
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as BackOfficeView)}
                className={`w-full ${colors.bg} ${colors.hover} border border-gray-200 rounded-lg p-2 text-left transition-all duration-200 hover:shadow-md flex items-center gap-3`}
              >
                <div className={`${colors.icon} flex-shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (currentView === 'price-zone-import') {
    return <PriceZoneImport onBack={() => setCurrentView('menu')} />;
  }

  if (currentView === 'org-info') {
    return <OrganizationManagement onBack={() => setCurrentView('management-org-menu')} />;
  }

  if (currentView === 'user-info') {
    return <UserManagement managementMode={true} onNavigate={setCurrentView} />;
  }

  if (currentView === 'financial-info') {
    return <ManagementFinancialInfo onNavigate={setCurrentView} />;
  }

  if (currentView === 'fee-structure') {
    return <FeeStructureView onNavigate={setCurrentView} />;
  }

  if (currentView === 'fuel-price-update') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setCurrentView('menu')}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          ← Back to Back Office
        </button>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Fuel Price Update</h2>
          <p className="text-gray-600 text-sm mb-6">Update fuel prices for all garages based on their price zones</p>
          <FuelPriceUpdate />
        </div>
      </div>
    );
  }

  if (currentView === 'client-standard-settings') {
    return <ClientStandardSettings onBack={() => setCurrentView('menu')} />;
  }

  if (currentView === 'invoice-management') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setCurrentView('menu')}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          ← Back to Back Office
        </button>
        <InvoiceManagement />
      </div>
    );
  }

  if (currentView === 'local-accounts') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setCurrentView('menu')}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          ← Back to Back Office
        </button>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Local Garage Accounts</h2>
          <p className="text-gray-600 text-sm mb-6">Manage your local accounts with garages where you can refuel</p>
          {organizationId && organizationName && (
            <ClientGarageAccounts organizationId={organizationId} organizationName={organizationName} />
          )}
        </div>
      </div>
    );
  }

  if (currentView === 'payment-card') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setCurrentView('menu')}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          ← Back to Back Office
        </button>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Payment Card Management</h2>
          <p className="text-gray-600 text-sm mb-6">Configure your credit/debit card for fuel payments. Your card is securely encrypted and drivers use their PIN + NFC to authorize payments.</p>
          <OrganizationPaymentCard />
        </div>
      </div>
    );
  }

  // Build main menu based on user type and permissions
  const isMgmtOrg = userRole === 'super_admin';
  const isFullAccess = mgmtPerms?.isMainUser || mgmtPerms?.isSecondaryMainUser;

  const menuItems = [
    // Management org entry point
    ...(isMgmtOrg ? [{
      id: 'management-org-menu',
      title: 'Management Organization Info',
      description: 'Manage organization details, users, and financial information',
      icon: Building2,
      color: 'blue',
    }] : []),
    // Client org items — shown for non-management users based on permissions
    ...(!isMgmtOrg && (isFullAccess || mgmtPerms?.can_view_org_info || mgmtPerms?.can_edit_org_info) ? [{
      id: 'client-org-info',
      title: 'Organization Details',
      description: 'View and update your organization information',
      icon: Building2,
      color: 'blue',
    }] : []),
    ...(!isMgmtOrg && (isFullAccess || mgmtPerms?.can_manage_users) ? [{
      id: 'client-user-info',
      title: 'User Management',
      description: 'Manage users and their access permissions',
      icon: Users,
      color: 'green',
    }] : []),
    ...(!isMgmtOrg && (isFullAccess || mgmtPerms?.can_view_financial_data) ? [{
      id: 'client-financial-info',
      title: 'Financial Information',
      description: 'View your payment settings and financial information',
      icon: DollarSign,
      color: 'emerald',
    }] : []),
    // Client org payment options
    ...(!isMgmtOrg && (paymentOption === 'Card Payment' || paymentOption === 'Both') ? [{
      id: 'payment-card',
      title: 'Payment Card Management',
      description: 'Configure your credit/debit card for fuel payments',
      icon: CreditCard,
      color: 'teal',
    }] : []),
    ...(!isMgmtOrg && (paymentOption === 'Local Account' || paymentOption === 'Both') ? [{
      id: 'local-accounts',
      title: 'Local Garage Accounts',
      description: 'Manage local accounts with garages where you can refuel',
      icon: Store,
      color: 'amber',
    }] : []),
    // Management org Back Office items - gated by permissions
    ...(isMgmtOrg && (isFullAccess || mgmtPerms?.can_view_client_settings) ? [{
      id: 'client-standard-settings',
      title: 'Client Standard Financial Settings',
      description: 'Set default payment method, terms, dates and fees applied to all clients',
      icon: Settings,
      color: 'slate',
    }] : []),
    ...(isMgmtOrg && (isFullAccess || mgmtPerms?.can_view_invoice_management) ? [{
      id: 'invoice-management',
      title: 'Invoice Management',
      description: 'Generate and manage client invoices',
      icon: FileText,
      color: 'teal',
    }] : []),
    ...(isMgmtOrg && (isFullAccess || mgmtPerms?.can_view_fuel_price_update) ? [{
      id: 'fuel-price-update',
      title: 'Fuel Price Update',
      description: 'Update fuel prices for all garages by zone',
      icon: Fuel,
      color: 'amber',
    }] : []),
    ...(isMgmtOrg ? [{
      id: 'price-zone-import',
      title: 'Price Zone Data Import',
      description: 'Import official DMRE fuel price zone data by magisterial district',
      icon: MapPin,
      color: 'cyan',
    }] : []),
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; hover: string; icon: string }> = {
      blue: { bg: 'bg-blue-50', hover: 'hover:bg-blue-100 hover:border-blue-300', icon: 'text-blue-600' },
      green: { bg: 'bg-green-50', hover: 'hover:bg-green-100 hover:border-green-300', icon: 'text-green-600' },
      emerald: { bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100 hover:border-emerald-300', icon: 'text-emerald-600' },
      teal: { bg: 'bg-teal-50', hover: 'hover:bg-teal-100 hover:border-teal-300', icon: 'text-teal-600' },
      amber: { bg: 'bg-amber-50', hover: 'hover:bg-amber-100 hover:border-amber-300', icon: 'text-amber-600' },
      slate: { bg: 'bg-slate-50', hover: 'hover:bg-slate-100 hover:border-slate-300', icon: 'text-slate-600' },
      cyan: { bg: 'bg-cyan-50', hover: 'hover:bg-cyan-100 hover:border-cyan-300', icon: 'text-cyan-600' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Back Office</h2>
        {onNavigateToMain && (
          <button
            onClick={onNavigateToMain}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 px-2 py-1"
          >
            ← Back to Main Menu
          </button>
        )}
      </div>
      <p className="text-gray-600 text-sm">Select an option to manage the system</p>

      {menuItems.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Lock className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">No Access Granted</h3>
              <p className="text-amber-800 text-sm">
                You do not have permission to access any Back Office features. Please contact the Main User to request access.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const colors = getColorClasses(item.color);
            return (
              <button
                key={item.id}
                onClick={() => {
                  const clientNavItems = ['client-org-info', 'client-user-info', 'client-financial-info'];
                  if (clientNavItems.includes(item.id) && onNavigate) {
                    onNavigate(item.id);
                  } else {
                    setCurrentView(item.id as BackOfficeView);
                  }
                }}
                className={`w-full ${colors.bg} ${colors.hover} border border-gray-200 rounded-lg p-2 text-left transition-all duration-200 hover:shadow-md flex items-center gap-3`}
              >
                <div className={`${colors.icon} flex-shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-gray-600 text-xs mt-0.5">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
