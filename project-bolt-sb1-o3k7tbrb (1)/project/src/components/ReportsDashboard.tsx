import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFuelTypeDisplayName } from '../lib/fuelTypes';
import { BarChart3, Download, Calendar, TrendingUp, AlertTriangle, FileText, ArrowLeft, Wrench, AlertCircle, MapPin, CheckCircle, TruckIcon, MessageSquare } from 'lucide-react';
import DailyTripReport from './DailyTripReport';
import UnreturnedVehiclesReport from './UnreturnedVehiclesReport';
import VehicleReturnNotesReport from './VehicleReturnNotesReport';

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: any;
}

interface ReportsDashboardProps {
  onNavigate?: (view: string | null) => void;
}

export default function ReportsDashboard({ onNavigate }: ReportsDashboardProps) {
  const [selectedReport, setSelectedReport] = useState<string>('daily-trip-report');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [resolvingException, setResolvingException] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Helper to create ISO timestamp from date string without timezone conversion
  const createLocalDateString = (dateStr: string, endOfDay = false) => {
    // Use date string directly with time component to avoid timezone conversion
    return endOfDay
      ? `${dateStr}T23:59:59.999Z`
      : `${dateStr}T00:00:00.000Z`;
  };

  const reportTypes: ReportType[] = [
    { id: 'daily-trip-report', name: 'Daily Trip Report', description: 'View daily vehicle usage, KM travelled, and trip descriptions', icon: TruckIcon },
    { id: 'unreturned-vehicles', name: 'Vehicles Not Returned', description: 'Vehicles drawn on a specific day that were never returned', icon: AlertTriangle },
    { id: 'return-notes', name: 'Vehicle Return Notes', description: 'Driver notes submitted at vehicle return — conditions, issues, trip feedback', icon: MessageSquare },
    { id: 'overview', name: 'Fuel Transactions', description: 'General fuel purchase statistics', icon: BarChart3 },
    { id: 'fuel-theft', name: 'Fuel Theft Alerts', description: 'Anomalies and suspicious patterns', icon: AlertTriangle },
    { id: 'driver', name: 'Driver Reports', description: 'Performance and usage by driver', icon: FileText },
    { id: 'exceptions', name: 'Vehicle Exception Report', description: 'Unresolved exceptions only (use Custom Report Builder for historical analysis)', icon: AlertCircle },
    { id: 'vehicle', name: 'Vehicle Reports', description: 'Efficiency and usage by vehicle', icon: TrendingUp },
    { id: 'vehicles-to-service', name: 'Vehicles to be Serviced', description: 'Vehicles within 1000 km of service', icon: Wrench },
    { id: 'service-due', name: 'Next Service Due Date', description: 'Estimated service due dates for vehicles', icon: Wrench },
    { id: 'vehicles-overdue-service', name: 'Vehicles Overdue for Service', description: 'Vehicles that exceeded service interval', icon: AlertCircle },
    { id: 'monthly', name: 'Monthly Summary', description: 'Month-end consolidated reports', icon: Calendar },
    { id: 'annual', name: 'Annual Summary', description: 'Year-end consolidated reports', icon: Calendar },
  ];


  useEffect(() => {
    setReportData(null);
    setError('');
    loadOrganizationSettings();
  }, []);

  const loadOrganizationSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile error:', profileError);
        setError('Failed to load profile');
        return;
      }

      if (!profile) {
        setError('No profile found');
        return;
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .maybeSingle();

      if (orgError) {
        console.error('Organization error:', orgError);
        setError('Failed to load organization');
        return;
      }

      console.log('Organization Settings RAW:', org);
      console.log('is_management_org VALUE:', org?.is_management_org);
      console.log('is_management_org TYPE:', typeof org?.is_management_org);
      console.log('Truthy check:', !!org?.is_management_org);
      setOrgSettings(org || {});
    } catch (err: any) {
      console.error('Error loading organization settings:', err);
      setError(err.message);
    }
  };

  const loadReportData = async () => {
    console.log('=== LOAD REPORT DATA TRIGGERED ===');
    console.log('Selected Report:', selectedReport);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);

    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('No user found');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        setError('Error loading profile: ' + profileError.message);
        return;
      }

      if (!profile) {
        setError('No profile found');
        return;
      }

      switch (selectedReport) {
        case 'overview':
          await loadOverviewData(profile.organization_id, startDate, endDate);
          break;
        case 'driver':
          await loadDriverData(profile.organization_id, startDate, endDate);
          break;
        case 'vehicle':
          await loadVehicleData(profile.organization_id, startDate, endDate);
          break;
        case 'fuel-theft':
          await loadFuelTheftData(profile.organization_id, startDate, endDate);
          break;
        case 'exceptions':
          await loadExceptionsData(profile.organization_id, startDate, endDate);
          break;
        case 'service-due':
          await loadServiceDueData(profile.organization_id);
          break;
        case 'vehicles-to-service':
          await loadVehiclesToServiceData(profile.organization_id);
          break;
        case 'vehicles-overdue-service':
          await loadVehiclesOverdueServiceData(profile.organization_id);
          break;
        case 'monthly':
          await loadMonthlyData(profile.organization_id, startDate, endDate);
          break;
        case 'annual':
          await loadAnnualData(profile.organization_id, startDate, endDate);
          break;
      }
    } catch (err: any) {
      setError('Error loading report: ' + err.message);
      console.error('Report loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewData = async (orgId: string, start: string, end: string) => {
    const startDateTime = createLocalDateString(start);
    const endDateTime = createLocalDateString(end, true);

    console.log('=== DATE FILTER DEBUG ===');
    console.log('Start Date Input:', start);
    console.log('End Date Input:', end);
    console.log('Start DateTime Query:', startDateTime);
    console.log('End DateTime Query:', endDateTime);

    const { data: transactions, error } = await supabase
      .from('fuel_transactions')
      .select(`
        *,
        vehicles (registration_number, make, model),
        drivers (first_name, surname),
        garages (name)
      `)
      .eq('organization_id', orgId)
      .gte('transaction_date', startDateTime)
      .lte('transaction_date', endDateTime)
      .order('transaction_date', { ascending: false });

    console.log('Query Error:', error);
    console.log('Transactions Count:', transactions?.length);
    console.log('First Transaction Date:', transactions?.[0]?.transaction_date);
    console.log('Last Transaction Date:', transactions?.[transactions?.length - 1]?.transaction_date);

    const totalTransactions = transactions?.length || 0;
    const totalLiters = transactions?.reduce((sum, t) => sum + parseFloat(t.liters || 0), 0) || 0;
    const totalSpent = transactions?.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0) || 0;
    const totalCommission = transactions?.reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0) || 0;

    const formattedTransactions = transactions?.map(t => ({
      date: t.transaction_date,
      vehicle: t.vehicles ? `${t.vehicles.registration_number} (${t.vehicles.make} ${t.vehicles.model})` : 'Unknown',
      driver: t.drivers ? `${t.drivers.first_name} ${t.drivers.surname}` : 'Unknown',
      garage: t.garages?.name || 'Unknown',
      fuel_type: getFuelTypeDisplayName(t.fuel_type),
      liters: parseFloat(t.liters || 0),
      price_per_liter: parseFloat(t.price_per_liter || 0),
      amount: parseFloat(t.total_amount || 0),
      commission: parseFloat(t.commission_amount || 0),
      odometer: t.odometer_reading,
    }));

    setReportData({
      totalTransactions,
      totalLiters,
      totalSpent,
      totalCommission,
      averagePerTransaction: (totalSpent / totalTransactions || 0),
      transactions: formattedTransactions,
    });
  };

  const loadDriverData = async (orgId: string, start: string, end: string) => {
    const startDateTime = createLocalDateString(start);
    const endDateTime = createLocalDateString(end, true);

    console.log('=== DRIVER REPORT DATE FILTER ===');
    console.log('Start Date Input:', start);
    console.log('End Date Input:', end);
    console.log('Start DateTime Query:', startDateTime);
    console.log('End DateTime Query:', endDateTime);

    const { data: transactions } = await supabase
      .from('fuel_transactions')
      .select(`
        *,
        drivers (first_name, surname),
        vehicles (registration_number)
      `)
      .eq('organization_id', orgId)
      .gte('transaction_date', startDateTime)
      .lte('transaction_date', endDateTime);

    console.log('Driver Transactions Found:', transactions?.length);
    if (transactions && transactions.length > 0) {
      console.log('Transaction Dates:', transactions.map(t => ({
        date: t.transaction_date,
        driver: t.drivers ? `${t.drivers.first_name} ${t.drivers.surname}` : 'Unknown'
      })));
    }

    const driverStats: any = {};

    transactions?.forEach((t: any) => {
      const driverId = t.driver_id;
      if (!driverId || !t.drivers) return;

      if (!driverStats[driverId]) {
        driverStats[driverId] = {
          first_name: t.drivers.first_name,
          surname: t.drivers.surname,
          total_transactions: 0,
          vehicles_driven: new Set(),
          total_liters: 0,
          total_spent: 0,
        };
      }

      driverStats[driverId].total_transactions += 1;
      driverStats[driverId].vehicles_driven.add(t.vehicle_id);
      driverStats[driverId].total_liters += parseFloat(t.liters || 0);
      driverStats[driverId].total_spent += parseFloat(t.total_amount || 0);
    });

    const drivers = Object.values(driverStats).map((d: any) => ({
      ...d,
      vehicles_driven: d.vehicles_driven.size,
      average_transaction_amount: d.total_transactions > 0 ? d.total_spent / d.total_transactions : 0,
    }));

    setReportData({ drivers });
  };

  const loadVehicleData = async (orgId: string, start: string, end: string) => {
    const startDateTime = createLocalDateString(start);
    const endDateTime = createLocalDateString(end, true);

    console.log('=== VEHICLE REPORT DATE FILTER ===');
    console.log('Start Date Input:', start);
    console.log('End Date Input:', end);
    console.log('Start DateTime Query:', startDateTime);
    console.log('End DateTime Query:', endDateTime);

    // Get all vehicles for the organization
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .eq('organization_id', orgId);

    // Get all transactions with vehicle and driver details
    const { data: transactions } = await supabase
      .from('fuel_transactions')
      .select(`
        *,
        vehicles (registration_number, make, model),
        drivers (first_name, surname),
        garages (name)
      `)
      .eq('organization_id', orgId)
      .gte('transaction_date', startDateTime)
      .lte('transaction_date', endDateTime)
      .order('vehicle_id')
      .order('transaction_date', { ascending: false });

    console.log('Vehicle Transactions Found:', transactions?.length);

    // Group transactions by vehicle
    const vehicleData: any = {};

    transactions?.forEach((t: any) => {
      const vehicleId = t.vehicle_id;
      if (!vehicleData[vehicleId]) {
        vehicleData[vehicleId] = {
          vehicle_id: vehicleId,
          license_plate: t.vehicles?.registration_number || 'Unknown',
          make: t.vehicles?.make || '',
          model: t.vehicles?.model || '',
          transactions: [],
          total_liters: 0,
          total_amount: 0,
          total_commission: 0,
          transaction_count: 0,
          odometers: [],
        };
      }

      const liters = parseFloat(t.liters || 0);
      const amount = parseFloat(t.total_amount || 0);
      const commission = parseFloat(t.commission_amount || 0);

      vehicleData[vehicleId].transactions.push({
        date: t.transaction_date,
        driver: t.drivers ? `${t.drivers.first_name} ${t.drivers.surname}` : 'Unknown',
        garage: t.garages?.name || 'Unknown',
        fuel_type: getFuelTypeDisplayName(t.fuel_type),
        liters: liters,
        price_per_liter: parseFloat(t.price_per_liter || 0),
        amount: amount,
        commission: commission,
        odometer: t.odometer_reading,
      });

      vehicleData[vehicleId].total_liters += liters;
      vehicleData[vehicleId].total_amount += amount;
      vehicleData[vehicleId].total_commission += commission;
      vehicleData[vehicleId].transaction_count += 1;

      if (t.odometer_reading) {
        vehicleData[vehicleId].odometers.push(parseInt(t.odometer_reading));
      }
    });

    // Calculate km travelled and consumption for each vehicle
    Object.keys(vehicleData).forEach(vehicleId => {
      const vData = vehicleData[vehicleId];
      if (vData.odometers.length > 0) {
        const maxOdometer = Math.max(...vData.odometers);
        const minOdometer = Math.min(...vData.odometers);
        vData.km_travelled = maxOdometer - minOdometer;

        if (vData.km_travelled > 0) {
          vData.consumption_per_100km = (vData.total_liters / vData.km_travelled) * 100;
        } else {
          vData.consumption_per_100km = 0;
        }
      } else {
        vData.km_travelled = 0;
        vData.consumption_per_100km = 0;
      }
    });

    setReportData({ vehicleData: Object.values(vehicleData) });
  };

  const loadFuelTheftData = async (orgId: string, start: string, end: string) => {
    const startDateTime = createLocalDateString(start);
    const endDateTime = createLocalDateString(end, true);

    console.log('=== FUEL THEFT REPORT DATE FILTER ===');
    console.log('Start Date Input:', start);
    console.log('End Date Input:', end);
    console.log('Start DateTime Query:', startDateTime);
    console.log('End DateTime Query:', endDateTime);

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    const { data: transactions, error } = await supabase
      .from('fuel_transactions')
      .select('*')
      .eq('organization_id', orgId)
      .gte('transaction_date', startDateTime)
      .lte('transaction_date', endDateTime)
      .not('odometer_reading', 'is', null)
      .not('previous_odometer_reading', 'is', null);

    console.log('Fuel Theft Query Error:', error);
    console.log('Fuel Theft Transactions Found:', transactions?.length);

    const vehicleStats: any = {};

    transactions?.forEach((t: any) => {
      const vehicleId = t.vehicle_id;
      if (!vehicleStats[vehicleId]) {
        const vehicle = vehicles?.find(v => v.id === vehicleId);
        if (!vehicle) return;

        vehicleStats[vehicleId] = {
          license_plate: vehicle.registration_number,
          make: vehicle.make,
          model: vehicle.model,
          expected_consumption: parseFloat(vehicle.average_fuel_consumption_per_100km || 10),
          total_liters: 0,
          total_km: 0,
        };
      }

      const km = parseInt(t.odometer_reading) - parseInt(t.previous_odometer_reading);
      if (km > 0) {
        vehicleStats[vehicleId].total_liters += parseFloat(t.liters || 0);
        vehicleStats[vehicleId].total_km += km;
      }
    });

    const alerts = Object.values(vehicleStats)
      .filter((v: any) => v.total_km > 0)
      .map((v: any) => {
        const actual = (v.total_liters / v.total_km) * 100;
        const variance = ((actual - v.expected_consumption) / v.expected_consumption) * 100;
        return {
          vehicle: `${v.license_plate} (${v.make} ${v.model})`,
          expected: v.expected_consumption,
          actual: actual,
          variance: variance,
          severity: Math.abs(variance) > 50 ? 'High' : 'Medium',
        };
      })
      .filter((alert: any) => Math.abs(alert.variance) > 30);

    setReportData({ alerts });
  };

  const loadExceptionsData = async (orgId: string, start: string, end: string) => {
    const startDateTime = createLocalDateString(start);
    const endDateTime = createLocalDateString(end, true);

    console.log('=== EXCEPTIONS REPORT DATE FILTER ===');
    console.log('Start Date Input:', start);
    console.log('End Date Input:', end);
    console.log('Start DateTime Query:', startDateTime);
    console.log('End DateTime Query:', endDateTime);

    const { data: exceptions, error } = await supabase
      .from('vehicle_exceptions')
      .select(`
        *,
        vehicles (registration_number, make, model),
        drivers (first_name, surname),
        organizations (name, city)
      `)
      .eq('organization_id', orgId)
      .eq('resolved', false)
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime)
      .order('created_at', { ascending: false });

    console.log('Exceptions Query Error:', error);
    console.log('Exceptions Found:', exceptions?.length);

    const formattedExceptions = exceptions?.map(e => ({
      id: e.id,
      date: e.created_at,
      vehicle: e.vehicles ? `${e.vehicles.registration_number} (${e.vehicles.make} ${e.vehicles.model})` : 'Unknown',
      driver: e.drivers ? `${e.drivers.first_name} ${e.drivers.surname}` : 'Unknown',
      exception_type: e.exception_type,
      description: e.description,
      expected_value: e.expected_value,
      actual_value: e.actual_value,
      resolved: e.resolved,
      resolved_at: e.resolved_at,
      resolution_notes: e.resolution_notes,
      organization_name: e.organizations?.name || '',
      organization_city: e.organizations?.city || '',
    }));

    setReportData({ exceptions: formattedExceptions || [] });
  };

  const resolveException = async (exceptionId: string, notes: string) => {
    if (!notes || notes.trim() === '') {
      alert('Please enter resolution notes');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not authenticated');
        return;
      }

      const resolvedAt = new Date().toISOString();

      const { error } = await supabase
        .from('vehicle_exceptions')
        .update({
          resolved: true,
          resolved_at: resolvedAt,
          resolved_by: user.id,
          resolution_notes: notes,
        })
        .eq('id', exceptionId);

      if (error) {
        console.error('Error resolving exception:', error);
        alert(`Failed to resolve exception: ${error.message}`);
        return;
      }

      // Get the organization ID and reload the exceptions data
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.organization_id) {
        await loadExceptionsData(profile.organization_id, startDate, endDate);
      }

      // Reset the resolution modal
      setResolvingException(null);
      setResolutionNotes('');
    } catch (err: any) {
      console.error('Exception resolution error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyData = async (orgId: string, start: string, end: string) => {
    const monthEnd = orgSettings?.month_end_day || 31;
    const startDateTime = createLocalDateString(start);
    const endDateTime = createLocalDateString(end, true);

    console.log('=== MONTHLY REPORT DATE FILTER ===');
    console.log('Start Date Input:', start);
    console.log('End Date Input:', end);
    console.log('Start DateTime Query:', startDateTime);
    console.log('End DateTime Query:', endDateTime);

    const { data: transactions, error } = await supabase
      .from('fuel_transactions')
      .select(`
        *,
        vehicles (registration_number, make, model),
        drivers (first_name, surname),
        garages (name)
      `)
      .eq('organization_id', orgId)
      .gte('transaction_date', startDateTime)
      .lte('transaction_date', endDateTime);

    console.log('Monthly Query Error:', error);
    console.log('Monthly Transactions Found:', transactions?.length);
    if (transactions && transactions.length > 0) {
      console.log('First Transaction Date:', transactions[0].transaction_date);
      console.log('Last Transaction Date:', transactions[transactions.length - 1].transaction_date);
    }

    const formattedTransactions = transactions?.map(t => ({
      date: t.transaction_date,
      vehicle: t.vehicles ? `${t.vehicles.registration_number}` : 'Unknown',
      driver: t.drivers ? `${t.drivers.first_name} ${t.drivers.surname}` : 'Unknown',
      location: t.garages?.name || t.location || '-',
      fuel_type: getFuelTypeDisplayName(t.fuel_type),
      liters: t.liters,
      total_amount: t.total_amount,
    }));

    setReportData({ transactions: formattedTransactions, monthEnd });
  };

  const loadAnnualData = async (orgId: string, start: string, end: string) => {
    const yearEndMonth = orgSettings?.year_end_month || 12;
    const yearEndDay = orgSettings?.year_end_day || 31;
    const startDateTime = createLocalDateString(start);
    const endDateTime = createLocalDateString(end, true);

    console.log('=== ANNUAL REPORT DATE FILTER ===');
    console.log('Start Date Input:', start);
    console.log('End Date Input:', end);
    console.log('Start DateTime Query:', startDateTime);
    console.log('End DateTime Query:', endDateTime);

    const { data: transactions, error } = await supabase
      .from('fuel_transactions')
      .select(`
        *,
        vehicles (registration_number, make, model),
        drivers (first_name, surname),
        garages (name)
      `)
      .eq('organization_id', orgId)
      .gte('transaction_date', startDateTime)
      .lte('transaction_date', endDateTime);

    console.log('Annual Query Error:', error);
    console.log('Annual Transactions Found:', transactions?.length);

    const formattedTransactions = transactions?.map(t => ({
      date: t.transaction_date,
      vehicle: t.vehicles ? `${t.vehicles.registration_number}` : 'Unknown',
      driver: t.drivers ? `${t.drivers.first_name} ${t.drivers.surname}` : 'Unknown',
      location: t.garages?.name || t.location || '-',
      fuel_type: getFuelTypeDisplayName(t.fuel_type),
      liters: t.liters,
      total_amount: t.total_amount,
    }));

    setReportData({ transactions: formattedTransactions, yearEndMonth, yearEndDay });
  };

  const loadServiceDueData = async (orgId: string) => {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, registration_number, make, model, last_service_date, service_interval_km')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .not('last_service_date', 'is', null)
      .not('service_interval_km', 'is', null)
      .gt('service_interval_km', 0);

    if (!vehicles || vehicles.length === 0) {
      setReportData({ serviceDue: [] });
      return;
    }

    const serviceDueData = [];

    for (const vehicle of vehicles) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentTransactions } = await supabase
        .from('fuel_transactions')
        .select('odometer_reading, transaction_date')
        .eq('vehicle_id', vehicle.id)
        .not('odometer_reading', 'is', null)
        .gte('transaction_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('transaction_date', { ascending: false });

      if (!recentTransactions || recentTransactions.length < 2) {
        continue;
      }

      const { data: serviceTransaction } = await supabase
        .from('fuel_transactions')
        .select('odometer_reading')
        .eq('vehicle_id', vehicle.id)
        .not('odometer_reading', 'is', null)
        .lte('transaction_date', vehicle.last_service_date)
        .order('transaction_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      let lastServiceOdometer = serviceTransaction?.odometer_reading;

      if (!lastServiceOdometer) {
        const { data: firstTransaction } = await supabase
          .from('fuel_transactions')
          .select('odometer_reading')
          .eq('vehicle_id', vehicle.id)
          .not('odometer_reading', 'is', null)
          .order('transaction_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        lastServiceOdometer = firstTransaction?.odometer_reading;
      }

      if (!lastServiceOdometer) {
        continue;
      }

      const currentOdometer = parseInt(recentTransactions[0].odometer_reading);
      const oldestOdometer = parseInt(recentTransactions[recentTransactions.length - 1].odometer_reading);

      const daysBetween = Math.ceil(
        (new Date(recentTransactions[0].transaction_date).getTime() -
         new Date(recentTransactions[recentTransactions.length - 1].transaction_date).getTime()) /
        (1000 * 60 * 60 * 24)
      );

      if (daysBetween === 0) {
        continue;
      }

      const kmTravelled = currentOdometer - oldestOdometer;
      const avgKmPerDay = kmTravelled / daysBetween;

      const targetOdometer = parseInt(lastServiceOdometer) + (vehicle.service_interval_km * 0.9);
      const remainingKm = targetOdometer - currentOdometer;
      const daysUntilService = Math.ceil(remainingKm / avgKmPerDay);

      const estimatedDueDate = new Date();
      estimatedDueDate.setDate(estimatedDueDate.getDate() + daysUntilService);

      serviceDueData.push({
        vehicle: `${vehicle.registration_number} (${vehicle.make} ${vehicle.model})`,
        license_plate: vehicle.registration_number,
        last_service_date: vehicle.last_service_date,
        last_service_odometer: parseInt(lastServiceOdometer),
        current_odometer: currentOdometer,
        service_interval_km: vehicle.service_interval_km,
        target_odometer: targetOdometer,
        remaining_km: remainingKm,
        avg_km_per_day: avgKmPerDay,
        days_until_service: daysUntilService,
        estimated_due_date: estimatedDueDate.toISOString().split('T')[0],
        is_overdue: remainingKm < 0,
      });
    }

    serviceDueData.sort((a, b) => a.days_until_service - b.days_until_service);

    setReportData({ serviceDue: serviceDueData });
  };

  const loadVehiclesToServiceData = async (orgId: string) => {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, registration_number, make, model, last_service_km_reading, service_interval_km')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .not('last_service_km_reading', 'is', null)
      .not('service_interval_km', 'is', null)
      .gt('service_interval_km', 0);

    if (!vehicles || vehicles.length === 0) {
      setReportData({ vehiclesToService: [] });
      return;
    }

    const vehiclesToServiceData = [];

    for (const vehicle of vehicles) {
      const { data: latestTransaction } = await supabase
        .from('fuel_transactions')
        .select('odometer_reading')
        .eq('vehicle_id', vehicle.id)
        .not('odometer_reading', 'is', null)
        .order('transaction_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestTransaction) {
        continue;
      }

      const currentOdometer = parseInt(latestTransaction.odometer_reading);
      const lastServiceKm = vehicle.last_service_km_reading;
      const serviceIntervalKm = vehicle.service_interval_km;

      const nextServiceKm = lastServiceKm + serviceIntervalKm;
      const kmUntilService = nextServiceKm - currentOdometer;

      if (kmUntilService > 0 && kmUntilService <= 1000) {
        vehiclesToServiceData.push({
          vehicle: `${vehicle.registration_number} (${vehicle.make} ${vehicle.model})`,
          license_plate: vehicle.registration_number,
          last_service_km: lastServiceKm,
          current_odometer: currentOdometer,
          service_interval_km: serviceIntervalKm,
          next_service_km: nextServiceKm,
          km_until_service: kmUntilService,
          km_since_service: currentOdometer - lastServiceKm,
        });
      }
    }

    vehiclesToServiceData.sort((a, b) => a.km_until_service - b.km_until_service);

    setReportData({ vehiclesToService: vehiclesToServiceData });
  };

  const loadVehiclesOverdueServiceData = async (orgId: string) => {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, registration_number, make, model, last_service_km_reading, service_interval_km')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .not('last_service_km_reading', 'is', null)
      .not('service_interval_km', 'is', null)
      .gt('service_interval_km', 0);

    if (!vehicles || vehicles.length === 0) {
      setReportData({ vehiclesOverdueService: [] });
      return;
    }

    const vehiclesOverdueServiceData = [];

    for (const vehicle of vehicles) {
      const { data: latestTransaction } = await supabase
        .from('fuel_transactions')
        .select('odometer_reading')
        .eq('vehicle_id', vehicle.id)
        .not('odometer_reading', 'is', null)
        .order('transaction_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestTransaction) {
        continue;
      }

      const currentOdometer = parseInt(latestTransaction.odometer_reading);
      const lastServiceKm = vehicle.last_service_km_reading;
      const serviceIntervalKm = vehicle.service_interval_km;

      const nextServiceKm = lastServiceKm + serviceIntervalKm;
      const kmOverdue = currentOdometer - nextServiceKm;

      if (kmOverdue > 0) {
        vehiclesOverdueServiceData.push({
          vehicle: `${vehicle.registration_number} (${vehicle.make} ${vehicle.model})`,
          license_plate: vehicle.registration_number,
          last_service_km: lastServiceKm,
          current_odometer: currentOdometer,
          service_interval_km: serviceIntervalKm,
          next_service_km: nextServiceKm,
          km_overdue: kmOverdue,
          km_since_service: currentOdometer - lastServiceKm,
        });
      }
    }

    vehiclesOverdueServiceData.sort((a, b) => b.km_overdue - a.km_overdue);

    setReportData({ vehiclesOverdueService: vehiclesOverdueServiceData });
  };

  const exportToCSV = () => {
    if (!reportData) return;

    let csv = '';
    let filename = `${selectedReport}-report-${startDate}-to-${endDate}.csv`;

    switch (selectedReport) {
      case 'overview':
        if (orgSettings?.is_management_org) {
          csv = 'Date,Vehicle,Driver,Garage,Fuel Type,Liters,Price/L,Amount,Commission,Odometer\n';
          reportData.transactions?.forEach((t: any) => {
            csv += `"${new Date(t.date).toLocaleDateString()}","${t.vehicle}","${t.driver}","${t.garage}",${t.fuel_type},${(t.liters || 0).toFixed(2)},${(t.price_per_liter || 0).toFixed(2)},${(t.amount || 0).toFixed(2)},${(t.commission || 0).toFixed(2)},${t.odometer || ''}\n`;
          });
          csv += `\nTOTALS,,,,${(reportData.totalLiters || 0).toFixed(2)},,${(reportData.totalSpent || 0).toFixed(2)},${(reportData.totalCommission || 0).toFixed(2)}\n`;
        } else {
          csv = 'Date,Vehicle,Driver,Garage,Fuel Type,Liters,Price/L,Amount,Odometer\n';
          reportData.transactions?.forEach((t: any) => {
            csv += `"${new Date(t.date).toLocaleDateString()}","${t.vehicle}","${t.driver}","${t.garage}",${t.fuel_type},${(t.liters || 0).toFixed(2)},${(t.price_per_liter || 0).toFixed(2)},${(t.amount || 0).toFixed(2)},${t.odometer || ''}\n`;
          });
          csv += `\nTOTALS,,,,${(reportData.totalLiters || 0).toFixed(2)},,${(reportData.totalSpent || 0).toFixed(2)}\n`;
        }
        break;

      case 'driver':
        csv = 'Driver,Transactions,Vehicles Driven,Total Liters,Total Spent,Avg Transaction\n';
        reportData.drivers?.forEach((d: any) => {
          csv += `${d.first_name} ${d.surname},${d.total_transactions},${d.vehicles_driven},${d.total_liters},${d.total_spent},${d.average_transaction_amount}\n`;
        });
        break;

      case 'vehicle':
        if (orgSettings?.is_management_org) {
          csv = 'Vehicle,Date,Driver,Garage,Fuel Type,Liters,Price/L,Amount,Commission,Odometer\n';
          reportData.vehicleData?.forEach((v: any) => {
            csv += `\n${v.license_plate} (${v.make} ${v.model})\n`;
            v.transactions?.forEach((t: any) => {
              csv += `,"${new Date(t.date).toLocaleDateString()}","${t.driver}","${t.garage}",${t.fuel_type},${(t.liters || 0).toFixed(2)},${(t.price_per_liter || 0).toFixed(2)},${(t.amount || 0).toFixed(2)},${(t.commission || 0).toFixed(2)},${t.odometer || ''}\n`;
            });
            csv += `,,,TOTALS:,${(v.total_liters || 0).toFixed(2)},,${(v.total_amount || 0).toFixed(2)},${(v.total_commission || 0).toFixed(2)}\n`;
            csv += `,,,KM Travelled: ${v.km_travelled} | L/100km: ${(v.consumption_per_100km || 0).toFixed(2)}\n`;
          });
        } else {
          csv = 'Vehicle,Date,Driver,Garage,Fuel Type,Liters,Price/L,Amount,Odometer\n';
          reportData.vehicleData?.forEach((v: any) => {
            csv += `\n${v.license_plate} (${v.make} ${v.model})\n`;
            v.transactions?.forEach((t: any) => {
              csv += `,"${new Date(t.date).toLocaleDateString()}","${t.driver}","${t.garage}",${t.fuel_type},${(t.liters || 0).toFixed(2)},${(t.price_per_liter || 0).toFixed(2)},${(t.amount || 0).toFixed(2)},${t.odometer || ''}\n`;
            });
            csv += `,,,TOTALS:,${(v.total_liters || 0).toFixed(2)},,${(v.total_amount || 0).toFixed(2)}\n`;
            csv += `,,,KM Travelled: ${v.km_travelled} | L/100km: ${(v.consumption_per_100km || 0).toFixed(2)}\n`;
          });
        }
        break;

      case 'fuel-theft':
        csv = 'Vehicle,Expected L/100km,Actual L/100km,Variance %,Severity\n';
        reportData.alerts?.forEach((a: any) => {
          csv += `${a.vehicle},${a.expected},${a.actual},${a.variance},${a.severity}\n`;
        });
        break;

      case 'exceptions':
        csv = 'Unresolved Vehicle Exceptions Report\n\n';
        csv += 'Date,Vehicle,Driver,Exception Type,Description,Expected Value,Actual Value,Status\n';
        reportData.exceptions?.forEach((e: any) => {
          csv += `"${new Date(e.date).toLocaleDateString()}","${e.vehicle}","${e.driver}","${e.exception_type}","${e.description}","${e.expected_value || ''}","${e.actual_value || ''}","${e.resolved ? 'Resolved' : 'Pending'}"\n`;
        });
        break;

      case 'service-due':
        csv = 'Vehicle,Last Service Date,Last Service Odometer,Current Odometer,Service Interval (km),Target Odometer,Remaining (km),Avg km/day,Days Until Service,Estimated Due Date,Status\n';
        reportData.serviceDue?.forEach((s: any) => {
          csv += `"${s.vehicle}","${new Date(s.last_service_date).toLocaleDateString()}",${s.last_service_odometer},${s.current_odometer},${s.service_interval_km},${s.target_odometer},${s.remaining_km},${s.avg_km_per_day.toFixed(1)},${s.days_until_service},"${new Date(s.estimated_due_date).toLocaleDateString()}",${s.is_overdue ? 'OVERDUE' : 'Upcoming'}\n`;
        });
        break;

      case 'vehicles-to-service':
        csv = 'Vehicle,Last Service KM,Current Odometer,Service Interval (km),Next Service KM,KM Until Service,KM Since Last Service\n';
        reportData.vehiclesToService?.forEach((v: any) => {
          csv += `"${v.vehicle}",${v.last_service_km},${v.current_odometer},${v.service_interval_km},${v.next_service_km},${v.km_until_service},${v.km_since_service}\n`;
        });
        break;

      case 'vehicles-overdue-service':
        csv = 'Vehicle,Last Service KM,Current Odometer,Service Interval (km),Next Service KM,KM Overdue,KM Since Last Service\n';
        reportData.vehiclesOverdueService?.forEach((v: any) => {
          csv += `"${v.vehicle}",${v.last_service_km},${v.current_odometer},${v.service_interval_km},${v.next_service_km},${v.km_overdue},${v.km_since_service}\n`;
        });
        break;

      case 'monthly':
      case 'annual':
        csv = 'Date,Vehicle,Driver,Location,Fuel Type,Liters,Amount\n';
        reportData.transactions?.forEach((t: any) => {
          csv += `"${new Date(t.date).toLocaleDateString()}","${t.vehicle}","${t.driver}","${t.location}",${t.fuel_type},${(parseFloat(t.liters) || 0).toFixed(2)},${(parseFloat(t.total_amount) || 0).toFixed(2)}\n`;
        });
        break;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 pb-4 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
            <p className="text-gray-600">Comprehensive fuel usage analytics</p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('reports-menu')}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 px-4 py-2 whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Reports Menu
            </button>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Date Range & Actions</h3>
          <div className="flex flex-wrap items-center gap-4">
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
            <button
              onClick={loadReportData}
              disabled={!selectedReport || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors text-sm ml-auto"
            >
              <BarChart3 className="w-4 h-4" />
              Generate
            </button>
            <button
              onClick={exportToCSV}
              disabled={!reportData}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">


        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Type</h3>
        <div className="space-y-2 mb-6">
          {reportTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedReport(type.id)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-4 ${
                  selectedReport === type.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <Icon className={`w-6 h-6 flex-shrink-0 ${selectedReport === type.id ? 'text-blue-600' : 'text-gray-600'}`} />
                <div>
                  <h4 className="font-semibold text-gray-900">{type.name}</h4>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {selectedReport === 'daily-trip-report' ? (
          <DailyTripReport />
        ) : selectedReport === 'unreturned-vehicles' ? (
          <UnreturnedVehiclesReport />
        ) : selectedReport === 'return-notes' ? (
          <VehicleReturnNotesReport />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error loading reports</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        ) : loading || !orgSettings ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : reportData ? (
          <div className="space-y-4">
            {selectedReport === 'overview' && (
              <>
                <div className={`grid grid-cols-1 gap-4 ${orgSettings?.is_management_org ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-900 font-medium">Total Transactions</p>
                    <p className="text-2xl font-bold text-blue-900">{reportData.totalTransactions || 0}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-900 font-medium">Total Liters</p>
                    <p className="text-2xl font-bold text-green-900">{(reportData.totalLiters || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-orange-900 font-medium">Total Spent</p>
                    <p className="text-2xl font-bold text-orange-900">R {(reportData.totalSpent || 0).toFixed(2)}</p>
                  </div>
                  {orgSettings?.is_management_org && (
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-900 font-medium">Commission</p>
                      <p className="text-2xl font-bold text-purple-900">R {(reportData.totalCommission || 0).toFixed(2)}</p>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden mt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Garage</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuel</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Liters</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price/L</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          {orgSettings?.is_management_org && (
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                          )}
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Odometer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reportData.transactions?.map((t: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(t.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{t.vehicle}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{t.driver}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{t.garage}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{t.fuel_type}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{(t.liters || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">R {(t.price_per_liter || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">R {(t.amount || 0).toFixed(2)}</td>
                            {orgSettings?.is_management_org && (
                              <td className="px-4 py-3 text-sm text-right text-orange-600">R {(t.commission || 0).toFixed(2)}</td>
                            )}
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{t.odometer || '-'}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td colSpan={4} className="px-4 py-3 text-sm text-gray-900 font-bold">TOTALS:</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 font-bold">{(reportData.totalLiters || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 font-bold">R {(reportData.totalSpent || 0).toFixed(2)}</td>
                          {orgSettings?.is_management_org && (
                            <td className="px-4 py-3 text-sm text-right text-orange-600 font-bold">R {(reportData.totalCommission || 0).toFixed(2)}</td>
                          )}
                          <td className="px-4 py-3 text-sm text-right text-gray-900"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {selectedReport === 'driver' && reportData.drivers && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transactions</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Vehicles Driven</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Liters</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Transaction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reportData.drivers.map((driver: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {driver.first_name} {driver.surname}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">{driver.total_transactions}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">{driver.vehicles_driven}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">{(driver.total_liters || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">R {(driver.total_spent || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">R {(driver.average_transaction_amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedReport === 'vehicle' && reportData.vehicleData && (
              <div className="space-y-6">
                {reportData.vehicleData.map((vehicle: any) => (
                  <div key={vehicle.vehicle_id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-bold text-gray-900">
                        {vehicle.license_plate} - {vehicle.make} {vehicle.model}
                      </h3>
                      <div className="flex gap-6 mt-2 text-sm text-gray-600">
                        <span>Transactions: {vehicle.transaction_count}</span>
                        <span>KM Travelled: {vehicle.km_travelled}</span>
                        <span>L/100km: {(vehicle.consumption_per_100km || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Garage</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuel Type</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Liters</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price/L</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            {orgSettings?.is_management_org && (
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                            )}
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Odometer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {vehicle.transactions.map((t: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {new Date(t.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{t.driver}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{t.garage}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{t.fuel_type}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">{(t.liters || 0).toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">R {(t.price_per_liter || 0).toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">R {(t.amount || 0).toFixed(2)}</td>
                              {orgSettings?.is_management_org && (
                                <td className="px-4 py-3 text-sm text-right text-orange-600">R {(t.commission || 0).toFixed(2)}</td>
                              )}
                              <td className="px-4 py-3 text-sm text-right text-gray-900">{t.odometer || '-'}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-semibold">
                            <td colSpan={4} className="px-4 py-3 text-sm text-gray-900">TOTALS</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{(vehicle.total_liters || 0).toFixed(2)}</td>
                            <td className="px-4 py-3"></td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">R {(vehicle.total_amount || 0).toFixed(2)}</td>
                            {orgSettings?.is_management_org && (
                              <td className="px-4 py-3 text-sm text-right text-orange-600">R {(vehicle.total_commission || 0).toFixed(2)}</td>
                            )}
                            <td className="px-4 py-3"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedReport === 'fuel-theft' && reportData.alerts && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-red-600">Fuel Consumption Alerts</h3>
                {reportData.alerts.length === 0 ? (
                  <p className="text-gray-600">No anomalies detected</p>
                ) : (
                  <div className="space-y-2">
                    {reportData.alerts.map((alert: any, idx: number) => (
                      <div key={idx} className={`p-4 rounded-lg ${alert.severity === 'High' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{alert.vehicle}</p>
                            <p className="text-sm text-gray-600">
                              Expected: {(parseFloat(alert.expected) || 0).toFixed(2)} L/100km |
                              Actual: {(parseFloat(alert.actual) || 0).toFixed(2)} L/100km |
                              Variance: {(parseFloat(alert.variance) || 0).toFixed(1)}%
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${alert.severity === 'High' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'}`}>
                            {alert.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedReport === 'exceptions' && reportData.exceptions && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-orange-900">Vehicle Exception Report (Unresolved Only)</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    This report shows only unresolved exceptions. Use the <strong>Custom Report Builder</strong> to analyze all exceptions (resolved and unresolved) to identify trends by driver, vehicle, or exception type.
                  </p>
                </div>
                {reportData.exceptions.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <p className="text-green-800 font-medium">No unresolved exceptions!</p>
                    <p className="text-sm text-green-700 mt-2">All vehicle exceptions have been resolved or no anomalies were detected.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reportData.exceptions.map((exception: any) => (
                      <div key={exception.id} className={`border rounded-lg overflow-hidden ${exception.resolved ? 'bg-gray-50 border-gray-200' : 'bg-orange-50 border-orange-200'}`}>
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <AlertCircle className={`w-5 h-5 ${exception.resolved ? 'text-gray-600' : 'text-orange-600'}`} />
                                <div>
                                  <h4 className="font-semibold text-gray-900">{exception.vehicle}</h4>
                                  <p className="text-sm text-gray-600">Driver: {exception.driver}</p>
                                </div>
                              </div>

                              <div className="ml-8 space-y-2">
                                <div>
                                  <p className="text-sm font-medium text-gray-700">Exception Type:</p>
                                  <p className="text-sm text-gray-900">{exception.exception_type}</p>
                                </div>

                                <div>
                                  <p className="text-sm font-medium text-gray-700">Description:</p>
                                  <p className="text-sm text-gray-900">{exception.description}</p>
                                </div>

                                {exception.expected_value && (
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm font-medium text-gray-700">Expected:</p>
                                      <p className="text-sm text-gray-900">{exception.expected_value}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-700">Actual:</p>
                                      <p className="text-sm text-orange-600 font-medium">{exception.actual_value}</p>
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span>Date: {new Date(exception.date).toLocaleString()}</span>
                                </div>

                                {exception.resolved && exception.resolution_notes && (
                                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                                    <p className="text-sm font-medium text-green-900 flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4" />
                                      Resolved on {new Date(exception.resolved_at).toLocaleDateString()}
                                    </p>
                                    <p className="text-sm text-green-800 mt-1">{exception.resolution_notes}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              {exception.resolved ? (
                                <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-600 text-white flex items-center gap-1">
                                  <CheckCircle className="w-4 h-4" />
                                  Resolved
                                </span>
                              ) : (
                                <>
                                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-600 text-white">
                                    Pending
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setResolvingException(exception.id);
                                      setResolutionNotes('');
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    Mark Resolved
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedReport === 'service-due' && reportData.serviceDue && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-blue-900">Next Service Due Dates</h3>
                {reportData.serviceDue.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <p className="text-gray-600">No vehicles with service information found.</p>
                    <p className="text-sm text-gray-500 mt-2">Ensure vehicles have both Last Service Date and Service Interval configured.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Service</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Last Svc Odo</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Odo</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Target Odo</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remaining (km)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg km/day</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days Until</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Due Date</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {reportData.serviceDue.map((service: any, idx: number) => (
                            <tr key={idx} className={`hover:bg-gray-50 ${service.is_overdue ? 'bg-red-50' : service.days_until_service <= 7 ? 'bg-yellow-50' : ''}`}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{service.vehicle}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {new Date(service.last_service_date).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {service.last_service_odometer.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {service.current_odometer.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {service.target_odometer.toLocaleString()}
                              </td>
                              <td className={`px-4 py-3 text-sm text-right font-medium ${service.is_overdue ? 'text-red-600' : service.remaining_km < 500 ? 'text-orange-600' : 'text-gray-900'}`}>
                                {service.remaining_km.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {service.avg_km_per_day.toFixed(1)}
                              </td>
                              <td className={`px-4 py-3 text-sm text-right font-medium ${service.is_overdue ? 'text-red-600' : service.days_until_service <= 7 ? 'text-orange-600' : 'text-gray-900'}`}>
                                {service.is_overdue ? 'OVERDUE' : service.days_until_service}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {new Date(service.estimated_due_date).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {service.is_overdue ? (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-600 text-white">
                                    OVERDUE
                                  </span>
                                ) : service.days_until_service <= 7 ? (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-500 text-white">
                                    URGENT
                                  </span>
                                ) : service.days_until_service <= 30 ? (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500 text-white">
                                    SOON
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedReport === 'vehicles-to-service' && reportData.vehiclesToService && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-blue-900">Vehicles to be Serviced (Within 1000 km)</h3>
                {reportData.vehiclesToService.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <p className="text-green-800 font-medium">No vehicles approaching service due!</p>
                    <p className="text-sm text-green-700 mt-2">All vehicles are either serviced recently or have more than 1000 km before service.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-yellow-100 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Vehicle</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Last Service KM</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Current Odometer</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Service Interval</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Next Service KM</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">KM Until Service</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">KM Since Service</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {reportData.vehiclesToService.map((vehicle: any, idx: number) => (
                            <tr key={idx} className={`hover:bg-gray-50 ${vehicle.km_until_service <= 500 ? 'bg-orange-50' : 'bg-yellow-50'}`}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{vehicle.vehicle}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {vehicle.last_service_km.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {vehicle.current_odometer.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {vehicle.service_interval_km.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {vehicle.next_service_km.toLocaleString()}
                              </td>
                              <td className={`px-4 py-3 text-sm text-right font-bold ${vehicle.km_until_service <= 500 ? 'text-orange-600' : 'text-yellow-600'}`}>
                                {vehicle.km_until_service.toLocaleString()} km
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {vehicle.km_since_service.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedReport === 'vehicles-overdue-service' && reportData.vehiclesOverdueService && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-red-900">Vehicles Overdue for Service</h3>
                {reportData.vehiclesOverdueService.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <p className="text-green-800 font-medium">No vehicles overdue for service!</p>
                    <p className="text-sm text-green-700 mt-2">All vehicles are serviced on time.</p>
                  </div>
                ) : (
                  <div className="border border-red-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-red-100 border-b border-red-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Vehicle</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Last Service KM</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Current Odometer</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Service Interval</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Should've Serviced At</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">KM Overdue</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">KM Since Service</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {reportData.vehiclesOverdueService.map((vehicle: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50 bg-red-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{vehicle.vehicle}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {vehicle.last_service_km.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {vehicle.current_odometer.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {vehicle.service_interval_km.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {vehicle.next_service_km.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                                {vehicle.km_overdue.toLocaleString()} km OVERDUE
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-700">
                                {vehicle.km_since_service.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(selectedReport === 'monthly' || selectedReport === 'annual') && reportData.transactions && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedReport === 'monthly' ? 'Monthly Summary' : 'Annual Summary'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedReport === 'monthly'
                      ? `Month-end day: ${reportData.monthEnd}`
                      : `Year-end: ${reportData.yearEndMonth}/${reportData.yearEndDay}`
                    }
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuel Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Liters</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reportData.transactions.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(t.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{t.vehicle}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{t.driver}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{t.location}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{t.fuel_type}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">{(parseFloat(t.liters) || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">R {(parseFloat(t.total_amount) || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-600 py-12">Select a date range and report type to view data</p>
        )}
      </div>

      {/* Resolution Modal */}
      {resolvingException && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolve Exception</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide notes explaining how this exception was resolved or investigated.
            </p>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Enter resolution notes here..."
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setResolvingException(null);
                  setResolutionNotes('');
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resolveException(resolvingException, resolutionNotes)}
                disabled={loading || !resolutionNotes.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Resolving...' : 'Mark as Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
