import { useState, useEffect } from 'react';
import { Truck, Users, FileText, Store, Settings, BarChart3, LogOut, ArrowLeft, DollarSign, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClientCardDashboardProps {
  onNavigate: (view: string) => void;
  onSignOut: () => void;
  initialView?: 'main' | 'reports' | 'invoices';
  resetSubmenu?: boolean;
}

interface ClientPermissions {
  isMainUser: boolean;
  isSecondaryMainUser: boolean;
  can_add_vehicles: boolean;
  can_edit_vehicles: boolean;
  can_delete_vehicles: boolean;
  can_add_drivers: boolean;
  can_edit_drivers: boolean;
  can_delete_drivers: boolean;
  can_view_reports: boolean;
  can_create_reports: boolean;
  can_view_custom_reports: boolean;
  can_edit_organization_info: boolean;
  can_view_fuel_transactions: boolean;
  can_manage_users: boolean;
  can_view_financial_data: boolean;
  can_view_invoice_management: boolean;
  can_access_back_office: boolean;
}

const FULL_ACCESS: ClientPermissions = {
  isMainUser: true,
  isSecondaryMainUser: false,
  can_add_vehicles: true,
  can_edit_vehicles: true,
  can_delete_vehicles: true,
  can_add_drivers: true,
  can_edit_drivers: true,
  can_delete_drivers: true,
  can_view_reports: true,
  can_create_reports: true,
  can_view_custom_reports: true,
  can_edit_organization_info: true,
  can_view_fuel_transactions: true,
  can_manage_users: true,
  can_view_financial_data: true,
  can_view_invoice_management: true,
  can_access_back_office: true,
};

export default function ClientCardDashboard({ onNavigate, onSignOut, initialView = 'main', resetSubmenu }: ClientCardDashboardProps) {
  const [showReportsMenu, setShowReportsMenu] = useState(initialView === 'reports');
  const [showInvoicesMenu, setShowInvoicesMenu] = useState(initialView === 'invoices');
  const [perms, setPerms] = useState<ClientPermissions | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  useEffect(() => {
    if (resetSubmenu) {
      setShowReportsMenu(false);
      setShowInvoicesMenu(false);
    }
  }, [resetSubmenu]);

  useEffect(() => {
    setShowReportsMenu(initialView === 'reports');
    setShowInvoicesMenu(initialView === 'invoices');
  }, [initialView]);

  const loadPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role === 'super_admin') {
        setPerms(FULL_ACCESS);
        return;
      }

      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('is_main_user, is_secondary_main_user, can_add_vehicles, can_edit_vehicles, can_delete_vehicles, can_add_drivers, can_edit_drivers, can_delete_drivers, can_view_reports, can_create_reports, can_view_custom_reports, can_edit_organization_info, can_view_fuel_transactions, can_manage_users, can_view_financial_data, can_view_invoice_management, can_access_back_office')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!orgUser) {
        setPerms(FULL_ACCESS);
        return;
      }

      const full = orgUser.is_main_user || orgUser.is_secondary_main_user;
      setPerms({
        isMainUser: orgUser.is_main_user,
        isSecondaryMainUser: orgUser.is_secondary_main_user,
        can_add_vehicles: full || orgUser.can_add_vehicles,
        can_edit_vehicles: full || orgUser.can_edit_vehicles,
        can_delete_vehicles: full || orgUser.can_delete_vehicles,
        can_add_drivers: full || orgUser.can_add_drivers,
        can_edit_drivers: full || orgUser.can_edit_drivers,
        can_delete_drivers: full || orgUser.can_delete_drivers,
        can_view_reports: full || orgUser.can_view_reports,
        can_create_reports: full || orgUser.can_create_reports,
        can_view_custom_reports: full || orgUser.can_view_custom_reports,
        can_edit_organization_info: full || orgUser.can_edit_organization_info,
        can_view_fuel_transactions: full || orgUser.can_view_fuel_transactions,
        can_manage_users: full || orgUser.can_manage_users,
        can_view_financial_data: full || orgUser.can_view_financial_data,
        can_view_invoice_management: full || orgUser.can_view_invoice_management,
        can_access_back_office: full || orgUser.can_access_back_office,
      });
    } catch {
      setPerms(FULL_ACCESS);
    }
  };

  const canAccessVehicles = perms && (perms.can_add_vehicles || perms.can_edit_vehicles || perms.can_delete_vehicles);
  const canAccessDrivers = perms && (perms.can_add_drivers || perms.can_edit_drivers || perms.can_delete_drivers);
  const canAccessReports = perms && (perms.can_view_reports || perms.can_create_reports);
  const canAccessInvoices = perms && perms.can_view_invoice_management;
  const canAccessBackOffice = perms && (
    perms.isMainUser || perms.isSecondaryMainUser ||
    perms.can_access_back_office ||
    perms.can_edit_organization_info ||
    perms.can_manage_users ||
    perms.can_view_financial_data
  );

  if (showInvoicesMenu) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-gray-700" />
            <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
          </div>
          <button
            onClick={() => setShowInvoicesMenu(false)}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-3 py-1.5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Main Menu
          </button>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => onNavigate('fee-invoices')}
            className="w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Fee Invoices</h3>
                <p className="text-sm text-gray-600">Monthly subscription and service fees</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => onNavigate('fuel-invoices')}
            className="w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Fuel Invoices</h3>
                <p className="text-sm text-gray-600">Individual fuel transaction invoices</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (showReportsMenu) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-gray-700" />
            <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          </div>
          <button
            onClick={() => setShowReportsMenu(false)}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-3 py-1.5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Main Menu
          </button>
        </div>
        <div className="space-y-2">
          {perms?.can_view_reports && (
            <button
              onClick={() => onNavigate('reports')}
              className="w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors flex items-center gap-3"
            >
              <FileText className="w-5 h-5 flex-shrink-0 text-blue-600" />
              <span className="font-medium text-gray-900">Reports</span>
            </button>
          )}
          {(perms?.can_create_reports || perms?.can_view_custom_reports) && (
            <button
              onClick={() => onNavigate('custom-reports')}
              className="w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors flex items-center gap-3"
            >
              <BarChart3 className="w-5 h-5 flex-shrink-0 text-blue-600" />
              <span className="font-medium text-gray-900">Custom Report Builder</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!perms) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="w-8 h-8" />
          <h1 className="text-2xl font-bold">MyFuel Card</h1>
        </div>
        <p className="text-blue-100">Card-based fuel payment management</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {canAccessVehicles && (
          <button
            onClick={() => onNavigate('vehicles')}
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Vehicles</h3>
            </div>
            <p className="text-sm text-gray-600">Manage your fleet vehicles</p>
          </button>
        )}

        {canAccessDrivers && (
          <button
            onClick={() => onNavigate('drivers')}
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Drivers</h3>
            </div>
            <p className="text-sm text-gray-600">Manage drivers and payment cards</p>
          </button>
        )}

        <button
          onClick={() => onNavigate('garages')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Store className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Garages</h3>
          </div>
          <p className="text-sm text-gray-600">Browse available fuel stations</p>
        </button>

        {canAccessInvoices && (
          <button
            onClick={() => { setShowInvoicesMenu(true); onNavigate('invoices-menu'); }}
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Invoices</h3>
            </div>
            <p className="text-sm text-gray-600">View payment and fuel invoices</p>
          </button>
        )}

        {canAccessReports && (
          <button
            onClick={() => { setShowReportsMenu(true); onNavigate('reports-menu'); }}
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Reports</h3>
            </div>
            <p className="text-sm text-gray-600">Fuel usage and transaction reports</p>
          </button>
        )}

        {canAccessBackOffice && (
          <button
            onClick={() => onNavigate('backoffice')}
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Back Office</h3>
            </div>
            <p className="text-sm text-gray-600">Organization settings and payment cards</p>
          </button>
        )}
      </div>

      <button
        onClick={onSignOut}
        className="w-full bg-white hover:bg-red-50 border border-red-200 rounded-lg p-4 text-left transition-colors flex items-center gap-3 mt-6"
      >
        <LogOut className="w-5 h-5 flex-shrink-0 text-red-600" />
        <span className="font-medium text-gray-900">Sign Out</span>
      </button>
    </div>
  );
}
