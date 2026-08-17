import { Building2, Store, Truck, Users, FileText, BarChart3, Database, Fuel, Package, Wrench } from 'lucide-react';

interface MgmtPermissions {
  is_main_user?: boolean;
  is_secondary_main_user?: boolean;
  can_access_back_office?: boolean;
  can_view_org_info?: boolean;
  can_edit_org_info?: boolean;
  can_view_client_settings?: boolean;
  can_edit_client_settings?: boolean;
  can_view_invoice_management?: boolean;
  can_edit_invoice_management?: boolean;
  can_view_fuel_price_update?: boolean;
  can_edit_fuel_price_update?: boolean;
  can_manage_users?: boolean;
}

interface SuperAdminDashboardProps {
  onNavigate: (view: string) => void;
  permissions?: MgmtPermissions | null;
  isRealSuperAdmin?: boolean;
}

export default function SuperAdminDashboard({ onNavigate, permissions, isRealSuperAdmin = true }: SuperAdminDashboardProps) {
  const full = isRealSuperAdmin || permissions?.is_main_user || permissions?.is_secondary_main_user;

  const menuItems = [
    {
      id: 'client-organizations-menu',
      title: 'Client Organizations',
      description: 'Manage client organizations, users, and finances',
      icon: Building2,
      color: 'blue',
      gate: full || permissions?.can_manage_users,
    },
    {
      id: 'garages',
      title: 'Garages',
      description: 'Manage garage network',
      icon: Store,
      color: 'green',
      gate: full,
    },
    {
      id: 'vehicles',
      title: 'Vehicles',
      description: 'View all client vehicles',
      icon: Truck,
      color: 'orange',
      gate: true,
    },
    {
      id: 'trailers',
      title: 'Trailers',
      description: 'View and manage client trailers',
      icon: Package,
      color: 'teal',
      gate: true,
    },
    {
      id: 'maintenance',
      title: 'Maintenance',
      description: 'Log and track vehicle service and maintenance records',
      icon: Wrench,
      color: 'amber',
      gate: true,
    },
    {
      id: 'drivers',
      title: 'Drivers',
      description: 'View all client drivers',
      icon: Users,
      color: 'cyan',
      gate: true,
    },
    {
      id: 'fuel-invoices',
      title: 'Fuel Invoices',
      description: 'Review client fuel transaction invoices',
      icon: Fuel,
      color: 'orange',
      gate: full || permissions?.can_view_invoice_management,
    },
    {
      id: 'reports-menu',
      title: 'Reports',
      description: 'Consolidated reports and custom report builder',
      icon: FileText,
      color: 'amber',
      gate: true,
    },
    {
      id: 'backoffice',
      title: 'Back Office',
      description: 'System settings and EFT processing',
      icon: BarChart3,
      color: 'gray',
      gate: full || permissions?.can_access_back_office,
    },
    {
      id: 'backup',
      title: 'Database Backup',
      description: 'Create and manage database backups',
      icon: Database,
      color: 'emerald',
      gate: full,
    },
  ].filter(item => item.gate !== false);

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; hover: string; icon: string }> = {
      blue: { bg: 'bg-blue-100', hover: 'group-hover:bg-blue-600', icon: 'text-blue-600' },
      green: { bg: 'bg-green-100', hover: 'group-hover:bg-green-600', icon: 'text-green-600' },
      orange: { bg: 'bg-orange-100', hover: 'group-hover:bg-orange-600', icon: 'text-orange-600' },
      cyan: { bg: 'bg-cyan-100', hover: 'group-hover:bg-cyan-600', icon: 'text-cyan-600' },
      teal: { bg: 'bg-teal-100', hover: 'group-hover:bg-teal-600', icon: 'text-teal-600' },
      trailer: { bg: 'bg-teal-100', hover: 'group-hover:bg-teal-600', icon: 'text-teal-600' },
      amber: { bg: 'bg-amber-100', hover: 'group-hover:bg-amber-600', icon: 'text-amber-600' },
      gray: { bg: 'bg-gray-100', hover: 'group-hover:bg-gray-600', icon: 'text-gray-600' },
      violet: { bg: 'bg-violet-100', hover: 'group-hover:bg-violet-600', icon: 'text-violet-600' },
      emerald: { bg: 'bg-emerald-100', hover: 'group-hover:bg-emerald-600', icon: 'text-emerald-600' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">System Administration</h2>
        <p className="text-gray-600">Select an option below to manage the system</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const colors = getColorClasses(item.color);

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center ${colors.hover} transition-colors`}>
                  <Icon className={`w-6 h-6 ${colors.icon} group-hover:text-white transition-colors`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
