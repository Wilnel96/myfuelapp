import { useState, useEffect } from 'react';
import { Building2, Users, DollarSign, CreditCard, TrendingUp, Fuel, FileText, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import OrganizationManagement from './OrganizationManagement';
import UserManagement from './UserManagement';
import ManagementFinancialInfo from './ManagementFinancialInfo';
import EFTBatchProcessing from './EFTBatchProcessing';
import FeeStructureView from './FeeStructureView';
import FuelPriceUpdate from './FuelPriceUpdate';
import InvoiceManagement from './InvoiceManagement';
import ClientGarageAccounts from './ClientGarageAccounts';
import { OrganizationPaymentCard } from './OrganizationPaymentCard';

interface BackOfficeProps {
  userRole?: string;
  paymentOption?: string | null;
  onNavigateToMain?: () => void;
}

type BackOfficeView = 'menu' | 'management-org-menu' | 'org-info' | 'user-info' | 'financial-info' | 'fee-structure' | 'eft-processing' | 'fuel-price-update' | 'invoice-management' | 'local-accounts' | 'payment-card';

export default function BackOffice({ userRole, paymentOption, onNavigateToMain }: BackOfficeProps) {
  const [currentView, setCurrentView] = useState<BackOfficeView>('menu');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');

  useEffect(() => {
    loadOrganizationInfo();
  }, []);

  const loadOrganizationInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id);

        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profile.organization_id)
          .maybeSingle();

        if (org?.name) {
          setOrganizationName(org.name);
        }
      }
    } catch (err) {
      console.error('Error loading organization info:', err);
    }
  };

  if (currentView === 'management-org-menu') {
    const managementOrgMenuItems = [
      {
        id: 'org-info',
        title: 'Management Organization Info',
        description: 'Manage management organization details',
        icon: Building2,
        color: 'blue',
      },
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
      ...(userRole !== 'super_admin' ? [{
        id: 'fee-structure',
        title: 'Fee Structure, Spending Limits and Payment Terms (View only)',
        description: 'View monthly fees, spending limits and payment terms',
        icon: TrendingUp,
        color: 'orange',
      }] : []),
    ];

    const getColorClasses = (color: string) => {
      const colors: Record<string, { bg: string; hover: string; icon: string }> = {
        blue: {
          bg: 'bg-blue-50',
          hover: 'hover:bg-blue-100 hover:border-blue-300',
          icon: 'text-blue-600',
        },
        green: {
          bg: 'bg-green-50',
          hover: 'hover:bg-green-100 hover:border-green-300',
          icon: 'text-green-600',
        },
        emerald: {
          bg: 'bg-emerald-50',
          hover: 'hover:bg-emerald-100 hover:border-emerald-300',
          icon: 'text-emerald-600',
        },
        orange: {
          bg: 'bg-orange-50',
          hover: 'hover:bg-orange-100 hover:border-orange-300',
          icon: 'text-orange-600',
        },
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

  if (currentView === 'eft-processing') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setCurrentView('menu')}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          ← Back to Back Office
        </button>
        <EFTBatchProcessing />
      </div>
    );
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

  const menuItems = [
    {
      id: 'management-org-menu',
      title: 'Management Organization Info',
      description: 'Manage organization details, users, and financial information',
      icon: Building2,
      color: 'blue',
    },
    ...(userRole !== 'super_admin' && paymentOption === 'Card Payment' ? [{
      id: 'payment-card',
      title: 'Payment Card Management',
      description: 'Configure your credit/debit card for fuel payments',
      icon: CreditCard,
      color: 'teal',
    }] : []),
    ...(userRole !== 'super_admin' && paymentOption === 'Local Account' ? [{
      id: 'local-accounts',
      title: 'Local Garage Accounts',
      description: 'Manage local accounts with garages where you can refuel',
      icon: Store,
      color: 'amber',
    }] : []),
    ...(userRole === 'super_admin' ? [{
      id: 'invoice-management',
      title: 'Invoice Management',
      description: 'Generate and manage client invoices',
      icon: FileText,
      color: 'teal',
    }, {
      id: 'eft-processing',
      title: 'EFT Processing',
      description: 'Process EFT batches and manage payments',
      icon: CreditCard,
      color: 'green',
    }, {
      id: 'fuel-price-update',
      title: 'Fuel Price Update',
      description: 'Update fuel prices for all garages by zone',
      icon: Fuel,
      color: 'amber',
    }] : []),
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; hover: string; icon: string }> = {
      blue: {
        bg: 'bg-blue-50',
        hover: 'hover:bg-blue-100 hover:border-blue-300',
        icon: 'text-blue-600',
      },
      green: {
        bg: 'bg-green-50',
        hover: 'hover:bg-green-100 hover:border-green-300',
        icon: 'text-green-600',
      },
      teal: {
        bg: 'bg-teal-50',
        hover: 'hover:bg-teal-100 hover:border-teal-300',
        icon: 'text-teal-600',
      },
      amber: {
        bg: 'bg-amber-50',
        hover: 'hover:bg-amber-100 hover:border-amber-300',
        icon: 'text-amber-600',
      },
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

      <div className="space-y-2">
        {menuItems.map((item) => {
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
                <p className="text-gray-600 text-xs mt-0.5">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
