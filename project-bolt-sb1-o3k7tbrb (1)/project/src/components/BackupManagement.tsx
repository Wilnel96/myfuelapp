import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Download, Database, Calendar, FileDown, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface BackupLog {
  id: string;
  created_at: string;
  backup_type: string;
  tables_included: string[];
  file_size: number;
  status: string;
  error_message?: string;
  created_by: string;
}

const BackupManagement: React.FC = () => {
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [backupType, setBackupType] = useState<'full' | 'partial'>('full');

  const availableTables = [
    'organizations',
    'organization_users',
    'profiles',
    'vehicles',
    'drivers',
    'garages',
    'garage_contacts',
    'fuel_transactions',
    'daily_eft_batches',
    'eft_batch_items',
    'custom_report_templates',
    'vehicle_draw_return_records',
  ];

  useEffect(() => {
    fetchBackupLogs();
  }, []);

  const fetchBackupLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('backup_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBackupLogs(data || []);
    } catch (error) {
      console.error('Error fetching backup logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/database-backup`;

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      const body = {
        backup_type: backupType,
        tables: backupType === 'partial' ? selectedTables : [],
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await fetchBackupLogs();
    } catch (error) {
      console.error('Error creating backup:', error);
      alert(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const toggleTable = (table: string) => {
    setSelectedTables(prev =>
      prev.includes(table)
        ? prev.filter(t => t !== table)
        : [...prev, table]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Database Backup Management</h1>
                <p className="text-blue-100 mt-1">Create and manage database backups</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Important Information</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Full backups include all tables and data</li>
                    <li>Partial backups allow you to select specific tables</li>
                    <li>Backups are downloaded as JSON files</li>
                    <li>Only super admins can create and view backups</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Create New Backup</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Backup Type
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="backupType"
                        value="full"
                        checked={backupType === 'full'}
                        onChange={(e) => setBackupType(e.target.value as 'full')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-slate-700">Full Backup (All Tables)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="backupType"
                        value="partial"
                        checked={backupType === 'partial'}
                        onChange={(e) => setBackupType(e.target.value as 'partial')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-slate-700">Partial Backup (Select Tables)</span>
                    </label>
                  </div>
                </div>

                {backupType === 'partial' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Tables
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto bg-white p-3 rounded border border-slate-200">
                      {availableTables.map((table) => (
                        <label key={table} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedTables.includes(table)}
                            onChange={() => toggleTable(table)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-slate-700">{table}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={createBackup}
                  disabled={creating || (backupType === 'partial' && selectedTables.length === 0)}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating Backup...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-5 h-5" />
                      <span>Create & Download Backup</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Backup History</h2>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : backupLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No backups found</p>
                  <p className="text-sm mt-1">Create your first backup above</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Tables
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {backupLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              {formatDate(log.created_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              log.backup_type === 'full'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {log.backup_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {log.tables_included.length} tables
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {formatFileSize(log.file_size)}
                          </td>
                          <td className="px-4 py-3">
                            {log.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-sm text-green-700">
                                <CheckCircle className="w-4 h-4" />
                                Completed
                              </span>
                            ) : log.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 text-sm text-red-700">
                                <AlertCircle className="w-4 h-4" />
                                Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm text-yellow-700">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {log.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupManagement;
