import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Fuel, TrendingUp, Calendar, Download, ArrowLeft, FileText } from 'lucide-react';

interface OrgSummary {
  org_id: string;
  org_name: string;
  total_transactions: number;
  total_amount: number;
  total_commission: number;
  transaction_count: number;
}

interface GarageSummary {
  garage_id: string;
  garage_name: string;
  organization_count: number;
  total_transactions: number;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
}

interface ConsolidatedReportsProps {
  onNavigate?: (view: string | null) => void;
}

export default function ConsolidatedReports({ onNavigate }: ConsolidatedReportsProps) {
  const [orgSummaries, setOrgSummaries] = useState<OrgSummary[]>([]);
  const [garageSummaries, setGarageSummaries] = useState<GarageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManagementOrg] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadConsolidatedData();
  }, [startDate, endDate]);

  const loadConsolidatedData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadOrgSummaries(), loadGarageSummaries()]);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgSummaries = async () => {
    const { data, error } = await supabase
      .from('fuel_transactions')
      .select(`
        organization_id,
        total_amount,
        commission_amount,
        organizations (
          name
        )
      `)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (error) {
      console.error('Error loading org summaries:', error);
      return;
    }

    const summaries: { [key: string]: OrgSummary } = {};

    data?.forEach((transaction: any) => {
      const orgId = transaction.organization_id;
      if (!summaries[orgId]) {
        summaries[orgId] = {
          org_id: orgId,
          org_name: transaction.organizations?.name || 'Unknown',
          total_transactions: 0,
          total_amount: 0,
          total_commission: 0,
          transaction_count: 0,
        };
      }

      summaries[orgId].transaction_count += 1;
      summaries[orgId].total_amount += parseFloat(transaction.total_amount || 0);
      summaries[orgId].total_commission += parseFloat(transaction.commission_amount || 0);
    });

    setOrgSummaries(Object.values(summaries));
  };

  const loadGarageSummaries = async () => {
    const { data, error } = await supabase
      .from('fuel_transactions')
      .select(`
        garage_id,
        organization_id,
        total_amount,
        commission_amount,
        net_amount,
        garages (
          name
        )
      `)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .not('garage_id', 'is', null);

    if (error) {
      console.error('Error loading garage summaries:', error);
      return;
    }

    const summaries: { [key: string]: GarageSummary } = {};

    data?.forEach((transaction: any) => {
      const garageId = transaction.garage_id;
      if (!summaries[garageId]) {
        summaries[garageId] = {
          garage_id: garageId,
          garage_name: transaction.garages?.name || 'Unknown',
          organization_count: new Set<string>().size,
          total_transactions: 0,
          gross_amount: 0,
          commission_amount: 0,
          net_amount: 0,
        };
      }

      summaries[garageId].total_transactions += 1;
      summaries[garageId].gross_amount += parseFloat(transaction.total_amount || 0);
      summaries[garageId].commission_amount += parseFloat(transaction.commission_amount || 0);
      summaries[garageId].net_amount += parseFloat(transaction.net_amount || 0);
    });

    const summariesWithOrgCount = await Promise.all(
      Object.values(summaries).map(async (summary) => {
        const { data: orgs } = await supabase
          .from('fuel_transactions')
          .select('organization_id', { count: 'exact', head: false })
          .eq('garage_id', summary.garage_id)
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);

        const uniqueOrgs = new Set(orgs?.map(t => t.organization_id)).size;
        return { ...summary, organization_count: uniqueOrgs };
      })
    );

    setGarageSummaries(summariesWithOrgCount);
  };

  const exportToCSV = (type: 'organizations' | 'garages') => {
    let csv = '';
    let filename = '';

    if (type === 'organizations') {
      csv = 'Organization,Transaction Count,Total Amount,Commission,Net Amount\n';
      orgSummaries.forEach(org => {
        const netAmount = org.total_amount - org.total_commission;
        csv += `"${org.org_name}",${org.transaction_count},${org.total_amount.toFixed(2)},${org.total_commission.toFixed(2)},${netAmount.toFixed(2)}\n`;
      });
      filename = `organizations-report-${startDate}-to-${endDate}.csv`;
    } else {
      csv = 'Garage,Organizations Served,Transaction Count,Gross Amount,Commission,Net Payment\n';
      garageSummaries.forEach(garage => {
        csv += `"${garage.garage_name}",${garage.organization_count},${garage.total_transactions},${garage.gross_amount.toFixed(2)},${garage.commission_amount.toFixed(2)},${garage.net_amount.toFixed(2)}\n`;
      });
      filename = `garages-payment-summary-${startDate}-to-${endDate}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalRevenue = orgSummaries.reduce((sum, org) => sum + org.total_amount, 0);
  const totalCommission = orgSummaries.reduce((sum, org) => sum + org.total_commission, 0);
  const totalTransactions = orgSummaries.reduce((sum, org) => sum + org.transaction_count, 0);

  return (
    <div className="space-y-6 -my-6">
      <div className="sticky top-0 z-20 bg-white -mx-4 px-4 py-6 pb-4 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Consolidated Reports</h2>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('reports-menu')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Main Menu
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Fuel className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Transactions</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{totalTransactions}</p>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold text-green-900">R {totalRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Total Commission</span>
            </div>
            <p className="text-2xl font-bold text-orange-900">R {totalCommission.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">By Organization</h2>
            </div>
            <button
              onClick={() => exportToCSV('organizations')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transactions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                {isManagementOrg && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission
                  </th>
                )}
                {isManagementOrg && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Amount
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orgSummaries.map((org) => (
                <tr key={org.org_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{org.org_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                    {org.transaction_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                    R {org.total_amount.toFixed(2)}
                  </td>
                  {isManagementOrg && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-orange-600">
                      R {org.total_commission.toFixed(2)}
                    </td>
                  )}
                  {isManagementOrg && (
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-green-600">
                      R {(org.total_amount - org.total_commission).toFixed(2)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fuel className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">Garage Payment Summary</h2>
            </div>
            <button
              onClick={() => exportToCSV('garages')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Summary of payments due to garages from all organizations
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Garage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organizations
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transactions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gross Amount
                </th>
                {isManagementOrg && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission
                  </th>
                )}
                {isManagementOrg && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Payment
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {garageSummaries.map((garage) => (
                <tr key={garage.garage_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{garage.garage_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                    {garage.organization_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                    {garage.total_transactions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                    R {garage.gross_amount.toFixed(2)}
                  </td>
                  {isManagementOrg && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-orange-600">
                      R {garage.commission_amount.toFixed(2)}
                    </td>
                  )}
                  {isManagementOrg && (
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-green-600">
                      R {garage.net_amount.toFixed(2)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
