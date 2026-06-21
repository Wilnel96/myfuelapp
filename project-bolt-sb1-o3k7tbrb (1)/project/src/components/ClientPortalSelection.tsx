import { CreditCard, Building2, ArrowLeft, Layers } from 'lucide-react';

interface ClientPortalSelectionProps {
  onSelectPortal: (portalType: 'card' | 'account' | 'both') => void;
  onBack: () => void;
}

export default function ClientPortalSelection({ onSelectPortal, onBack }: ClientPortalSelectionProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        <div className="bg-blue-600 text-white p-8 text-center">
          <h1 className="text-3xl font-bold mb-2">MyFuelApp</h1>
          <p className="text-blue-100">Select Your Fuel Management System</p>
        </div>

        <div className="p-8">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login Selection
          </button>

          <div className="grid md:grid-cols-3 gap-5">
            <button
              onClick={() => onSelectPortal('card')}
              className="group bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-300 rounded-xl p-6 text-left transition-all hover:shadow-lg"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-blue-600 rounded-full group-hover:scale-110 transition-transform">
                  <CreditCard className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Card Only</h2>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Pay for fuel with a payment card at any garage in the network.
                  </p>
                </div>
                <div className="pt-2 border-t border-blue-300 w-full">
                  <ul className="text-xs text-gray-600 mt-1 space-y-1 text-left">
                    <li>• Card-based payments</li>
                    <li>• Real-time tracking</li>
                    <li>• Spending controls</li>
                  </ul>
                </div>
              </div>
            </button>

            <button
              onClick={() => onSelectPortal('account')}
              className="group bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 border-2 border-amber-300 rounded-xl p-6 text-left transition-all hover:shadow-lg"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-amber-600 rounded-full group-hover:scale-110 transition-transform">
                  <Building2 className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Local Account Only</h2>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Open local accounts at specific garages with monthly statements.
                  </p>
                </div>
                <div className="pt-2 border-t border-amber-300 w-full">
                  <ul className="text-xs text-gray-600 mt-1 space-y-1 text-left">
                    <li>• Local garage accounts</li>
                    <li>• Account spending limits</li>
                    <li>• Monthly statements</li>
                  </ul>
                </div>
              </div>
            </button>

            <button
              onClick={() => onSelectPortal('both')}
              className="group bg-gradient-to-br from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 border-2 border-teal-300 rounded-xl p-6 text-left transition-all hover:shadow-lg"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-teal-600 rounded-full group-hover:scale-110 transition-transform">
                  <Layers className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Card + Local Account</h2>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Use local accounts at preferred garages and a card for trips outside your network.
                  </p>
                </div>
                <div className="pt-2 border-t border-teal-300 w-full">
                  <ul className="text-xs text-gray-600 mt-1 space-y-1 text-left">
                    <li>• Full flexibility</li>
                    <li>• Card + account payment</li>
                    <li>• All garages covered</li>
                  </ul>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              All options share the same garage network and provide comprehensive fuel management for your organization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
