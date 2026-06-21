import { Building2, Users, DollarSign, PlusCircle } from 'lucide-react';

interface ClientOrganizationsMenuProps {
  onNavigate: (view: string) => void;
}

export default function ClientOrganizationsMenu({ onNavigate }: ClientOrganizationsMenuProps) {
  const menuItems = [
    {
      id: 'create-client-org',
      title: 'Create New Client',
      description: 'Add a new client organization',
      icon: PlusCircle,
      color: 'green',
    },
    {
      id: 'client-org-info',
      title: 'Client Organization Info',
      description: 'Manage client organization details',
      icon: Building2,
      color: 'blue',
    },
    {
      id: 'client-user-info',
      title: 'Client User Info',
      description: 'Manage client users and permissions',
      icon: Users,
      color: 'purple',
    },
    {
      id: 'client-financial-info',
      title: 'Client Financial Info',
      description: 'Manage banking and financial details',
      icon: DollarSign,
      color: 'emerald',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; hover: string; icon: string }> = {
      green: {
        bg: 'bg-green-50',
        hover: 'hover:bg-green-100 hover:border-green-300',
        icon: 'text-green-600',
      },
      blue: {
        bg: 'bg-blue-50',
        hover: 'hover:bg-blue-100 hover:border-blue-300',
        icon: 'text-blue-600',
      },
      purple: {
        bg: 'bg-purple-50',
        hover: 'hover:bg-purple-100 hover:border-purple-300',
        icon: 'text-purple-600',
      },
      emerald: {
        bg: 'bg-emerald-50',
        hover: 'hover:bg-emerald-100 hover:border-emerald-300',
        icon: 'text-emerald-600',
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Client Organizations</h2>
        <p className="text-gray-600 text-sm mt-0.5">Select an option to manage client organization data</p>
      </div>

      <div className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const colors = getColorClasses(item.color);

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
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
