import { useState, useRef } from 'react';
import { Upload, Download, Trash2, CheckCircle, AlertCircle, ArrowLeft, MapPin, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { downloadZoneReference } from '../lib/priceZones';

interface ZoneRow {
  town: string;
  magisterial_district: string;
  province: string;
  price_zone: string;
}

interface ParseResult {
  rows: ZoneRow[];
  errors: string[];
}

function parseCSV(text: string): ParseResult {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ['CSV must have a header row and at least one data row.'] };

  const header = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
  const errors: string[] = [];
  const rows: ZoneRow[] = [];

  // Flexible column name matching
  const colIdx = (names: string[]) => names.map(n => header.indexOf(n)).find(i => i >= 0) ?? -1;
  const townCol = colIdx(['town', 'town/area', 'area', 'suburb', 'place']);
  const distCol = colIdx(['magisterial district', 'magisterial_district', 'district', 'mag district', 'mag. district']);
  const provCol = colIdx(['province', 'prov']);
  const zoneCol = colIdx(['price zone', 'price_zone', 'zone', 'dmre zone', 'dmre zone code', 'zone code']);

  if (townCol < 0) errors.push('Missing column: town (or "town/area", "area")');
  if (distCol < 0) errors.push('Missing column: magisterial_district (or "district", "mag district")');
  if (zoneCol < 0) errors.push('Missing column: price_zone (or "zone", "zone code", "dmre zone code")');

  if (errors.length) return { rows, errors };

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
    const town = cols[townCol] ?? '';
    const district = cols[distCol] ?? '';
    const province = provCol >= 0 ? (cols[provCol] ?? '') : '';
    const zone = cols[zoneCol] ?? '';
    if (!town && !district) continue;
    if (!zone) { errors.push(`Row ${i + 1}: missing zone code`); continue; }
    rows.push({ town, magisterial_district: district, province, price_zone: zone });
  }

  return { rows, errors };
}

interface Props {
  onBack: () => void;
}

export default function PriceZoneImport({ onBack }: Props) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ZoneRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [importError, setImportError] = useState('');
  const [currentCount, setCurrentCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCount = async () => {
    setLoadingCount(true);
    const { count } = await supabase.from('price_zone_references').select('*', { count: 'exact', head: true });
    setCurrentCount(count ?? 0);
    setLoadingCount(false);
  };

  useState(() => { loadCount(); });

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setCsvText(text);
      handleParse(text);
    };
    reader.readAsText(file);
  };

  const handleParse = (text: string) => {
    const result = parseCSV(text);
    setParseErrors(result.errors);
    setPreview(result.errors.length === 0 ? result.rows : null);
    setImported(null);
    setImportError('');
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    setImportError('');

    // Upsert in batches of 500
    const batchSize = 500;
    let totalInserted = 0;
    try {
      for (let i = 0; i < preview.length; i += batchSize) {
        const batch = preview.slice(i, i + batchSize);
        const { error } = await supabase
          .from('price_zone_references')
          .upsert(batch, { onConflict: 'town,magisterial_district' });
        if (error) throw error;
        totalInserted += batch.length;
      }
      setImported(totalInserted);
      setPreview(null);
      setCsvText('');
      loadCount();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL existing price zone records? This cannot be undone.')) return;
    const { error } = await supabase.from('price_zone_references').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (!error) { setCurrentCount(0); setImported(null); }
  };

  const downloadTemplate = () => {
    const csv = 'town,magisterial_district,province,price_zone\nAshton,Montagu,Western Cape,3\nCape Town,Cape Town,Western Cape,1\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price_zone_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Back Office
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Price Zone Data Import
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Import the official DMRE price zone schedule. Upload a CSV with town, magisterial district and zone code columns.
          Existing records for the same town + district are updated automatically.
        </p>
      </div>

      {/* Current status */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileText className="w-4 h-4" />
          {loadingCount ? 'Loading...' : `${currentCount ?? 0} zone records currently in database`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadZoneReference}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Download className="w-3 h-3" />
            Export current data
          </button>
          {(currentCount ?? 0) > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium ml-2"
            >
              <Trash2 className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Download helpers */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Download className="w-4 h-4 text-gray-400" />
          <div className="text-left">
            <div className="font-medium">Download CSV template</div>
            <div className="text-xs text-gray-500">Blank template with correct column headers</div>
          </div>
        </button>
        <button
          onClick={downloadZoneReference}
          className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Download className="w-4 h-4 text-gray-400" />
          <div className="text-left">
            <div className="font-medium">Download built-in reference</div>
            <div className="text-xs text-gray-500">Starting point — approximate zone codes</div>
          </div>
        </button>
      </div>

      {/* CSV input section */}
      <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Step 1 — Provide your CSV data</p>
        <p className="text-xs text-gray-500">
          Required columns: <code className="bg-gray-100 px-1 rounded">town</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">magisterial_district</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">price_zone</code>. Province is optional.
          Column names are flexible (e.g. "Mag District", "Zone Code" are also accepted).
        </p>

        {/* File upload */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            Upload CSV file
          </button>
          <span className="text-xs text-gray-400">— or paste CSV text below —</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          placeholder={'town,magisterial_district,province,price_zone\nAshton,Montagu,Western Cape,3\nCape Town,Cape Town,Western Cape,1'}
          rows={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
        />

        {parseErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
            {parseErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {e}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => handleParse(csvText)}
          disabled={!csvText.trim()}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Parse and preview
        </button>
      </div>

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Step 2 — Preview ({preview.length} rows ready to import)
            </p>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importing...' : `Import ${preview.length} records`}
            </button>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b">Town</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b">Magisterial District</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b">Province</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b">Zone</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-1.5">{r.town}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.magisterial_district}</td>
                    <td className="px-3 py-1.5 text-gray-500 text-xs">{r.province}</td>
                    <td className="px-3 py-1.5 font-mono font-semibold text-blue-700">{r.price_zone}</td>
                  </tr>
                ))}
                {preview.length > 200 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-center text-xs text-gray-500">
                      ... and {preview.length - 200} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {importError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {importError}
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {imported !== null && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">Import successful</p>
            <p className="text-sm text-green-700">{imported} zone records saved to database. The price zone lookup will now use your official data.</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
        <p className="font-semibold">How to get the official DMRE zone data:</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Download the current "Petroleum Products Pricing" schedule from the DMRE website (dmr.gov.za)</li>
          <li>Open the spreadsheet/PDF — it lists every magisterial district with its zone code (e.g. 5A, 69C)</li>
          <li>Copy the relevant columns into a CSV with headers: <code className="bg-blue-100 px-1 rounded">town, magisterial_district, province, price_zone</code></li>
          <li>Paste or upload it here and click Import</li>
        </ol>
        <p className="text-blue-600 text-xs mt-2">
          Existing records are updated (upsert) — you can re-import at any time when zones change.
        </p>
      </div>
    </div>
  );
}
