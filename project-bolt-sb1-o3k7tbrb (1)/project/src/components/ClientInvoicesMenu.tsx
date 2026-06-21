import { DollarSign, Fuel, FileText, ArrowLeft } from 'lucide-react';

interface ClientInvoicesMenuProps {
  onNavigate: (view: string) => void;
  onBack: () => void;
}

export default function ClientInvoicesMenu({ onNavigate, onBack }: ClientInvoicesMenuProps) {
  const invoiceMenuItems = [
    {
      id: 'fee-invoices',
      title: 'Fee Invoices',
      description: 'Monthly subscription and service fees',
      icon: DollarSign,
    },
    {
      id: 'fuel-invoices',
      title: 'Fuel Invoices',
      description: 'Individual fuel transaction invoices',
      icon: Fuel,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-gray-700" />
          <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
        </div>
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-3 py-1.5 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Main Menu
        </button>
      </div>

      <div className="space-y-2">
        {invoiceMenuItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-4 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
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
