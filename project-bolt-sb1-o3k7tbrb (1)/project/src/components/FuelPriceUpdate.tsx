import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Download, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getFuelTypeDisplayName } from '../lib/fuelTypes';
import * as XLSX from 'xlsx';

interface PriceData {
  zone: string;
  ulp93: number;
  ulp95: number;
}

interface UpdateResult {
  garageId: string;
  garageName: string;
  zone: string;
  success: boolean;
  previousPrices: { ulp93?: number; ulp95?: number };
  newPrices: { ulp93: number; ulp95: number };
  error?: string;
}

interface CheckResult {
  garageId: string;
  garageName: string;
  zone: string;
  currentPrices: { ulp93?: number; ulp95?: number };
  expectedPrices: { ulp93: number; ulp95: number };
  ulp93Match: boolean;
  ulp95Match: boolean;
}

export default function FuelPriceUpdate() {
  const [loading, setLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [results, setResults] = useState<UpdateResult[]>([]);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState('');
  const [checkError, setCheckError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkSuccess, setCheckSuccess] = useState('');
  const [updateDiscrepanciesLoading, setUpdateDiscrepanciesLoading] = useState(false);

  const downloadTemplate = () => {
    const template = [
      ['Price Zone', `${getFuelTypeDisplayName('ULP-93')} (cents/L)`, `${getFuelTypeDisplayName('ULP-95')} (cents/L)`],
      ['5A', '2150', '2230'],
      ['5B', '2165', '2245'],
      ['5C', '2180', '2260'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fuel Prices');

    XLSX.writeFile(wb, 'fuel_price_template.xlsx');
  };

  const handleCheckPrices = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCheckLoading(true);
    setCheckError('');
    setCheckSuccess('');
    setCheckResults([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('Spreadsheet must have at least a header row and one data row');
      }

      const priceDataMap = new Map<string, PriceData>();

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row[0]) continue;

        const zone = String(row[0]).trim();
        const ulp93Cents = parseFloat(String(row[1] || '0'));
        const ulp95Cents = parseFloat(String(row[2] || '0'));

        if (isNaN(ulp93Cents) || isNaN(ulp95Cents)) {
          console.warn(`Skipping row ${i + 1}: Invalid price values`);
          continue;
        }

        const ulp93 = ulp93Cents / 100;
        const ulp95 = ulp95Cents / 100;

        priceDataMap.set(zone.toLowerCase(), { zone, ulp93, ulp95 });
      }

      if (priceDataMap.size === 0) {
        throw new Error('No valid price data found in spreadsheet');
      }

      const { data: garages, error: fetchError } = await supabase
        .from('garages')
        .select('id, name, price_zone, fuel_prices')
        .not('price_zone', 'is', null);

      if (fetchError) throw fetchError;

      if (!garages || garages.length === 0) {
        throw new Error('No garages found with price zones assigned');
      }

      const checkResultsList: CheckResult[] = [];

      for (const garage of garages) {
        const priceZone = garage.price_zone?.trim().toLowerCase();
        if (!priceZone) continue;

        const priceData = priceDataMap.get(priceZone);
        if (!priceData) continue;

        const currentPrices = garage.fuel_prices || {};
        const currentUlp93 = currentPrices['ULP-93'];
        const currentUlp95 = currentPrices['ULP-95'];

        const ulp93Match = currentUlp93 === priceData.ulp93;
        const ulp95Match = currentUlp95 === priceData.ulp95;

        if (!ulp93Match || !ulp95Match) {
          checkResultsList.push({
            garageId: garage.id,
            garageName: garage.name,
            zone: garage.price_zone,
            currentPrices: {
              ulp93: currentUlp93,
              ulp95: currentUlp95
            },
            expectedPrices: {
              ulp93: priceData.ulp93,
              ulp95: priceData.ulp95
            },
            ulp93Match,
            ulp95Match
          });
        }
      }

      setCheckResults(checkResultsList);

      if (checkResultsList.length === 0) {
        setCheckSuccess('All garage prices match the expected prices from the uploaded list');
      } else {
        setCheckSuccess(`Found ${checkResultsList.length} garage${checkResultsList.length !== 1 ? 's' : ''} with price discrepancies`);
      }

    } catch (err: any) {
      setCheckError(err.message || 'Failed to process spreadsheet');
    } finally {
      setCheckLoading(false);
      event.target.value = '';
    }
  };

  const handleUpdateDiscrepancies = async () => {
    if (checkResults.length === 0) return;

    setUpdateDiscrepanciesLoading(true);
    setError('');
    setSuccess('');
    setResults([]);

    try {
      const updateResults: UpdateResult[] = [];

      for (const checkResult of checkResults) {
        const { data: garage, error: fetchError } = await supabase
          .from('garages')
          .select('fuel_prices')
          .eq('id', checkResult.garageId)
          .maybeSingle();

        if (fetchError) {
          updateResults.push({
            garageId: checkResult.garageId,
            garageName: checkResult.garageName,
            zone: checkResult.zone,
            success: false,
            previousPrices: checkResult.currentPrices,
            newPrices: checkResult.expectedPrices,
            error: fetchError.message
          });
          continue;
        }

        const currentPrices = garage?.fuel_prices || {};
        const newPrices = {
          ...currentPrices,
          'ULP-93': checkResult.expectedPrices.ulp93,
          'ULP-95': checkResult.expectedPrices.ulp95
        };

        const { error: updateError } = await supabase
          .from('garages')
          .update({ fuel_prices: newPrices })
          .eq('id', checkResult.garageId);

        updateResults.push({
          garageId: checkResult.garageId,
          garageName: checkResult.garageName,
          zone: checkResult.zone,
          success: !updateError,
          previousPrices: checkResult.currentPrices,
          newPrices: checkResult.expectedPrices,
          error: updateError?.message
        });
      }

      setResults(updateResults);

      const successCount = updateResults.filter(r => r.success).length;
      const failCount = updateResults.filter(r => !r.success).length;

      if (failCount === 0) {
        setSuccess(`Successfully updated fuel prices for ${successCount} garage${successCount !== 1 ? 's' : ''}`);
        setCheckResults([]);
        setCheckSuccess('');
      } else {
        setSuccess(`Updated ${successCount} garage${successCount !== 1 ? 's' : ''}, ${failCount} failed`);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to update prices');
    } finally {
      setUpdateDiscrepanciesLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setResults([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('Spreadsheet must have at least a header row and one data row');
      }

      const priceDataMap = new Map<string, PriceData>();

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row[0]) continue;

        const zone = String(row[0]).trim();
        const ulp93Cents = parseFloat(String(row[1] || '0'));
        const ulp95Cents = parseFloat(String(row[2] || '0'));

        if (isNaN(ulp93Cents) || isNaN(ulp95Cents)) {
          console.warn(`Skipping row ${i + 1}: Invalid price values`);
          continue;
        }

        const ulp93 = ulp93Cents / 100;
        const ulp95 = ulp95Cents / 100;

        priceDataMap.set(zone.toLowerCase(), { zone, ulp93, ulp95 });
      }

      if (priceDataMap.size === 0) {
        throw new Error('No valid price data found in spreadsheet');
      }

      const { data: garages, error: fetchError } = await supabase
        .from('garages')
        .select('id, name, price_zone, fuel_prices')
        .not('price_zone', 'is', null);

      if (fetchError) throw fetchError;

      if (!garages || garages.length === 0) {
        throw new Error('No garages found with price zones assigned');
      }

      const updateResults: UpdateResult[] = [];

      for (const garage of garages) {
        const priceZone = garage.price_zone?.trim().toLowerCase();
        if (!priceZone) continue;

        const priceData = priceDataMap.get(priceZone);

        if (!priceData) {
          updateResults.push({
            garageId: garage.id,
            garageName: garage.name,
            zone: garage.price_zone,
            success: false,
            previousPrices: {},
            newPrices: { ulp93: 0, ulp95: 0 },
            error: 'Price zone not found in spreadsheet'
          });
          continue;
        }

        const currentPrices = garage.fuel_prices || {};
        const newPrices = {
          ...currentPrices,
          'ULP-93': priceData.ulp93,
          'ULP-95': priceData.ulp95
        };

        const { error: updateError } = await supabase
          .from('garages')
          .update({ fuel_prices: newPrices })
          .eq('id', garage.id);

        updateResults.push({
          garageId: garage.id,
          garageName: garage.name,
          zone: garage.price_zone,
          success: !updateError,
          previousPrices: {
            ulp93: currentPrices['ULP-93'],
            ulp95: currentPrices['ULP-95']
          },
          newPrices: {
            ulp93: priceData.ulp93,
            ulp95: priceData.ulp95
          },
          error: updateError?.message
        });
      }

      setResults(updateResults);

      const successCount = updateResults.filter(r => r.success).length;
      const failCount = updateResults.filter(r => !r.success).length;

      if (failCount === 0) {
        setSuccess(`Successfully updated fuel prices for ${successCount} garage${successCount !== 1 ? 's' : ''}`);
      } else {
        setSuccess(`Updated ${successCount} garage${successCount !== 1 ? 's' : ''}, ${failCount} failed`);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to process spreadsheet');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Monthly Fuel Price Update</p>
            <p>Upload an Excel spreadsheet with zone prices to automatically update all garage fuel prices. Prices change the first Wednesday of every month at 00:00.</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Column 1: Price Zone (e.g., 5A, 5B, 5C) - must match garage price zones exactly</li>
              <li>Column 2: {getFuelTypeDisplayName('ULP-93')} pump price in cents (e.g., 2195 for R21.95)</li>
              <li>Column 3: {getFuelTypeDisplayName('ULP-95')} pump price in cents (e.g., 2330 for R23.30)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          Download Template
        </button>

        <label className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
          <Search className="w-4 h-4" />
          {checkLoading ? 'Checking...' : 'Check Fuel Prices'}
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleCheckPrices}
            disabled={checkLoading}
            className="hidden"
          />
        </label>

        <label className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
          <Upload className="w-4 h-4" />
          {loading ? 'Processing...' : 'Upload & Update Prices'}
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
          />
        </label>
      </div>

      {checkError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{checkError}</p>
          </div>
        </div>
      )}

      {checkSuccess && (
        <div className={`${checkResults.length === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4`}>
          <div className="flex items-start gap-3">
            {checkResults.length === 0 ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            )}
            <p className={`text-sm ${checkResults.length === 0 ? 'text-green-800' : 'text-yellow-800'}`}>{checkSuccess}</p>
          </div>
        </div>
      )}

      {checkResults.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Price Discrepancies</h3>
                <p className="text-sm text-gray-600 mt-1">Garages with prices that do not match the uploaded list</p>
              </div>
              <button
                onClick={handleUpdateDiscrepancies}
                disabled={updateDiscrepanciesLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4" />
                {updateDiscrepanciesLoading ? 'Updating...' : 'Update These Prices'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Garage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current {getFuelTypeDisplayName('ULP-93')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected {getFuelTypeDisplayName('ULP-93')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current {getFuelTypeDisplayName('ULP-95')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected {getFuelTypeDisplayName('ULP-95')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {checkResults.map((result) => (
                  <tr key={result.garageId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{result.garageName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.zone}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${result.ulp93Match ? 'text-gray-500' : 'text-red-600 font-medium'}`}>
                      {result.currentPrices.ulp93 ? `R${result.currentPrices.ulp93.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      R{result.expectedPrices.ulp93.toFixed(2)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${result.ulp95Match ? 'text-gray-500' : 'text-red-600 font-medium'}`}>
                      {result.currentPrices.ulp95 ? `R${result.currentPrices.ulp95.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      R{result.expectedPrices.ulp95.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Update Results</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Garage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previous {getFuelTypeDisplayName('ULP-93')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New {getFuelTypeDisplayName('ULP-93')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previous {getFuelTypeDisplayName('ULP-95')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New {getFuelTypeDisplayName('ULP-95')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result) => (
                  <tr key={result.garageId} className={result.success ? '' : 'bg-red-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.garageName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.zone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.previousPrices.ulp93 ? `R${result.previousPrices.ulp93.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      R{result.newPrices.ulp93.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.previousPrices.ulp95 ? `R${result.previousPrices.ulp95.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      R{result.newPrices.ulp95.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
