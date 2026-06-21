import { ArrowLeft, Fuel } from 'lucide-react';
import { FuelInvoicesTab } from './InvoiceManagement';

interface FuelInvoicesPageProps {
  onBack: () => void;
}

export default function FuelInvoicesPage({ onBack }: FuelInvoicesPageProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Fuel className="w-6 h-6 text-orange-600" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Fuel Invoices</h2>
            <p className="text-sm text-gray-600">Review client fuel transaction invoices</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-3 py-1.5 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Main Menu
        </button>
      </div>
      <FuelInvoicesTab />
    </div>
  );
}
