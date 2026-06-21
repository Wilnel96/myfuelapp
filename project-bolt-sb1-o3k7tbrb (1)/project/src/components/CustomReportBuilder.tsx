import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Download, Save, FolderOpen, Play, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TableColumn {
  name: string;
  type: string;
}

interface TableSchema {
  tableName: string;
  displayName: string;
  columns: TableColumn[];
}

interface Filter {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface SortOrder {
  id: string;
  column: string;
  direction: 'asc' | 'desc';
}

interface ReportTemplate {
  id?: string;
  name: string;
  description: string;
  table: string;
  columns: string[];
  filters: Filter[];
  sortOrders: SortOrder[];
}

interface CustomReportBuilderProps {
  onNavigate?: (view: string | null) => void;
}

export default function CustomReportBuilder({ onNavigate }: CustomReportBuilderProps) {
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sortOrders, setSortOrders] = useState<SortOrder[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [savedReports, setSavedReports] = useState<ReportTemplate[]>([]);
  const [showSavedReports, setShowSavedReports] = useState(false);
  const [isClientOrg, setIsClientOrg] = useState(false);

  useEffect(() => {
    loadTables();
    loadSavedReports();
  }, []);

  const loadTables = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .maybeSingle();

      // Check if user is from a client organization (not management)
      const { data: org } = await supabase
        .from('organizations')
        .select('is_management_org')
        .eq('id', profile?.organization_id)
        .maybeSingle();

      const clientOrg = !org?.is_management_org;
      setIsClientOrg(clientOrg);
      console.log('User is_management_org:', org?.is_management_org, 'Is client org:', clientOrg);

      const availableTables = [
        { name: 'fuel_transactions', displayName: 'Fuel Transactions' },
        { name: 'vehicles', displayName: 'Vehicles' },
        { name: 'drivers', displayName: 'Drivers' },
        { name: 'vehicle_exceptions', displayName: 'Vehicle Exceptions' },
        { name: 'garages', displayName: 'Garages' },
        ...(clientOrg ? [] : [
          { name: 'organizations', displayName: 'Organizations' },
          { name: 'daily_eft_batches', displayName: 'EFT Batches' },
          { name: 'eft_batch_items', displayName: 'EFT Batch Items' }
        ]),
        { name: 'organization_users', displayName: 'Users' },
      ];

      const schemasWithColumns: TableSchema[] = [];

      for (const table of availableTables) {
        try {
          let columns: TableColumn[] = [];

          const columnDefinitions = getDefaultColumns(table.name, clientOrg);
          if (columnDefinitions.length > 0) {
            columns = columnDefinitions;
          } else {
            const { data, error } = await supabase
              .from(table.name)
              .select('*')
              .limit(1);

            if (data && data.length > 0) {
              columns = Object.keys(data[0])
                .filter(key => key !== 'id')
                .map(key => ({
                  name: key,
                  type: typeof data[0][key]
                }));
            }
          }

          // Filter out confidential columns for client organizations
          if (clientOrg) {
            if (table.name === 'fuel_transactions') {
              console.log('Filtering fuel_transactions columns, before:', columns.length, columns.map(c => c.name));
              columns = columns.filter(col =>
                !['commission_rate', 'commission_amount', 'net_amount', 'organization_id'].includes(col.name)
              );
              console.log('After filtering:', columns.length, columns.map(c => c.name));
            } else if (['vehicles', 'drivers', 'vehicle_exceptions', 'organization_users'].includes(table.name)) {
              // Remove organization_id from other tables for client organizations
              columns = columns.filter(col => col.name !== 'organization_id');
            }
          }

          schemasWithColumns.push({
            tableName: table.name,
            displayName: table.displayName,
            columns
          });
        } catch (err) {
          console.error(`Error loading table ${table.name}:`, err);
          const columnDefinitions = getDefaultColumns(table.name, clientOrg);

          schemasWithColumns.push({
            tableName: table.name,
            displayName: table.displayName,
            columns: columnDefinitions
          });
        }
      }

      setTables(schemasWithColumns);
    } catch (err: any) {
      console.error('Error loading tables:', err);
    }
  };

  const getDefaultColumns = (tableName: string, filterForClient: boolean = false): TableColumn[] => {
    const columnMap: Record<string, TableColumn[]> = {
      'fuel_transactions': [
        { name: 'organization_id', type: 'string' },
        { name: 'vehicle_id', type: 'string' },
        { name: '_vehicle_registration', type: 'string' },
        { name: '_vehicle_make', type: 'string' },
        { name: '_vehicle_model', type: 'string' },
        { name: 'driver_id', type: 'string' },
        { name: 'garage_id', type: 'string' },
        { name: 'fuel_card_id', type: 'string' },
        { name: 'transaction_date', type: 'string' },
        { name: 'fuel_type', type: 'string' },
        { name: 'liters', type: 'number' },
        { name: 'price_per_liter', type: 'number' },
        { name: 'total_amount', type: 'number' },
        { name: 'odometer_reading', type: 'number' },
        { name: 'previous_odometer_reading', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'payment_method', type: 'string' },
        { name: 'payment_status', type: 'string' },
        { name: 'commission_rate', type: 'number' },
        { name: 'commission_amount', type: 'number' },
        { name: 'net_amount', type: 'number' },
        { name: 'eft_batch_id', type: 'string' },
        { name: 'nfc_payment_transaction_id', type: 'string' },
        { name: 'authorized_at', type: 'string' },
        { name: 'payment_completed_at', type: 'string' },
        { name: 'location', type: 'string' },
        { name: 'license_disk_image', type: 'string' },
        { name: 'number_plate_image', type: 'string' },
        { name: 'verified', type: 'boolean' },
        { name: 'created_at', type: 'string' },
        { name: '_calc_distance_traveled', type: 'number' },
        { name: '_calc_fuel_efficiency', type: 'number' },
        { name: '_calc_cost_per_km', type: 'number' },
      ],
      'vehicles': [
        { name: 'organization_id', type: 'string' },
        { name: 'registration_number', type: 'string' },
        { name: 'driver_name', type: 'string' },
        { name: 'make', type: 'string' },
        { name: 'model', type: 'string' },
        { name: 'year', type: 'number' },
        { name: 'vin_number', type: 'string' },
        { name: 'vehicle_type', type: 'string' },
        { name: 'fuel_type', type: 'string' },
        { name: 'tank_capacity', type: 'number' },
        { name: 'license_disk_expiry', type: 'string' },
        { name: 'license_code_required', type: 'string' },
        { name: 'initial_odometer_reading', type: 'number' },
        { name: 'average_fuel_consumption_per_100km', type: 'number' },
        { name: 'last_service_date', type: 'string' },
        { name: 'service_interval_km', type: 'number' },
        { name: 'last_service_km_reading', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'deleted_at', type: 'string' },
        { name: 'created_at', type: 'string' },
      ],
      'drivers': [
        { name: 'organization_id', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'first_name', type: 'string' },
        { name: 'surname', type: 'string' },
        { name: 'id_number', type: 'string' },
        { name: 'date_of_birth', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'address_line_1', type: 'string' },
        { name: 'address_line_2', type: 'string' },
        { name: 'city', type: 'string' },
        { name: 'province', type: 'string' },
        { name: 'postal_code', type: 'string' },
        { name: 'license_number', type: 'string' },
        { name: 'license_type', type: 'string' },
        { name: 'license_issue_date', type: 'string' },
        { name: 'license_expiry_date', type: 'string' },
        { name: 'license_restrictions', type: 'string' },
        { name: 'has_prdp', type: 'boolean' },
        { name: 'prdp_type', type: 'string' },
        { name: 'prdp_expiry_date', type: 'string' },
        { name: 'medical_certificate_on_file', type: 'boolean' },
        { name: 'status', type: 'string' },
        { name: 'last_login_at', type: 'string' },
        { name: 'created_at', type: 'string' },
        { name: 'updated_at', type: 'string' },
      ],
      'vehicle_exceptions': [
        { name: 'organization_id', type: 'string' },
        { name: 'vehicle_id', type: 'string' },
        { name: 'driver_id', type: 'string' },
        { name: 'transaction_id', type: 'string' },
        { name: 'exception_type', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'expected_value', type: 'string' },
        { name: 'actual_value', type: 'string' },
        { name: 'resolved', type: 'boolean' },
        { name: 'resolved_at', type: 'string' },
        { name: 'resolved_by', type: 'string' },
        { name: 'resolution_notes', type: 'string' },
        { name: 'created_at', type: 'string' },
        { name: 'updated_at', type: 'string' },
      ],
      'garages': [
        { name: 'name', type: 'string' },
        { name: 'address_line_1', type: 'string' },
        { name: 'address_line_2', type: 'string' },
        { name: 'city', type: 'string' },
        { name: 'province', type: 'string' },
        { name: 'postal_code', type: 'string' },
        { name: 'country', type: 'string' },
        { name: 'email_address', type: 'string' },
        { name: 'fuel_brand', type: 'string' },
        { name: 'fuel_types', type: 'string' },
        { name: 'price_zone', type: 'string' },
        { name: 'commission_rate', type: 'number' },
        { name: 'bank_name', type: 'string' },
        { name: 'account_holder', type: 'string' },
        { name: 'account_number', type: 'string' },
        { name: 'branch_code', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'string' },
      ],
      'organizations': [
        { name: 'name', type: 'string' },
        { name: 'company_registration_number', type: 'string' },
        { name: 'vat_number', type: 'string' },
        { name: 'website', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'address_line_1', type: 'string' },
        { name: 'address_line_2', type: 'string' },
        { name: 'city', type: 'string' },
        { name: 'province', type: 'string' },
        { name: 'postal_code', type: 'string' },
        { name: 'country', type: 'string' },
        { name: 'monthly_fee_per_vehicle', type: 'number' },
        { name: 'month_end_day', type: 'string' },
        { name: 'year_end_month', type: 'string' },
        { name: 'year_end_day', type: 'string' },
        { name: 'bank_name', type: 'string' },
        { name: 'bank_account_holder', type: 'string' },
        { name: 'bank_account_number', type: 'string' },
        { name: 'bank_branch_code', type: 'string' },
        { name: 'bank_account_type', type: 'string' },
        { name: 'bank_name_2', type: 'string' },
        { name: 'bank_account_holder_2', type: 'string' },
        { name: 'bank_account_number_2', type: 'string' },
        { name: 'bank_branch_code_2', type: 'string' },
        { name: 'bank_account_type_2', type: 'string' },
        { name: 'billing_contact_phone', type: 'string' },
        { name: 'daily_spending_limit', type: 'number' },
        { name: 'monthly_spending_limit', type: 'number' },
        { name: 'is_management_org', type: 'boolean' },
        { name: 'parent_org_id', type: 'string' },
        { name: 'payment_method', type: 'string' },
        { name: 'payment_date', type: 'number' },
        { name: 'payment_terms', type: 'string' },
        { name: 'late_payment_interest_rate', type: 'number' },
        { name: 'enable_prorata_billing', type: 'boolean' },
        { name: 'vat_reporting_basis', type: 'string' },
        { name: 'debit_order_lead_days', type: 'number' },
        { name: 'payment_method_changed_at', type: 'string' },
        { name: 'previous_payment_method', type: 'string' },
        { name: 'credit_control_enabled', type: 'boolean' },
        { name: 'suspend_services_after_days', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'string' },
      ],
      'daily_eft_batches': [
        { name: 'organization_id', type: 'string' },
        { name: 'batch_date', type: 'string' },
        { name: 'total_amount', type: 'number' },
        { name: 'total_commission', type: 'number' },
        { name: 'total_transactions', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'processed_at', type: 'string' },
      ],
      'eft_batch_items': [
        { name: 'batch_id', type: 'string' },
        { name: 'garage_id', type: 'string' },
        { name: 'transaction_count', type: 'number' },
        { name: 'gross_amount', type: 'number' },
        { name: 'commission_amount', type: 'number' },
        { name: 'net_amount', type: 'number' },
      ],
      'profiles': [
        { name: 'organization_id', type: 'string' },
        { name: 'full_name', type: 'string' },
        { name: 'role', type: 'string' },
      ],
      'organization_users': [
        { name: 'organization_id', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'first_name', type: 'string' },
        { name: 'surname', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'mobile_number', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'can_add_vehicles', type: 'boolean' },
        { name: 'can_edit_vehicles', type: 'boolean' },
        { name: 'can_delete_vehicles', type: 'boolean' },
        { name: 'can_add_drivers', type: 'boolean' },
        { name: 'can_edit_drivers', type: 'boolean' },
        { name: 'can_delete_drivers', type: 'boolean' },
        { name: 'can_view_reports', type: 'boolean' },
        { name: 'can_manage_users', type: 'boolean' },
        { name: 'can_manage_garages', type: 'boolean' },
        { name: 'can_process_eft', type: 'boolean' },
        { name: 'can_view_financial_info', type: 'boolean' },
        { name: 'can_edit_financial_info', type: 'boolean' },
        { name: 'can_edit_organization_info', type: 'boolean' },
        { name: 'can_view_fuel_transactions', type: 'boolean' },
        { name: 'can_create_reports', type: 'boolean' },
        { name: 'can_view_custom_reports', type: 'boolean' },
        { name: 'can_view_financial_data', type: 'boolean' },
        { name: 'is_main_user', type: 'boolean' },
        { name: 'is_secondary_main_user', type: 'boolean' },
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'string' },
        { name: 'updated_at', type: 'string' },
      ],
    };

    let columns = columnMap[tableName] || [];

    // Filter out confidential columns for client organizations
    if (filterForClient) {
      if (tableName === 'fuel_transactions') {
        columns = columns.filter(col =>
          !['commission_rate', 'commission_amount', 'net_amount', 'organization_id'].includes(col.name)
        );
      } else if (['vehicles', 'drivers', 'vehicle_exceptions', 'profiles', 'organization_users'].includes(tableName)) {
        // Remove organization_id from other tables for client organizations
        columns = columns.filter(col => col.name !== 'organization_id');
      }
    }

    return columns;
  };

  const loadSavedReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('custom_report_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const templates: ReportTemplate[] = data.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          table: t.table_name,
          columns: t.columns as string[],
          filters: t.filters as Filter[],
          sortOrders: t.sort_orders as SortOrder[]
        }));
        setSavedReports(templates);
      }
    } catch (err) {
      console.error('Error loading saved reports:', err);
    }
  };

  const getCurrentTableColumns = (): TableColumn[] => {
    const table = tables.find(t => t.tableName === selectedTable);
    return table?.columns || [];
  };

  const addFilter = () => {
    const columns = getCurrentTableColumns();
    if (columns.length === 0) return;

    setFilters([...filters, {
      id: Math.random().toString(36).substr(2, 9),
      column: columns[0].name,
      operator: 'eq',
      value: ''
    }]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, field: keyof Filter, value: string) => {
    setFilters(filters.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const addSortOrder = () => {
    const columns = getCurrentTableColumns();
    if (columns.length === 0) return;

    setSortOrders([...sortOrders, {
      id: Math.random().toString(36).substr(2, 9),
      column: '',
      direction: 'asc'
    }]);
  };

  const removeSortOrder = (id: string) => {
    setSortOrders(sortOrders.filter(s => s.id !== id));
  };

  const updateSortOrder = (id: string, field: keyof SortOrder, value: string) => {
    setSortOrders(sortOrders.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const toggleColumn = (columnName: string) => {
    if (selectedColumns.includes(columnName)) {
      setSelectedColumns(selectedColumns.filter(c => c !== columnName));
    } else {
      setSelectedColumns([...selectedColumns, columnName]);
    }
  };

  const runReport = async () => {
    if (!selectedTable || selectedColumns.length === 0) {
      setError('Please select a table and at least one column');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

      // Check if user is in management organization
      const { data: userOrg } = await supabase
        .from('organizations')
        .select('is_management_org, organization_type')
        .eq('id', profile?.organization_id)
        .maybeSingle();

      const isManagementUser = userOrg?.is_management_org === true && userOrg?.organization_type === 'management';

      let accessibleOrgIds = [profile?.organization_id];

      if (isManagementUser) {
        // Management users can access all client organizations
        const { data: allClientOrgs } = await supabase
          .from('organizations')
          .select('id')
          .eq('organization_type', 'client');

        if (allClientOrgs && allClientOrgs.length > 0) {
          accessibleOrgIds = allClientOrgs.map(org => org.id);
        }
      }

      let selectQuery = buildSelectQuery(selectedColumns);
      console.log('Select query:', selectQuery);
      console.log('Selected table:', selectedTable);
      console.log('User profile:', profile);
      console.log('Accessible org IDs:', accessibleOrgIds);

      let query = supabase
        .from(selectedTable)
        .select(selectQuery);

      if (profile?.role !== 'super_admin') {
        if (selectedTable === 'fuel_transactions' ||
            selectedTable === 'vehicles' ||
            selectedTable === 'drivers' ||
            selectedTable === 'vehicle_exceptions' ||
            selectedTable === 'garages' ||
            selectedTable === 'daily_eft_batches') {
          console.log('Adding organization filter:', accessibleOrgIds);
          query = query.in('organization_id', accessibleOrgIds);
        } else if (selectedTable === 'eft_batch_items') {
          const { data: batches } = await supabase
            .from('daily_eft_batches')
            .select('id')
            .in('organization_id', accessibleOrgIds);
          if (batches && batches.length > 0) {
            query = query.in('batch_id', batches.map(b => b.id));
          } else {
            query = query.eq('batch_id', '00000000-0000-0000-0000-000000000000');
          }
        } else if (selectedTable === 'organizations') {
          query = query.in('id', accessibleOrgIds);
        } else if (selectedTable === 'profiles') {
          query = query.in('organization_id', accessibleOrgIds);
        }
      }

      for (const filter of filters) {
        if (filter.value) {
          switch (filter.operator) {
            case 'eq':
              query = query.eq(filter.column, filter.value);
              break;
            case 'neq':
              query = query.neq(filter.column, filter.value);
              break;
            case 'gt':
              query = query.gt(filter.column, filter.value);
              break;
            case 'gte':
              query = query.gte(filter.column, filter.value);
              break;
            case 'lt':
              query = query.lt(filter.column, filter.value);
              break;
            case 'lte':
              query = query.lte(filter.column, filter.value);
              break;
            case 'like':
              query = query.ilike(filter.column, `%${filter.value}%`);
              break;
          }
        }
      }

      const dbSortOrders = sortOrders.filter(s => !s.column.startsWith('_calc_'));
      const calcSortOrders = sortOrders.filter(s => s.column.startsWith('_calc_'));

      for (const sort of dbSortOrders) {
        if (sort.column) {
          query = query.order(sort.column, { ascending: sort.direction === 'asc' });
        }
      }

      query = query.limit(1000);

      const { data, error: queryError } = await query;

      console.log('Query result - data:', data);
      console.log('Query result - error:', queryError);

      if (queryError) throw queryError;

      let processedData = processReportData(data || []);

      if (calcSortOrders.length > 0) {
        processedData.sort((a, b) => {
          for (const sort of calcSortOrders) {
            const aVal = a[sort.column] ?? null;
            const bVal = b[sort.column] ?? null;

            if (aVal === null && bVal === null) continue;
            if (aVal === null) return sort.direction === 'asc' ? 1 : -1;
            if (bVal === null) return sort.direction === 'asc' ? -1 : 1;

            const numA = parseFloat(aVal);
            const numB = parseFloat(bVal);

            if (numA < numB) return sort.direction === 'asc' ? -1 : 1;
            if (numA > numB) return sort.direction === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }

      console.log('Processed data:', processedData);
      setReportData(processedData);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Failed to run report');
      console.error('Report error:', err);
    } finally {
      setLoading(false);
    }
  };

  const buildSelectQuery = (columns: string[]): string => {
    const columnsWithJoins: string[] = [];

    // Check if we need to fetch vehicle data for _vehicle_* columns
    const needsVehicleData = columns.some(c => c.startsWith('_vehicle_'));

    for (const col of columns) {
      if (col.startsWith('_calc_') || col.startsWith('_vehicle_')) {
        continue;
      }

      if (col === 'vehicle_id') {
        columnsWithJoins.push('vehicle_id,vehicles!vehicle_id(registration_number,make,model)');
      } else if (col === 'driver_id') {
        columnsWithJoins.push('driver_id,drivers!driver_id(first_name,surname)');
      } else if (col === 'garage_id') {
        columnsWithJoins.push('garage_id,garages!garage_id(name)');
      } else if (col === 'organization_id') {
        columnsWithJoins.push('organization_id,organizations!organization_id(name)');
      } else if (col === 'transaction_id') {
        columnsWithJoins.push('transaction_id,fuel_transactions!transaction_id(transaction_date,total_amount)');
      } else if (col === 'resolved_by') {
        columnsWithJoins.push('resolved_by,profiles!resolved_by(full_name)');
      } else if (col === 'fuel_card_id') {
        columnsWithJoins.push('fuel_card_id');
      } else {
        columnsWithJoins.push(col);
      }
    }

    // If we need vehicle data but vehicle_id wasn't selected, add it without displaying
    if (needsVehicleData && !columns.includes('vehicle_id')) {
      columnsWithJoins.push('vehicle_id,vehicles!vehicle_id(registration_number,make,model)');
    }

    const needsOdometer = columns.some(c => c.startsWith('_calc_'));
    if (needsOdometer && selectedTable === 'fuel_transactions') {
      if (!columnsWithJoins.includes('odometer_reading')) {
        columnsWithJoins.push('odometer_reading');
      }
      if (!columnsWithJoins.includes('previous_odometer_reading')) {
        columnsWithJoins.push('previous_odometer_reading');
      }
      if (!columnsWithJoins.includes('liters')) {
        columnsWithJoins.push('liters');
      }
      if (!columnsWithJoins.includes('total_amount')) {
        columnsWithJoins.push('total_amount');
      }
    }

    return columnsWithJoins.join(',');
  };

  const processReportData = (data: any[]): any[] => {
    return data.map(row => {
      const processedRow: any = {};

      for (const key of Object.keys(row)) {
        if (key === 'vehicles' && row.vehicles) {
          processedRow['vehicle_id'] = row.vehicles.registration_number || 'N/A';
          if (selectedColumns.includes('_vehicle_registration')) {
            processedRow['_vehicle_registration'] = row.vehicles.registration_number || 'N/A';
          }
          if (selectedColumns.includes('_vehicle_make')) {
            processedRow['_vehicle_make'] = row.vehicles.make || 'N/A';
          }
          if (selectedColumns.includes('_vehicle_model')) {
            processedRow['_vehicle_model'] = row.vehicles.model || 'N/A';
          }
        } else if (key === 'drivers' && row.drivers) {
          processedRow['driver_id'] = `${row.drivers.first_name} ${row.drivers.surname}`.trim() || 'N/A';
        } else if (key === 'garages' && row.garages) {
          processedRow['garage_id'] = row.garages.name || 'N/A';
        } else if (key === 'organizations' && row.organizations) {
          processedRow['organization_id'] = row.organizations.name || 'N/A';
        } else if (key === 'fuel_transactions' && row.fuel_transactions) {
          processedRow['transaction_id'] = row.fuel_transactions.transaction_date
            ? `${new Date(row.fuel_transactions.transaction_date).toLocaleDateString()} - R${row.fuel_transactions.total_amount || 0}`
            : 'N/A';
        } else if (key === 'profiles' && row.profiles) {
          processedRow['resolved_by'] = row.profiles.full_name || 'N/A';
        } else if (key === 'fuel_types' && Array.isArray(row[key])) {
          processedRow[key] = row[key].join(', ');
        } else if (typeof row[key] === 'boolean') {
          processedRow[key] = row[key] ? 'Yes' : 'No';
        } else {
          processedRow[key] = row[key];
        }
      }

      if (selectedTable === 'fuel_transactions') {
        if (selectedColumns.includes('_calc_distance_traveled')) {
          const current = row.odometer_reading;
          const previous = row.previous_odometer_reading;
          processedRow['_calc_distance_traveled'] = (current && previous) ? current - previous : null;
        }

        if (selectedColumns.includes('_calc_fuel_efficiency')) {
          const current = row.odometer_reading;
          const previous = row.previous_odometer_reading;
          const liters = row.liters;
          if (current && previous && liters && liters > 0) {
            const distance = current - previous;
            processedRow['_calc_fuel_efficiency'] = (distance / liters).toFixed(2);
          } else {
            processedRow['_calc_fuel_efficiency'] = null;
          }
        }

        if (selectedColumns.includes('_calc_cost_per_km')) {
          const current = row.odometer_reading;
          const previous = row.previous_odometer_reading;
          const totalAmount = row.total_amount;
          if (current && previous && totalAmount) {
            const distance = current - previous;
            processedRow['_calc_cost_per_km'] = distance > 0 ? (totalAmount / distance).toFixed(2) : null;
          } else {
            processedRow['_calc_cost_per_km'] = null;
          }
        }
      }

      return processedRow;
    });
  };

  const getReadableColumnName = (columnName: string): string => {
    const columnNameMap: Record<string, string> = {
      'vehicle_id': 'Vehicle',
      'driver_id': 'Driver',
      'garage_id': 'Garage',
      'organization_id': 'Organization',
      'user_id': 'User ID',
      'fuel_card_id': 'Fuel Card ID',
      'eft_batch_id': 'EFT Batch ID',
      'nfc_payment_transaction_id': 'NFC Payment Transaction ID',
      'transaction_date': 'Transaction Date',
      'authorized_at': 'Authorized At',
      'payment_completed_at': 'Payment Completed At',
      'created_at': 'Transaction Date & Time',
      'updated_at': 'Updated At',
      'registration_number': 'Registration Number',
      'driver_name': 'Driver Name',
      'make': 'Make',
      'model': 'Model',
      'year': 'Year',
      'first_name': 'First Name',
      'surname': 'Surname',
      'id_number': 'ID Number',
      'date_of_birth': 'Date of Birth',
      'fuel_type': 'Fuel Type',
      'vehicle_type': 'Vehicle Type',
      'tank_capacity': 'Tank Capacity (L)',
      'license_code_required': 'License Code Required',
      'price_per_liter': 'Price per Liter',
      'price_per_gallon': 'Price per Liter',
      'total_amount': 'Total Amount',
      'net_amount': 'Net Amount',
      'commission_amount': 'Commission Amount',
      'commission_rate': 'Commission Rate',
      'odometer_reading': 'Odometer Reading (km)',
      'previous_odometer_reading': 'Previous Odometer Reading (km)',
      'initial_odometer_reading': 'Initial Odometer Reading (km)',
      'average_fuel_consumption_per_100km': 'Average Fuel Consumption per 100km',
      'last_service_date': 'Last Service Date',
      'service_interval_km': 'Service Interval (km)',
      'last_service_km_reading': 'Last Service KM Reading',
      'liters': 'Liters',
      'location': 'Location',
      'license_disk_image': 'License Disk Image',
      'number_plate_image': 'Number Plate Image',
      'verified': 'Verified',
      'payment_status': 'Payment Status',
      'vin_number': 'VIN Number',
      'is_active': 'Active',
      'is_main_user': 'Main User',
      'is_secondary_main_user': 'Secondary Main User',
      'is_management_org': 'Management Organization',
      'deleted_at': 'Deleted At',
      'last_login_at': 'Last Login At',
      'license_number': 'License Number',
      'license_type': 'License Type',
      'license_issue_date': 'License Issue Date',
      'license_expiry_date': 'License Expiry Date',
      'license_disk_expiry': 'License Disk Expiry',
      'license_restrictions': 'License Restrictions',
      'has_prdp': 'Has PrDP',
      'prdp_type': 'PrDP Type',
      'prdp_expiry_date': 'PrDP Expiry Date',
      'medical_certificate_on_file': 'Medical Certificate on File',
      'fuel_types': 'Fuel Types',
      'phone_number': 'Phone Number',
      'mobile_number': 'Mobile Number',
      'email': 'Email',
      'address': 'Address',
      'address_line_1': 'Address Line 1',
      'address_line_2': 'Address Line 2',
      'city': 'City',
      'province': 'Province',
      'state': 'State',
      'postal_code': 'Postal Code',
      'zip_code': 'Zip Code',
      'country': 'Country',
      'contact_person': 'Contact Person',
      'bank_name': 'Bank Name',
      'bank_account_holder': 'Bank Account Holder',
      'bank_account_number': 'Bank Account Number',
      'bank_branch_code': 'Bank Branch Code',
      'bank_account_type': 'Bank Account Type',
      'bank_name_2': 'Bank Name (2nd Account)',
      'bank_account_holder_2': 'Bank Account Holder (2nd)',
      'bank_account_number_2': 'Bank Account Number (2nd)',
      'bank_branch_code_2': 'Bank Branch Code (2nd)',
      'bank_account_type_2': 'Bank Account Type (2nd)',
      'account_number': 'Account Number',
      'branch_code': 'Branch Code',
      'billing_contact_phone': 'Billing Contact Phone',
      'monthly_fee_per_vehicle': 'Monthly Fee per Vehicle',
      'month_end_day': 'Month End Day',
      'year_end_month': 'Year End Month',
      'year_end_day': 'Year End Day',
      'daily_spending_limit': 'Daily Spending Limit',
      'monthly_spending_limit': 'Monthly Spending Limit',
      'parent_org_id': 'Parent Organization ID',
      'payment_method': 'Payment Method',
      'payment_date': 'Payment Date',
      'payment_terms': 'Payment Terms',
      'late_payment_interest_rate': 'Late Payment Interest Rate',
      'enable_prorata_billing': 'Enable Pro-rata Billing',
      'vat_reporting_basis': 'VAT Reporting Basis',
      'debit_order_lead_days': 'Debit Order Lead Days',
      'payment_method_changed_at': 'Payment Method Changed At',
      'previous_payment_method': 'Previous Payment Method',
      'credit_control_enabled': 'Credit Control Enabled',
      'suspend_services_after_days': 'Suspend Services After Days',
      'company_registration_number': 'Company Registration Number',
      'vat_number': 'VAT Number',
      'website': 'Website',
      'role': 'Role',
      'title': 'Title',
      'can_add_vehicles': 'Can Add Vehicles',
      'can_edit_vehicles': 'Can Edit Vehicles',
      'can_delete_vehicles': 'Can Delete Vehicles',
      'can_add_drivers': 'Can Add Drivers',
      'can_edit_drivers': 'Can Edit Drivers',
      'can_delete_drivers': 'Can Delete Drivers',
      'can_view_reports': 'Can View Reports',
      'can_manage_users': 'Can Manage Users',
      'can_manage_garages': 'Can Manage Garages',
      'can_process_eft': 'Can Process EFT',
      'can_view_financial_info': 'Can View Financial Info',
      'can_edit_financial_info': 'Can Edit Financial Info',
      'can_edit_organization_info': 'Can Edit Organization Info',
      'can_view_fuel_transactions': 'Can View Fuel Transactions',
      'can_create_reports': 'Can Create Reports',
      'can_view_custom_reports': 'Can View Custom Reports',
      'can_view_financial_data': 'Can View Financial Data',
      'batch_date': 'Batch Date',
      'total_transactions': 'Total Transactions',
      'status': 'Status',
      'processed_at': 'Processed At',
      'notes': 'Notes',
      'transaction_count': 'Transaction Count',
      'gross_amount': 'Gross Amount',
      '_calc_distance_traveled': 'Distance Traveled (km)',
      '_calc_fuel_efficiency': 'Fuel Efficiency (km/L)',
      '_calc_cost_per_km': 'Cost per km (R)',
      '_vehicle_registration': 'Vehicle Registration Number',
      '_vehicle_make': 'Vehicle Make',
      '_vehicle_model': 'Vehicle Model',
      'total_commission': 'Total Commission',
      'batch_id': 'Batch ID',
      'exception_type': 'Exception Type',
      'description': 'Description',
      'expected_value': 'Expected Value',
      'actual_value': 'Actual Value',
      'resolved': 'Resolved',
      'resolved_at': 'Resolved At',
      'resolved_by': 'Resolved By',
      'resolution_notes': 'Resolution Notes',
      'transaction_id': 'Transaction ID',
    };

    return columnNameMap[columnName] || columnName.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const saveReport = async () => {
    if (!reportName || !selectedTable || selectedColumns.length === 0) {
      setError('Please provide a report name, select a table, and choose columns');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organization not found');

      const { data, error } = await supabase
        .from('custom_report_templates')
        .insert([{
          organization_id: profile.organization_id,
          user_id: user.id,
          name: reportName,
          description: reportDescription || '',
          table_name: selectedTable,
          columns: selectedColumns,
          filters: filters,
          sort_orders: sortOrders
        }])
        .select()
        .single();

      if (error) throw error;

      await loadSavedReports();

      alert('Report template saved successfully!');
      setReportName('');
      setReportDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to save report');
    }
  };

  const loadReport = (template: ReportTemplate) => {
    setSelectedTable(template.table);
    setSelectedColumns(template.columns);
    setFilters(template.filters);
    setSortOrders(template.sortOrders || []);
    setReportName(template.name);
    setReportDescription(template.description);
    setShowSavedReports(false);
  };

  const deleteReport = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_report_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadSavedReports();
      alert('Report template deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete report');
    }
  };

  const exportToCSV = () => {
    if (reportData.length === 0) return;

    const headers = selectedColumns.map(col => getReadableColumnName(col)).join(',');
    const rows = reportData.map(row =>
      selectedColumns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName || 'report'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (showSavedReports) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Saved Report Templates</h2>
            </div>
            <button
              onClick={() => setShowSavedReports(false)}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            {savedReports.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No saved reports yet</p>
            ) : (
              savedReports.map(report => (
                <div key={report.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-600">{report.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Table: {report.table} | Columns: {report.columns.length} | Filters: {report.filters.length} | Sort: {report.sortOrders?.length || 0}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadReport(report)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteReport(report.id!)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showPreview) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Report Results</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Back to Builder
              </button>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Showing {reportData.length} records from <span className="font-semibold">{tables.find(t => t.tableName === selectedTable)?.displayName || selectedTable}</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  {selectedColumns.map(col => (
                    <th key={col} className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-900">
                      {getReadableColumnName(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {selectedColumns.map(col => (
                      <td key={col} className="border border-gray-300 px-4 py-2 text-sm text-gray-700">
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reportData.length === 0 && (
            <p className="text-gray-500 text-center py-8">No data found</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 -my-6">
      <div className="sticky top-0 z-20 bg-white -mx-4 px-4 py-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Custom Report Builder</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSavedReports(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <FolderOpen className="w-4 h-4" />
              Saved Reports ({savedReports.length})
            </button>
            {onNavigate && (
              <button
                onClick={() => onNavigate('reports-menu')}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Reports Menu
              </button>
            )}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h3 className="font-semibold text-blue-900 mb-2 text-sm">Report Builder Guide</h3>
          <ul className="space-y-1 text-blue-800 text-xs">
            <li>• <strong>Fuel Transactions</strong> - Complete fuel purchase data including drivers, vehicles, garages, and consumption</li>
            <li>• Select columns like "Driver", "Garage", "Liters", and "Odometer Reading" to analyze fuel usage patterns</li>
            <li>• Use filters to narrow down data by date range, driver, vehicle, or garage</li>
            <li>• Export to CSV to calculate metrics like average km/liter in Excel</li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                placeholder="e.g., Monthly Fuel Report"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                placeholder="e.g., All fuel transactions for the month"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Table</label>
            <select
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value);
                setSelectedColumns([]);
                setFilters([]);
              }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="">Choose a table...</option>
              {tables.map(table => (
                <option key={table.tableName} value={table.tableName}>
                  {table.displayName}
                </option>
              ))}
            </select>
          </div>

          {selectedTable && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Columns</label>
                <div className="grid grid-cols-3 gap-2 border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
                  {getCurrentTableColumns().map(col => (
                    <label key={col.name} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(col.name)}
                        onChange={() => toggleColumn(col.name)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{getReadableColumnName(col.name)}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">Selected: {selectedColumns.length} columns</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Filters</label>
                  <button
                    onClick={addFilter}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Filter
                  </button>
                </div>

                <div className="space-y-2">
                  {filters.map(filter => (
                    <div key={filter.id} className="flex gap-2 items-center">
                      <select
                        value={filter.column}
                        onChange={(e) => updateFilter(filter.id, 'column', e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        {getCurrentTableColumns().map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>

                      <select
                        value={filter.operator}
                        onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="eq">Equals</option>
                        <option value="neq">Not Equals</option>
                        <option value="gt">Greater Than</option>
                        <option value="gte">Greater or Equal</option>
                        <option value="lt">Less Than</option>
                        <option value="lte">Less or Equal</option>
                        <option value="like">Contains</option>
                      </select>

                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Value"
                      />

                      <button
                        onClick={() => removeFilter(filter.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {filters.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No filters applied</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Sort Order</label>
                  <button
                    onClick={addSortOrder}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Sort
                  </button>
                </div>

                <div className="space-y-2">
                  {sortOrders.map((sort, index) => (
                    <div key={sort.id} className="flex gap-2 items-center">
                      <span className="text-sm text-gray-600 font-medium w-8">{index + 1}.</span>
                      <select
                        value={sort.column}
                        onChange={(e) => updateSortOrder(sort.id, 'column', e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select column...</option>
                        {getCurrentTableColumns().map(col => (
                          <option key={col.name} value={col.name}>{getReadableColumnName(col.name)}</option>
                        ))}
                      </select>

                      <select
                        value={sort.direction}
                        onChange={(e) => updateSortOrder(sort.id, 'direction', e.target.value as 'asc' | 'desc')}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                      </select>

                      <button
                        onClick={() => removeSortOrder(sort.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {sortOrders.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No sorting applied</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={runReport}
                  disabled={loading || selectedColumns.length === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Play className="w-5 h-5" />
                  {loading ? 'Running...' : 'Run Report'}
                </button>

                <button
                  onClick={saveReport}
                  disabled={!reportName || selectedColumns.length === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  Save Template
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
