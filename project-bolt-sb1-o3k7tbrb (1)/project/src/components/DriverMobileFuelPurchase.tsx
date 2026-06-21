import { useState, useEffect } from 'react';
import { Fuel, Camera, MapPin, AlertCircle, CheckCircle, LogOut, XCircle } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { supabase } from '../lib/supabase';
import { DriverData } from './DriverAuth';

interface Vehicle {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  license_disk_expiry: string;
  vin_number?: string;
  fuel_type?: string;
  tank_capacity?: number;
  organization_id: string;
}

interface Garage {
  id: string;
  name: string;
  address: string;
  address_line_2?: string;
  city: string;
  province: string;
  postal_code: string;
  phone: string;
  commission_rate: number;
  fuel_prices?: Record<string, number>;
  latitude?: number;
  longitude?: number;
  accountNumber?: string | null;
}

interface ScanData {
  image: string;
  extractedText: string;
}

interface DriverMobileFuelPurchaseProps {
  driver: DriverData;
  onLogout: () => void | Promise<void>;
  onComplete?: () => void;
}

export default function DriverMobileFuelPurchase({ driver, onLogout, onComplete }: DriverMobileFuelPurchaseProps) {
  // ==========================================
  // TESTING MODE CONFIGURATION
  // ==========================================
  // Set to true to bypass license disk scanning for testing purposes
  // Set to false to require license disk scanning (production mode)
  const SKIP_LICENSE_SCAN_FOR_TESTING = true;
  // ==========================================

  const [drawnVehicle, setDrawnVehicle] = useState<Vehicle | null>(null);
  const [licenseDiskScan, setLicenseDiskScan] = useState<ScanData | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [extractedVin, setExtractedVin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fuelEfficiency, setFuelEfficiency] = useState<number | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMismatch, setLocationMismatch] = useState(false);
  const [distanceFromGarage, setDistanceFromGarage] = useState<number | null>(null);
  const [locationMetadata, setLocationMetadata] = useState<{
    accuracy: number;
    isMock: boolean;
    provider: string;
  } | null>(null);

  const [currentStep, setCurrentStep] = useState<'garage_selection' | 'location_confirmation' | 'license_scan' | 'spending_check' | 'authorized' | 'fuel_details' | 'pin_entry' | 'scan_to_till' | 'authorization_pending'>('garage_selection');
  const [selectedGarageId, setSelectedGarageId] = useState('');
  const [spendingLimitInfo, setSpendingLimitInfo] = useState<{
    hasLimit: boolean;
    type: 'daily' | 'monthly' | null;
    limit: number;
    currentSpending: number;
    availableAmount: number;
    maxLiters: number;
    pricePerLiter: number;
    isBlocked: boolean;
    source: 'driver' | 'organization' | 'garage';
  } | null>(null);

  const [formData, setFormData] = useState({
    liters: '',
    pricePerLiter: '',
    totalAmount: '',
    odometerReading: '',
    oilQuantity: '',
    oilUnitPrice: '',
    oilTotalAmount: '',
    oilType: '',
    oilBrand: '',
  });
  const [purchasingOil, setPurchasingOil] = useState(false);

  const [garages, setGarages] = useState<Garage[]>([]);
  const [garageAccountNumber, setGarageAccountNumber] = useState<string>('');
  const [isLocalAccount, setIsLocalAccount] = useState(false);
  const [paymentOption, setPaymentOption] = useState<'Card Payment' | 'Local Account' | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'success' | 'failed' | 'not_supported'>('idle');
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [transactionWarning, setTransactionWarning] = useState<string | null>(null);
  const [encryptedCardData, setEncryptedCardData] = useState<any>(null);
  const [nearestGarage, setNearestGarage] = useState<Garage | null>(null);
  const [detectingGarage, setDetectingGarage] = useState(false);
  const [paymentCheckError, setPaymentCheckError] = useState<string>('');

  useEffect(() => {
    validateSession();
    loadDrawnVehicle();
    getCurrentLocation();
  }, []);

  // Once we have both location and garages, auto-detect nearest
  useEffect(() => {
    if (location && garages.length > 0 && !nearestGarage) {
      detectNearestGarage();
    }
  }, [location, garages]);

  const validateSession = () => {
    const driverToken = localStorage.getItem('driverToken');
    if (!driverToken) {
      setError('Session not found. Redirecting to login...');
      setTimeout(() => {
        if (onLogout) {
          onLogout();
        }
      }, 2000);
    }
  };

  const getCurrentLocation = () => {
    // Load garages in parallel with location request
    loadGarages();

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });

          // Detect potential mock/fake location
          const accuracy = position.coords.accuracy;
          const altitude = position.coords.altitude;
          const altitudeAccuracy = position.coords.altitudeAccuracy;
          const timestamp = position.timestamp;
          const timeDiff = Date.now() - timestamp;

          // Heuristics to detect suspicious GPS behavior
          let isSuspicious = false;
          let suspicionReasons: string[] = [];

          // Check 1: Unusually perfect accuracy (< 5m) without GPS typically indicates spoofing
          if (accuracy < 5) {
            isSuspicious = true;
            suspicionReasons.push('Unusually high accuracy for mobile GPS');
          }

          // Check 2: Very poor accuracy (> 500m) indicates unreliable or network-based positioning
          if (accuracy > 500) {
            isSuspicious = true;
            suspicionReasons.push('Very poor GPS accuracy');
          }

          // Check 3: Missing altitude data can indicate mock location
          if (altitude === null && altitudeAccuracy === null) {
            isSuspicious = true;
            suspicionReasons.push('Missing altitude data');
          }

          // Check 4: Timestamp mismatch (> 5 seconds) indicates cached or manipulated data
          if (timeDiff > 5000) {
            isSuspicious = true;
            suspicionReasons.push('Location timestamp is stale');
          }

          // Determine provider type based on accuracy
          let provider = 'unknown';
          if (accuracy < 50) {
            provider = 'gps';
          } else if (accuracy < 200) {
            provider = 'network';
          } else {
            provider = 'cell';
          }

          if (isSuspicious) {
            console.warn('[GPS] Suspicious location detected:', suspicionReasons.join(', '));
            console.warn('[GPS] Accuracy:', accuracy, 'Altitude:', altitude, 'Time diff:', timeDiff);
          }

          setLocationMetadata({
            accuracy: accuracy,
            isMock: isSuspicious,
            provider: provider,
          });
        },
        (error) => {
          console.error('Location error:', error);
          setLocationMetadata({
            accuracy: 0,
            isMock: false,
            provider: 'error',
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  };

  const loadDrawnVehicle = async () => {
    setLoadingVehicle(true);
    try {
      console.log('Loading drawn vehicle for driver:', driver.id);

      // Get the most recent draw for this driver
      const { data: activeDraws, error: drawError } = await supabase
        .from('vehicle_transactions')
        .select('vehicle_id, id, created_at')
        .eq('driver_id', driver.id)
        .eq('transaction_type', 'draw')
        .order('created_at', { ascending: false });

      if (drawError) {
        console.error('Error loading active draws:', drawError);
        setError('Failed to load drawn vehicle');
        return;
      }

      if (!activeDraws || activeDraws.length === 0) {
        console.log('No vehicles currently drawn by this driver');
        setError('You must draw a vehicle before you can refuel. Please contact your administrator.');
        return;
      }

      // Find the first draw that doesn't have a return transaction
      let activeDrawId = null;
      let vehicleId = null;

      for (const draw of activeDraws) {
        const { data: returnTx } = await supabase
          .from('vehicle_transactions')
          .select('id')
          .eq('related_transaction_id', draw.id)
          .eq('transaction_type', 'return')
          .maybeSingle();

        if (!returnTx) {
          activeDrawId = draw.id;
          vehicleId = draw.vehicle_id;
          break;
        }
      }

      if (!vehicleId) {
        console.log('All drawn vehicles have been returned');
        setError('No vehicle currently drawn. Please draw a vehicle first.');
        return;
      }

      // Load the drawn vehicle
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .eq('status', 'active')
        .maybeSingle();

      if (vehicleError || !vehicle) {
        console.error('Error loading vehicle:', vehicleError);
        setError('Failed to load vehicle information');
        return;
      }

      console.log('Loaded drawn vehicle:', vehicle);
      setDrawnVehicle(vehicle);
      setError('');
    } catch (err: any) {
      console.error('Error in loadDrawnVehicle:', err);
      setError(err.message || 'Failed to load vehicle');
    } finally {
      setLoadingVehicle(false);
    }
  };

  const loadGarages = async () => {
    try {
      const [{ data: allGarages }, { data: garageAccounts }] = await Promise.all([
        supabase.from('garages').select('*').eq('status', 'active').order('name'),
        supabase
          .from('organization_garage_accounts')
          .select('garage_id, account_number')
          .eq('organization_id', driver.organizationId)
          .eq('is_active', true),
      ]);

      if (allGarages) {
        const garagesWithAccounts = allGarages.map(garage => ({
          ...garage,
          accountNumber: garageAccounts?.find(acc => acc.garage_id === garage.id)?.account_number || null,
        }));
        setGarages(garagesWithAccounts);
      }
    } catch (err: any) {
      console.error('Error loading garages:', err);
      setError('Failed to load garages');
    }
  };

  const detectNearestGarage = () => {
    if (!location || garages.length === 0) return;
    setDetectingGarage(true);

    // Only consider garages that have coordinates
    const garagesWithCoords = garages.filter(g => g.latitude && g.longitude);
    if (garagesWithCoords.length === 0) {
      setDetectingGarage(false);
      return;
    }

    let closest = garagesWithCoords[0];
    let closestDist = calculateDistance(location.lat, location.lng, closest.latitude!, closest.longitude!);

    for (const garage of garagesWithCoords) {
      const dist = calculateDistance(location.lat, location.lng, garage.latitude!, garage.longitude!);
      if (dist < closestDist) {
        closestDist = dist;
        closest = garage;
      }
    }

    setNearestGarage(closest);
    setSelectedGarageId(closest.id);
    setDistanceFromGarage(closestDist);
    setLocationMismatch(closestDist > 0.5);
    setDetectingGarage(false);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const checkLocationProximity = (garage: Garage): { isNear: boolean; distance: number | null } => {
    if (!location || !garage.latitude || !garage.longitude) {
      return { isNear: true, distance: null };
    }

    const distance = calculateDistance(
      location.lat,
      location.lng,
      garage.latitude,
      garage.longitude
    );

    const MAX_DISTANCE_KM = 0.5;
    return {
      isNear: distance <= MAX_DISTANCE_KM,
      distance,
    };
  };

  const checkSpendingLimits = async () => {
    if (!drawnVehicle || !selectedGarageId) {
      setError('Missing vehicle or garage information.');
      setCurrentStep('garage_selection');
      return;
    }

    try {
      const selectedGarage = garages.find(g => g.id === selectedGarageId);
      if (!selectedGarage) {
        setError('Garage not found.');
        setCurrentStep('garage_selection');
        return;
      }

      // First, get organization details including payment option
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .select('payment_option, daily_spending_limit, monthly_spending_limit')
        .eq('id', drawnVehicle.organization_id)
        .single();

      if (orgError) {
        console.error('Error fetching organization:', orgError);
        setError('Failed to check organization details.');
        setCurrentStep('garage_selection');
        return;
      }

      const orgPaymentOption = organization.payment_option || 'Card Payment';
      console.log('[FuelPurchase] Organization payment option:', orgPaymentOption);

      // Always check if this garage has a local account for this organization
      const { data: garageAccount, error: garageAccountError } = await supabase
        .from('organization_garage_accounts')
        .select('monthly_spend_limit, account_number')
        .eq('organization_id', drawnVehicle.organization_id)
        .eq('garage_id', selectedGarage.id)
        .eq('is_active', true)
        .maybeSingle();

      if (garageAccountError) {
        console.error('Error fetching garage account:', garageAccountError);
      }

      // Prioritize local account if one exists for this garage, regardless of org-level payment option
      if (garageAccount) {
        setPaymentOption('Local Account');
        setIsLocalAccount(true);
        setGarageAccountNumber(garageAccount.account_number);
        console.log('[FuelPurchase] Payment flow: Local Account (PIN + NFC + Account Number)');
      } else if (orgPaymentOption === 'Local Account') {
        // Org is configured for local accounts but this garage has none set up
        setError(`No local account exists for ${selectedGarage.name}. Please contact your administrator.`);
        setCurrentStep('garage_selection');
        return;
      } else {
        // No local account — fall back to card payment
        const { data: paymentCard, error: cardError } = await supabase
          .from('organization_payment_cards')
          .select('*')
          .eq('organization_id', drawnVehicle.organization_id)
          .eq('is_active', true)
          .eq('is_default', true)
          .maybeSingle();

        if (cardError || !paymentCard) {
          console.error('Error fetching payment card:', cardError);
          setError('No active payment card found. Please contact your administrator.');
          setCurrentStep('garage_selection');
          return;
        }

        setPaymentOption('Card Payment');
        setIsLocalAccount(false);
        setEncryptedCardData(paymentCard);
        console.log('[FuelPurchase] Payment flow: Card Payment (PIN + NFC + Encrypted Card)');
      }

      const fuelPrice = selectedGarage.fuel_prices?.[drawnVehicle.fuel_type || ''] || 0;
      const tankCapacity = parseFloat(drawnVehicle.tank_capacity?.toString() || '0');

      // Collect all spending limits to find the most restrictive one
      const allLimits: Array<{
        type: 'daily' | 'monthly';
        limit: number;
        currentSpending: number;
        availableAmount: number;
        source: 'driver' | 'organization' | 'garage';
      }> = [];

      console.log('========== SPENDING LIMIT CHECK START ==========');
      console.log('Driver ID:', driver.id);
      console.log('Organization ID:', drawnVehicle.organization_id);
      console.log('Garage ID:', selectedGarage.id);

      // Check driver-specific spending limits
      const { data: driverPaymentSettings, error: driverPaymentError } = await supabase
        .from('driver_payment_settings')
        .select('daily_spending_limit, monthly_spending_limit, payment_enabled')
        .eq('driver_id', driver.id)
        .maybeSingle();

      if (driverPaymentError) {
        console.error('❌ Error fetching driver payment settings:', driverPaymentError);
      } else {
        console.log('✅ Driver payment settings loaded:', driverPaymentSettings);
        console.log('   - Daily limit:', driverPaymentSettings?.daily_spending_limit);
        console.log('   - Monthly limit:', driverPaymentSettings?.monthly_spending_limit);
        console.log('   - Payment enabled:', driverPaymentSettings?.payment_enabled);
      }

      // Check driver's daily limit (only if payment is enabled)
      if (driverPaymentSettings?.payment_enabled && driverPaymentSettings?.daily_spending_limit) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: driverDailyTransactions, error: driverDailyError } = await supabase
          .from('fuel_transactions')
          .select('total_amount')
          .eq('driver_id', driver.id)
          .gte('created_at', today.toISOString());

        if (!driverDailyError) {
          const driverDailySpending = driverDailyTransactions?.reduce((sum, t) => sum + parseFloat(t.total_amount || '0'), 0) || 0;
          const availableDaily = parseFloat(driverPaymentSettings.daily_spending_limit) - driverDailySpending;

          allLimits.push({
            type: 'daily',
            limit: parseFloat(driverPaymentSettings.daily_spending_limit),
            currentSpending: driverDailySpending,
            availableAmount: availableDaily,
            source: 'driver'
          });

          console.log('✅ Driver daily limit ADDED:', {
            limit: parseFloat(driverPaymentSettings.daily_spending_limit),
            spent: driverDailySpending,
            available: availableDaily
          });
        } else {
          console.error('❌ Error fetching driver daily transactions:', driverDailyError);
        }
      } else {
        if (!driverPaymentSettings?.payment_enabled) {
          console.log('⚠️ Driver payment is DISABLED - skipping daily limit');
        } else {
          console.log('⚠️ Driver has NO daily spending limit set');
        }
      }

      // Check driver's monthly limit (only if payment is enabled)
      if (driverPaymentSettings?.payment_enabled && driverPaymentSettings?.monthly_spending_limit) {
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        const { data: driverMonthlyTransactions, error: driverMonthlyError } = await supabase
          .from('fuel_transactions')
          .select('total_amount')
          .eq('driver_id', driver.id)
          .gte('created_at', firstDayOfMonth.toISOString());

        if (!driverMonthlyError) {
          const driverMonthlySpending = driverMonthlyTransactions?.reduce((sum, t) => sum + parseFloat(t.total_amount || '0'), 0) || 0;
          const availableMonthly = parseFloat(driverPaymentSettings.monthly_spending_limit) - driverMonthlySpending;

          allLimits.push({
            type: 'monthly',
            limit: parseFloat(driverPaymentSettings.monthly_spending_limit),
            currentSpending: driverMonthlySpending,
            availableAmount: availableMonthly,
            source: 'driver'
          });

          console.log('✅ Driver monthly limit ADDED:', {
            limit: parseFloat(driverPaymentSettings.monthly_spending_limit),
            spent: driverMonthlySpending,
            available: availableMonthly
          });
        } else {
          console.error('❌ Error fetching driver monthly transactions:', driverMonthlyError);
        }
      } else {
        if (!driverPaymentSettings?.payment_enabled) {
          console.log('⚠️ Driver payment is DISABLED - skipping monthly limit');
        } else {
          console.log('⚠️ Driver has NO monthly spending limit set');
        }
      }

      // Check garage-specific spending limit
      if (garageAccount?.monthly_spend_limit) {
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        const { data: garageMonthlyTransactions, error: garageMonthlyError } = await supabase
          .from('fuel_transactions')
          .select('total_amount')
          .eq('organization_id', drawnVehicle.organization_id)
          .eq('garage_id', selectedGarage.id)
          .gte('created_at', firstDayOfMonth.toISOString());

        if (!garageMonthlyError) {
          const garageMonthlySpending = garageMonthlyTransactions?.reduce((sum, t) => sum + parseFloat(t.total_amount || '0'), 0) || 0;
          const availableMonthly = garageAccount.monthly_spend_limit - garageMonthlySpending;

          allLimits.push({
            type: 'monthly',
            limit: garageAccount.monthly_spend_limit,
            currentSpending: garageMonthlySpending,
            availableAmount: availableMonthly,
            source: 'garage'
          });

          console.log('Garage-specific limit:', {
            garage: selectedGarage.name,
            limit: garageAccount.monthly_spend_limit,
            spent: garageMonthlySpending,
            available: availableMonthly
          });
        }
      }

      // Check organization daily limit
      if (organization.daily_spending_limit) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: dailyTransactions, error: dailyError } = await supabase
          .from('fuel_transactions')
          .select('total_amount')
          .eq('organization_id', drawnVehicle.organization_id)
          .gte('created_at', today.toISOString());

        if (!dailyError) {
          const dailySpending = dailyTransactions?.reduce((sum, t) => sum + parseFloat(t.total_amount || '0'), 0) || 0;
          const availableDaily = organization.daily_spending_limit - dailySpending;

          allLimits.push({
            type: 'daily',
            limit: organization.daily_spending_limit,
            currentSpending: dailySpending,
            availableAmount: availableDaily,
            source: 'organization'
          });

          console.log('Organization daily limit:', {
            limit: organization.daily_spending_limit,
            spent: dailySpending,
            available: availableDaily
          });
        }
      }

      // Check organization monthly limit
      if (organization.monthly_spending_limit) {
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        const { data: monthlyTransactions, error: monthlyError } = await supabase
          .from('fuel_transactions')
          .select('total_amount')
          .eq('organization_id', drawnVehicle.organization_id)
          .gte('created_at', firstDayOfMonth.toISOString());

        if (!monthlyError) {
          const monthlySpending = monthlyTransactions?.reduce((sum, t) => sum + parseFloat(t.total_amount || '0'), 0) || 0;
          const availableMonthly = organization.monthly_spending_limit - monthlySpending;

          allLimits.push({
            type: 'monthly',
            limit: organization.monthly_spending_limit,
            currentSpending: monthlySpending,
            availableAmount: availableMonthly,
            source: 'organization'
          });

          console.log('Organization monthly limit:', {
            limit: organization.monthly_spending_limit,
            spent: monthlySpending,
            available: availableMonthly
          });
        }
      }

      // Find the most restrictive limit (lowest available amount)
      console.log('========================================');
      console.log('📊 ALL LIMITS COLLECTED:');
      allLimits.forEach((limit, index) => {
        console.log(`   ${index + 1}. ${limit.source.toUpperCase()} ${limit.type}:`,
          `R${limit.availableAmount.toFixed(2)} available (limit: R${limit.limit.toFixed(2)}, spent: R${limit.currentSpending.toFixed(2)})`);
      });
      console.log('========================================');

      const mostRestrictiveLimit = allLimits.length > 0
        ? allLimits.reduce((prev, curr) =>
            curr.availableAmount < prev.availableAmount ? curr : prev
          )
        : null;

      if (mostRestrictiveLimit) {
        console.log('🎯🎯🎯 MOST RESTRICTIVE LIMIT SELECTED 🎯🎯🎯');
        console.log(`   SOURCE: ${mostRestrictiveLimit.source.toUpperCase()}`);
        console.log(`   TYPE: ${mostRestrictiveLimit.type.toUpperCase()}`);
        console.log(`   TOTAL LIMIT: R${mostRestrictiveLimit.limit.toFixed(2)}`);
        console.log(`   ALREADY SPENT: R${mostRestrictiveLimit.currentSpending.toFixed(2)}`);
        console.log(`   AVAILABLE: R${mostRestrictiveLimit.availableAmount.toFixed(2)}`);
        console.log('========================================');
      } else {
        console.log('⚠️⚠️⚠️ NO SPENDING LIMITS FOUND ⚠️⚠️⚠️');
      }
      console.log('========== SPENDING LIMIT CHECK END ==========');

      // Set spending limit info
      if (mostRestrictiveLimit) {
        const availableAmount = Math.max(0, mostRestrictiveLimit.availableAmount);
        const maxLiters = fuelPrice > 0 ? availableAmount / fuelPrice : 0;
        const isBlocked = availableAmount <= 0;

        setSpendingLimitInfo({
          hasLimit: true,
          type: mostRestrictiveLimit.type,
          limit: mostRestrictiveLimit.limit,
          currentSpending: mostRestrictiveLimit.currentSpending,
          availableAmount,
          maxLiters,
          pricePerLiter: fuelPrice,
          isBlocked,
          source: mostRestrictiveLimit.source
        });

        if (isBlocked) {
          // Completely blocked - no money available
          return;
        }
      } else {
        // No limits set
        setSpendingLimitInfo(null);
      }

      // Proceed to authorized
      setCurrentStep('authorized');
    } catch (err) {
      console.error('Error checking spending limits:', err);
      setError('Failed to verify spending limits.');
      setCurrentStep('garage_selection');
    }
  };

  const handleBarcodeScan = async (barcodeData: string) => {
    console.log('=== BARCODE SCAN STARTED ===');
    console.log('Barcode data received:', barcodeData);
    console.log('Drawn vehicle:', drawnVehicle);

    setLicenseDiskScan({ image: '', extractedText: barcodeData });
    setShowBarcodeScanner(false);

    if (!drawnVehicle) {
      setError('No vehicle drawn. Cannot verify license disk.');
      return;
    }

    const verified = await verifyLicenseDisk(barcodeData, drawnVehicle);
    console.log('License disk verification result:', verified);

    if (!verified) {
      setError('License disk verification failed. The scanned license disk does not match your drawn vehicle.');
      setLicenseDiskScan(null);
      return;
    }

    setCurrentStep('spending_check');
    await checkSpendingLimits();
  };


  const verifyLicenseDisk = async (barcodeData: string, vehicle: Vehicle): Promise<boolean> => {
    console.log('Raw barcode data:', barcodeData);
    console.log('Verifying against vehicle:', { reg: vehicle.registration_number, vin: vehicle.vin_number });

    const barcodeFields = barcodeData.split('%');
    console.log('Barcode fields:', barcodeFields);

    let extractedVinFromBarcode = '';

    // Extract VIN from barcode
    for (let i = 0; i < barcodeFields.length; i++) {
      const field = barcodeFields[i].trim();
      if (field.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(field)) {
        extractedVinFromBarcode = field.toUpperCase();
        console.log('Extracted VIN from barcode:', extractedVinFromBarcode);
        break;
      }
    }

    const vehicleReg = vehicle.registration_number.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    const vehicleVin = vehicle.vin_number?.trim().toUpperCase() || '';

    console.log(`Checking vehicle: ${vehicle.registration_number} (cleaned: ${vehicleReg}, VIN: ${vehicleVin})`);

    // Check if any barcode field matches the registration number
    let registrationMatch = false;
    for (const field of barcodeFields) {
      const cleanField = field.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
      console.log(`  Comparing field "${cleanField}" with "${vehicleReg}"`);

      if (cleanField && cleanField === vehicleReg) {
        console.log(`✓ Match found! Field "${field}" matches vehicle ${vehicle.registration_number}`);
        registrationMatch = true;
        break;
      }
    }

    if (!registrationMatch) {
      console.log('❌ Registration number not found in barcode');
      setError(`License disk does not match vehicle ${vehicle.registration_number}`);
      return false;
    }

    // Check license disk expiry
    const expiryDate = new Date(vehicle.license_disk_expiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
      setError('Vehicle license disk has expired');
      return false;
    }

    // Verify VIN if both are available
    if (vehicleVin && extractedVinFromBarcode && vehicleVin !== extractedVinFromBarcode) {
      console.log(`VIN mismatch: vehicle VIN "${vehicleVin}" vs barcode VIN "${extractedVinFromBarcode}"`);
      setError(`VIN verification failed. Barcode VIN (${extractedVinFromBarcode}) does not match vehicle VIN (${vehicleVin}).`);
      return false;
    }

    // Store extracted VIN
    if (extractedVinFromBarcode) {
      setExtractedVin(extractedVinFromBarcode);
    }

    console.log(`✓ License disk verification passed for ${vehicle.registration_number}`);
    return true;
  };


  const handleGarageSelection = async () => {
    setError('');
    setPaymentCheckError('');
    setLoading(true);

    if (!selectedGarageId) {
      setError('Please select a garage.');
      setLoading(false);
      return;
    }

    if (!drawnVehicle) {
      setError('No vehicle drawn.');
      setLoading(false);
      return;
    }

    const selectedGarage = garages.find(g => g.id === selectedGarageId);
    if (!selectedGarage) {
      setError('Garage not found.');
      setLoading(false);
      return;
    }

    // Validate payment method for this org + garage combo before proceeding
    try {
      const [{ data: organization }, { data: garageAccount }] = await Promise.all([
        supabase
          .from('organizations')
          .select('payment_option, daily_spending_limit, monthly_spending_limit')
          .eq('id', drawnVehicle.organization_id)
          .maybeSingle(),
        supabase
          .from('organization_garage_accounts')
          .select('account_number, monthly_spend_limit')
          .eq('organization_id', drawnVehicle.organization_id)
          .eq('garage_id', selectedGarage.id)
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      if (garageAccount) {
        // Local account exists for this garage — use it
        setPaymentOption('Local Account');
        setIsLocalAccount(true);
        setGarageAccountNumber(garageAccount.account_number);
        setPaymentCheckError('');
      } else {
        // No local account — check if card payment is available
        const orgPaymentOption = organization?.payment_option || 'Card Payment';

        if (orgPaymentOption === 'Local Account') {
          // Org is local-account only but no account at this garage
          setPaymentCheckError(`No local account found for this garage. Please contact your administrator to set one up.`);
          setLoading(false);
          return;
        }

        const { data: paymentCard } = await supabase
          .from('organization_payment_cards')
          .select('id')
          .eq('organization_id', drawnVehicle.organization_id)
          .eq('is_active', true)
          .eq('is_default', true)
          .maybeSingle();

        if (!paymentCard) {
          setPaymentCheckError('No payment method available. No local account exists for this garage and no active payment card is loaded. Please contact your administrator.');
          setLoading(false);
          return;
        }

        setPaymentOption('Card Payment');
        setIsLocalAccount(false);
        setPaymentCheckError('');
      }
    } catch (err: any) {
      console.error('Payment validation error:', err);
      setError('Failed to validate payment method. Please try again.');
      setLoading(false);
      return;
    }

    const proximityCheck = checkLocationProximity(selectedGarage);
    setDistanceFromGarage(proximityCheck.distance);
    setLocationMismatch(!proximityCheck.isNear);
    setCurrentStep('location_confirmation');
    setLoading(false);
  };

  const proceedToScan = () => {
    setCurrentStep('license_scan');
    setShowBarcodeScanner(true);
  };

  const skipLicenseScanForTesting = async () => {
    console.log('⚠️ BYPASSING LICENSE SCAN FOR TESTING');
    setLicenseDiskScan({ image: '', extractedText: 'TESTING_MODE_BYPASS' });
    setCurrentStep('spending_check');
    await checkSpendingLimits();
  };

  const handleFuelDetailsSubmit = () => {
    console.log('[FuelPurchase] 🔵 handleFuelDetailsSubmit called');
    console.log('[FuelPurchase] Form data:', formData);

    if (!formData.liters || !formData.pricePerLiter || !formData.odometerReading) {
      console.error('[FuelPurchase] ❌ Missing required fields');
      setError('Please fill in all fuel details.');
      return;
    }

    console.log('[FuelPurchase] ✅ All required fields present, proceeding to PIN verification...');
    setError('');
    setCurrentStep('pin_entry');
  };

  const completeFuelTransaction = async () => {
    setError('');
    setLoading(true);

    console.log('[FuelPurchase] ==========================================');
    console.log('[FuelPurchase] Starting transaction submission...');
    console.log('[FuelPurchase] Current step:', currentStep);
    console.log('[FuelPurchase] isLocalAccount:', isLocalAccount);
    console.log('[FuelPurchase] ==========================================');

    const selectedGarage = garages.find(g => g.id === selectedGarageId);
    if (!selectedGarage) {
      setError('Please select a garage.');
      setLoading(false);
      return;
    }

    const totalAmount = parseFloat(formData.totalAmount);
    const commissionRate = selectedGarage.commission_rate;
    const commissionAmount = (totalAmount * commissionRate) / 100;
    const netAmount = totalAmount - commissionAmount;

    try {
      // Get the previous odometer reading for this vehicle
      const { data: lastTransaction } = await supabase
        .from('fuel_transactions')
        .select('odometer_reading')
        .eq('vehicle_id', drawnVehicle.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get driver token from local storage
      const driverToken = localStorage.getItem('driverToken');
      if (!driverToken) {
        console.error('[FuelPurchase] No driver token found in localStorage');
        throw new Error('Driver session expired. Please login again.');
      }

      console.log('[FuelPurchase] Calling edge function to create transaction...');

      // Call edge function to create transaction
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-fuel-transaction`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'X-Driver-Token': driverToken,
        },
        body: JSON.stringify({
          vehicleId: drawnVehicle.id,
          garageId: selectedGarageId,
          liters: parseFloat(formData.liters),
          pricePerLiter: parseFloat(formData.pricePerLiter),
          totalAmount,
          commissionRate,
          commissionAmount,
          netAmount,
          previousOdometerReading: lastTransaction?.odometer_reading || null,
          odometerReading: parseInt(formData.odometerReading),
          location: location ? `${location.lat},${location.lng}` : 'Unknown',
          fuelType: drawnVehicle.fuel_type || 'Diesel-50',
          licenseDiskImage: licenseDiskScan?.image,
          oilQuantity: purchasingOil && formData.oilQuantity ? parseFloat(formData.oilQuantity) : 0,
          oilUnitPrice: purchasingOil && formData.oilUnitPrice ? parseFloat(formData.oilUnitPrice) : 0,
          oilTotalAmount: purchasingOil && formData.oilTotalAmount ? parseFloat(formData.oilTotalAmount) : 0,
          oilType: purchasingOil ? formData.oilType : null,
          oilBrand: purchasingOil ? formData.oilBrand : null,
          isMockLocation: locationMetadata?.isMock || false,
          locationAccuracy: locationMetadata?.accuracy || null,
          locationProvider: locationMetadata?.provider || null,
        }),
      });

      console.log('[FuelPurchase] Response status:', response.status);
      console.log('[FuelPurchase] Response ok?', response.ok);

      const result = await response.json();
      console.log('[FuelPurchase] Response data:', result);

      if (!response.ok) {
        console.error('[FuelPurchase] ❌ Transaction failed with status:', response.status);
        console.error('[FuelPurchase] ❌ Error details:', result);

        // Only treat as session expiration if we get the specific error code
        if (result.code === 'SESSION_EXPIRED' ||
            (response.status === 401 && (
              result.error === 'Invalid or expired session' ||
              result.error === 'Session expired' ||
              result.error === 'Driver token required'
            ))) {
          console.warn('[FuelPurchase] Session expired, logging out driver');
          localStorage.removeItem('driverToken');
          localStorage.removeItem('driverData');
          setError('Your session has expired. Redirecting to login...');
          setTimeout(() => {
            if (onLogout) {
              onLogout();
            }
          }, 2000);
          return;
        }
        throw new Error(result.error || 'Failed to create transaction');
      }

      console.log('[FuelPurchase] Transaction created successfully:', result.transaction?.id);

      // Check for warnings in the response
      if (result.warning && result.warningType === 'tank_capacity') {
        setTransactionWarning(result.warning);
        console.log('[FuelPurchase] ⚠️ Tank capacity warning received:', result.warning);
      }

      if (locationMismatch && distanceFromGarage !== null) {
        const { error: exceptionError } = await supabase
          .from('vehicle_exceptions')
          .insert({
            vehicle_id: drawnVehicle.id,
            driver_id: driver.id,
            organization_id: driver.organizationId,
            exception_type: 'gps_location_mismatch',
            description: `GPS location mismatch detected during fuel purchase. Driver location was ${distanceFromGarage.toFixed(2)} km away from garage ${selectedGarage.name}.`,
            expected_value: selectedGarage.latitude && selectedGarage.longitude
              ? `${selectedGarage.latitude},${selectedGarage.longitude}`
              : 'Unknown',
            actual_value: `${location?.lat},${location?.lng}`,
            resolved: false,
          });

        if (exceptionError) {
          console.error('Failed to log location exception:', exceptionError);
        }
      }

      const efficiency = await calculateFuelEfficiency(
        drawnVehicle.id,
        parseInt(formData.odometerReading),
        parseFloat(formData.liters)
      );
      setFuelEfficiency(efficiency);

      // Route to appropriate payment flow based on payment option
      console.log('[FuelPurchase] ✅ Transaction created successfully!');
      console.log('[FuelPurchase] ==========================================');
      console.log('[FuelPurchase] PAYMENT DECISION LOGIC:');
      console.log('[FuelPurchase] Current paymentOption state:', paymentOption);
      console.log('[FuelPurchase] isLocalAccount:', isLocalAccount);
      console.log('[FuelPurchase] ==========================================');

      if (paymentOption === 'Local Account' || paymentOption === 'Card Payment') {
        // PIN was already verified before this point — go straight to scan_to_till
        console.log('[FuelPurchase] ✅ Transaction created, moving to scan_to_till for:', paymentOption);
        setCurrentStep('scan_to_till');
      }
    } catch (err: any) {
      console.error('[FuelPurchase] ❌❌❌ CRITICAL ERROR ❌❌❌');
      console.error('[FuelPurchase] Error in completeFuelTransaction:', err);
      console.error('[FuelPurchase] Error message:', err.message);
      console.error('[FuelPurchase] Error stack:', err.stack);
      setError(err.message || 'Failed to submit transaction');
    } finally {
      console.log('[FuelPurchase] completeFuelTransaction finished. Setting loading to false.');
      setLoading(false);
    }
  };

  const calculateFuelEfficiency = async (
    vehicleId: string,
    currentOdometer: number,
    litersPurchased: number
  ): Promise<number | null> => {
    try {
      const { data: previousTransaction } = await supabase
        .from('fuel_transactions')
        .select('odometer_reading')
        .eq('vehicle_id', vehicleId)
        .order('authorized_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousTransaction && previousTransaction.odometer_reading) {
        const kmTravelled = currentOdometer - previousTransaction.odometer_reading;
        if (kmTravelled > 0 && litersPurchased > 0) {
          return kmTravelled / litersPurchased;
        }
      }
    } catch (err) {
      console.error('Error calculating fuel efficiency:', err);
    }
    return null;
  };

  const resetForm = () => {
    setLicenseDiskScan(null);
    setExtractedVin('');
    setFormData({
      liters: '',
      pricePerLiter: '',
      totalAmount: '',
      odometerReading: '',
      oilQuantity: '',
      oilUnitPrice: '',
      oilTotalAmount: '',
      oilType: '',
      oilBrand: '',
    });
    setPurchasingOil(false);
    setSelectedGarageId('');
    setSuccess(false);
    setFuelEfficiency(null);
    setError('');
    setLocationMismatch(false);
    setDistanceFromGarage(null);
    setTransactionWarning(null);
    setCurrentStep('garage_selection');
    setShowBarcodeScanner(false);
    setNfcStatus('idle');
    setShowAccountDetails(false);
    loadDrawnVehicle();
  };

  const writeToNFC = async () => {
    if (!drawnVehicle) {
      setNfcStatus('failed');
      return;
    }

    // Validate we have the correct payment data
    if (paymentOption === 'Local Account' && !garageAccountNumber) {
      setNfcStatus('failed');
      return;
    }
    if (paymentOption === 'Card Payment' && !encryptedCardData) {
      setNfcStatus('failed');
      return;
    }

    try {
      // Check if Web NFC is supported
      if (!('NDEFReader' in window)) {
        setNfcStatus('not_supported');
        setShowAccountDetails(true);
        return;
      }

      setNfcStatus('writing');

      const ndef = new (window as any).NDEFReader();

      // Prepare the data to write based on payment option
      let nfcData: any;

      if (paymentOption === 'Local Account') {
        // Send local account number for local account payment
        nfcData = {
          paymentType: 'local_account',
          accountNumber: garageAccountNumber,
          vehicleNumber: drawnVehicle.vehicle_number || drawnVehicle.registration_number,
          amount: formData.totalAmount,
          liters: formData.liters,
          timestamp: new Date().toISOString()
        };
      } else if (paymentOption === 'Card Payment') {
        // Send encrypted card details for card payment
        nfcData = {
          paymentType: 'card_payment',
          encryptedCardData: {
            cardNumberEncrypted: encryptedCardData.card_number_encrypted,
            cardHolderNameEncrypted: encryptedCardData.card_holder_name_encrypted,
            expiryMonthEncrypted: encryptedCardData.expiry_month_encrypted,
            expiryYearEncrypted: encryptedCardData.expiry_year_encrypted,
            cvvEncrypted: encryptedCardData.cvv_encrypted,
            ivCardNumber: encryptedCardData.iv_card_number,
            ivHolderName: encryptedCardData.iv_holder_name,
            ivExpiryMonth: encryptedCardData.iv_expiry_month,
            ivExpiryYear: encryptedCardData.iv_expiry_year,
            ivCvv: encryptedCardData.iv_cvv,
            encryptionKeyId: encryptedCardData.encryption_key_id,
            cardBrand: encryptedCardData.card_brand,
            lastFourDigits: encryptedCardData.last_four_digits
          },
          vehicleNumber: drawnVehicle.vehicle_number || drawnVehicle.registration_number,
          amount: formData.totalAmount,
          liters: formData.liters,
          timestamp: new Date().toISOString()
        };
      }

      await ndef.write({
        records: [
          { recordType: "text", data: JSON.stringify(nfcData) }
        ]
      });

      setNfcStatus('success');

    } catch (err: any) {
      console.error('NFC write error:', err);
      setNfcStatus('failed');

      // Show account details as fallback
      if (err.name === 'NotAllowedError' || err.name === 'NotSupportedError') {
        setShowAccountDetails(true);
      }
    }
  };

  useEffect(() => {
    if (formData.liters && formData.pricePerLiter) {
      const total = (parseFloat(formData.liters) * parseFloat(formData.pricePerLiter)).toFixed(2);
      setFormData(prev => ({ ...prev, totalAmount: total }));
    }
  }, [formData.liters, formData.pricePerLiter]);

  useEffect(() => {
    if (selectedGarageId && (currentStep === 'authorized' || currentStep === 'fuel_details')) {
      const selectedGarage = garages.find(g => g.id === selectedGarageId);
      console.log('[FuelPurchase] Setting price - Garage:', selectedGarage?.name);
      console.log('[FuelPurchase] Vehicle fuel type:', drawnVehicle?.fuel_type);
      console.log('[FuelPurchase] Garage fuel prices:', selectedGarage?.fuel_prices);

      if (!drawnVehicle?.fuel_type) {
        console.error('[FuelPurchase] Vehicle has no fuel_type set');
        setError('This vehicle does not have a fuel type set. Please contact your administrator to set the fuel type for this vehicle.');
        return;
      }

      // Check if garage has fuel prices and if the specific fuel type has a price
      const price = selectedGarage?.fuel_prices?.[drawnVehicle.fuel_type];
      console.log('[FuelPurchase] Price for', drawnVehicle.fuel_type, '=', price);

      if (price) {
        // Garage has a set price - use it
        setFormData(prev => ({ ...prev, pricePerLiter: price.toFixed(2) }));
        setError(''); // Clear any previous errors
        console.log('[FuelPurchase] Using garage set price:', price);
      } else {
        // No price available - allow manual entry
        console.log('[FuelPurchase] No price found for fuel type:', drawnVehicle.fuel_type, '- allowing manual entry');
        setFormData(prev => ({ ...prev, pricePerLiter: '' })); // Clear price to allow manual entry
        setError(''); // Clear any errors - manual entry is allowed
      }
    }
  }, [selectedGarageId, drawnVehicle, garages, currentStep]);

  // Debug: Log current render state
  console.log('[FuelPurchase] 🎨 Rendering component. Current step:', currentStep, 'Loading:', loading, 'Success:', success, 'Payment Option:', paymentOption);

  if (currentStep === 'location_confirmation') {
    const selectedGarage = garages.find(g => g.id === selectedGarageId);
    return (
      <div className={`min-h-screen ${locationMismatch ? 'bg-amber-50' : 'bg-green-50'} flex items-center justify-center p-4`}>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          {locationMismatch ? (
            <AlertCircle className="w-16 h-16 text-amber-600 mx-auto mb-4" />
          ) : (
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          )}
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Location Verification</h2>

          {locationMismatch ? (
            <div className="bg-amber-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-amber-900 mb-3 text-center">
                Your location does not match the selected garage location
              </p>

              {distanceFromGarage !== null && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-amber-700">Distance from garage:</span>
                    <span className="font-bold text-amber-900">
                      {distanceFromGarage < 1
                        ? `${(distanceFromGarage * 1000).toFixed(0)} meters`
                        : `${distanceFromGarage.toFixed(2)} km`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-amber-700">Maximum allowed:</span>
                    <span className="font-bold text-amber-900">500 meters</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-green-900 mb-2 text-center">
                Location Confirmed
              </p>
              {distanceFromGarage !== null && (
                <p className="text-xs text-green-700 text-center">
                  You are {distanceFromGarage < 1
                    ? `${(distanceFromGarage * 1000).toFixed(0)} meters`
                    : `${distanceFromGarage.toFixed(2)} km`} from the garage
                </p>
              )}
            </div>
          )}

          {selectedGarage && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-blue-900 mb-2">Selected Garage:</p>
              <p className="text-base font-bold text-blue-900">{selectedGarage.name}</p>
              <p className="text-sm text-blue-700">{selectedGarage.address}, {selectedGarage.city}</p>
            </div>
          )}

          {locationMismatch && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-xs font-medium text-red-900 mb-2">Important:</p>
              <p className="text-xs text-red-800 mb-2">
                Refueling should only be done at the selected garage location. If you proceed, an exception report will be logged for investigation.
              </p>
              <p className="text-xs text-red-700">
                Please ensure you are at the correct garage before proceeding.
              </p>
            </div>
          )}

          {locationMetadata?.isMock && (
            <div className="bg-red-100 border-2 border-red-400 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-900 mb-2">GPS WARNING</p>
                  <p className="text-xs text-red-800 mb-2">
                    Suspicious GPS behavior detected. This transaction will be flagged for review.
                  </p>
                  {locationMetadata.accuracy && (
                    <p className="text-xs text-red-700">
                      GPS Accuracy: {locationMetadata.accuracy.toFixed(1)}m | Provider: {locationMetadata.provider}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {SKIP_LICENSE_SCAN_FOR_TESTING ? (
              <>
                <button
                  onClick={skipLicenseScanForTesting}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Continue (Testing Mode - No License Scan)
                </button>
                <button
                  onClick={proceedToScan}
                  className="w-full bg-gray-300 hover:bg-gray-400 text-gray-700 py-3 rounded-lg font-semibold transition-colors text-sm"
                >
                  Scan License Disk (Optional)
                </button>
              </>
            ) : (
              <button
                onClick={proceedToScan}
                className={`w-full ${locationMismatch ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white py-3 rounded-lg font-semibold transition-colors`}
              >
                Continue to Refuel
              </button>
            )}

            <button
              onClick={() => {
                setCurrentStep('garage_selection');
                setLocationMismatch(false);
                setDistanceFromGarage(null);
              }}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'license_scan' && showBarcodeScanner) {
    return (
      <BarcodeScanner
        label="Scan License Disk to Verify Vehicle"
        onScan={handleBarcodeScan}
        onCancel={() => {
          setShowBarcodeScanner(false);
          setCurrentStep('location_confirmation');
        }}
      />
    );
  }

  if (currentStep === 'spending_check') {
    if (spendingLimitInfo?.isBlocked) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Spending Limit Reached</h2>

            <div className="bg-red-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-red-900 mb-3 text-center">
                {spendingLimitInfo.source === 'driver' && 'Your personal'}
                {spendingLimitInfo.source === 'organization' && 'Your organization\'s'}
                {spendingLimitInfo.source === 'garage' && 'The garage account\'s'}
                {' '}{spendingLimitInfo.type} spending limit has been reached
              </p>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-red-700">Limit source:</span>
                  <span className="font-bold text-red-900 capitalize">{spendingLimitInfo.source}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-red-700">Current spending:</span>
                  <span className="font-bold text-red-900">R {spendingLimitInfo.currentSpending.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-red-700">{spendingLimitInfo.type === 'daily' ? 'Daily' : 'Monthly'} limit:</span>
                  <span className="font-bold text-red-900">R {spendingLimitInfo.limit.toFixed(2)}</span>
                </div>
                <div className="border-t border-red-200 my-2"></div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-red-700">Available:</span>
                  <span className="font-bold text-red-900">R 0.00</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-xs text-amber-800">
                {spendingLimitInfo.source === 'driver' && 'Your personal'}
                {spendingLimitInfo.source === 'organization' && 'Your organization\'s'}
                {spendingLimitInfo.source === 'garage' && 'The garage account\'s'}
                {' '}{spendingLimitInfo.type} spending limit has been fully used.
                {spendingLimitInfo.source === 'driver' && ' Please contact your fleet manager for assistance.'}
                {spendingLimitInfo.source === 'organization' && ' Please contact your fleet manager to request a limit increase or wait until the limit resets.'}
                {spendingLimitInfo.source === 'garage' && ' Please contact your organization to increase the garage account limit or use a different payment method.'}
              </p>
            </div>

            <button
              onClick={() => {
                setSpendingLimitInfo(null);
                setCurrentStep('garage_selection');
                setShowBarcodeScanner(false);
                setLicenseDiskScan(null);
                if (onComplete) onComplete();
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Back to Driver's Main Menu
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Checking Spending Limits</h2>
          <p className="text-gray-600 text-sm">Verifying your organization's daily and monthly spending limits...</p>
        </div>
      </div>
    );
  }

  if (currentStep === 'authorized') {
    const selectedGarage = garages.find(g => g.id === selectedGarageId);
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Authorized to Refuel</h2>

          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-green-900 mb-2 text-center">
              License disk verified successfully
            </p>
            <p className="text-xs text-green-700 text-center">
              You are authorized to refuel at the selected garage
            </p>
          </div>

          {spendingLimitInfo && !spendingLimitInfo.isBlocked && (
            <div className="bg-red-50 border-4 border-red-500 rounded-lg p-5 mb-6 shadow-lg">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1">
                  <p className="text-lg font-extrabold text-red-900 mb-2">SPENDING LIMIT ACTIVE</p>
                  <p className="text-sm font-bold text-red-800 mb-2">
                    {spendingLimitInfo.source === 'driver' && 'YOUR PERSONAL LIMIT:'}
                    {spendingLimitInfo.source === 'organization' && 'ORGANIZATION LIMIT:'}
                    {spendingLimitInfo.source === 'garage' && 'GARAGE ACCOUNT LIMIT:'}
                    {' '}
                    <span className="text-2xl text-red-900">R {spendingLimitInfo.availableAmount.toFixed(2)}</span>
                  </p>
                  <div className="bg-red-100 border-2 border-red-400 rounded-md p-3 mb-3">
                    <p className="text-xs font-bold text-red-900 mb-1">
                      ⚠️ FUEL CANNOT BE RETURNED ONCE PUMPED
                    </p>
                    <p className="text-xs text-red-800">
                      If you exceed the spending limit below, payment will be DECLINED and you will be responsible for the fuel already in your tank.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 space-y-3 border-2 border-red-300">
                <div className="text-center pb-3">
                  <p className="text-xs text-gray-600 mb-1">DO NOT EXCEED THIS AMOUNT</p>
                  <p className="text-4xl font-bold text-red-700 mb-2">R {spendingLimitInfo.availableAmount.toFixed(2)}</p>
                  <p className="text-base font-bold text-red-900 mb-1">
                    {spendingLimitInfo.source === 'driver' && '(Your personal daily limit)'}
                    {spendingLimitInfo.source === 'organization' && '(Organization limit)'}
                    {spendingLimitInfo.source === 'garage' && '(Garage account limit)'}
                  </p>
                  {spendingLimitInfo.pricePerLiter > 0 ? (
                    <p className="text-sm text-gray-600">
                      Maximum fuel: <span className="font-bold text-amber-900">{spendingLimitInfo.maxLiters.toFixed(1)} L</span>
                      {' '}@ R {spendingLimitInfo.pricePerLiter.toFixed(2)}/L
                    </p>
                  ) : (
                    <p className="text-sm text-blue-600 font-medium">
                      Enter diesel price below to see max liters
                    </p>
                  )}
                </div>

                <div className="bg-red-100 rounded-lg p-3 border-2 border-red-400">
                  <p className="text-xs font-bold text-red-900 text-center mb-2">
                    IMPORTANT: DO NOT EXCEED THIS AMOUNT
                  </p>
                  <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                    <li>Refuel LESS than the maximum shown above</li>
                    <li>Leave a buffer for safety (e.g., 5-10% less)</li>
                    <li>Remember: oil purchases reduce available fuel amount</li>
                    <li>Once fuel is pumped, it CANNOT be returned</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {selectedGarage && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-blue-900 mb-2">Garage:</p>
              <p className="text-base font-bold text-blue-900">{selectedGarage.name}</p>
              <p className="text-sm text-blue-700">{selectedGarage.address}, {selectedGarage.city}</p>
            </div>
          )}

          {drawnVehicle && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-blue-900 mb-2">Vehicle:</p>
              <p className="text-base font-bold text-blue-900">{drawnVehicle.registration_number}</p>
              <p className="text-sm text-blue-700">{drawnVehicle.make} {drawnVehicle.model}</p>
            </div>
          )}

          {spendingLimitInfo && !spendingLimitInfo.isBlocked ? (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 mb-6">
              <p className="text-sm font-bold text-amber-900 mb-3">Next Steps - STAY WITHIN SPENDING LIMIT:</p>
              <ol className="text-sm text-amber-900 space-y-2 list-decimal list-inside font-medium">
                <li>Inform pump attendant of MAXIMUM amount: <strong>R {spendingLimitInfo.availableAmount.toFixed(2)}</strong></li>
                <li>Request LESS than maximum (leave 5-10% buffer for safety)</li>
                <li>Monitor pump carefully - stop BEFORE reaching limit</li>
                <li>Note exact fuel amount and odometer reading</li>
                <li>If buying oil, ensure total stays within the limit</li>
                <li>Return here to enter transaction details</li>
              </ol>
              <div className="mt-3 bg-red-100 border border-red-300 rounded-md p-2">
                <p className="text-xs font-bold text-red-900 text-center">
                  Remember: Payment will be DECLINED if you exceed the limit
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-gray-900 mb-2">Next Steps:</p>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Proceed to refuel your vehicle</li>
                <li>Note the fuel amount and odometer reading</li>
                <li>If purchasing oil, note quantity and price</li>
                <li>Return here to enter the details</li>
              </ol>
            </div>
          )}

          <button
            onClick={() => setCurrentStep('fuel_details')}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            I've Refueled - Enter Details
          </button>

          <button
            onClick={() => {
              setCurrentStep('garage_selection');
              setShowBarcodeScanner(false);
              setLicenseDiskScan(null);
            }}
            className="w-full mt-3 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancel Transaction
          </button>
        </div>
      </div>
    );
  }

  // PIN Entry Step for Local Account and Card Payment with garage limit
  if (currentStep === 'pin_entry') {
    console.log('[FuelPurchase] 🔐 Rendering PIN Entry Screen');
    const pinTitle = paymentOption === 'Local Account'
      ? 'Enter PIN and Scan to Garage Account System'
      : 'Enter PIN and Scan Card to Till';
    const pinDescription = paymentOption === 'Local Account'
      ? 'Enter your PIN to authorise the local account payment.'
      : 'Enter your PIN to authorise the card payment.';

    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <AlertCircle className="w-16 h-16 text-amber-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{pinTitle}</h2>
            <p className="text-gray-600 text-sm">
              {pinDescription}
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Driver PIN
            </label>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter your 4-digit PIN"
              maxLength={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            onClick={async () => {
              if (pinInput.length !== 4) {
                setError('Please enter a 4-digit PIN');
                return;
              }

              setLoading(true);
              setError('');

              try {
                const response = await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-driver-pin`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                      driverId: driver.id,
                      pin: pinInput,
                    }),
                  }
                );

                const result = await response.json();

                if (!response.ok) {
                  if (result.requiresSetup) {
                    setError('PIN not set up. Please contact your administrator.');
                  } else if (result.locked) {
                    setError('Account locked for 30 minutes due to too many failed attempts.');
                  } else if (result.lockedUntil) {
                    setError('Account is temporarily locked. Please try again later.');
                  } else {
                    setError(result.error || 'Incorrect PIN. Please try again.');
                  }
                  setPinInput('');
                  setLoading(false);
                  return;
                }

                if (result.verified) {
                  setError('');
                  await completeFuelTransaction();
                }
              } catch (err: any) {
                setError(err.message || 'Failed to verify PIN');
                setPinInput('');
              } finally {
                setLoading(false);
              }
            }}
            disabled={pinInput.length !== 4 || loading}
            className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>

          <button
            onClick={() => {
              setCurrentStep('fuel_details');
              setPinInput('');
              setError('');
            }}
            className="w-full mt-3 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Scan to Till Step for Local Account and Card Payment with garage limit
  if (currentStep === 'scan_to_till') {
    const selectedGarage = garages.find(g => g.id === selectedGarageId);
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
          <Camera className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {nfcStatus === 'idle' || nfcStatus === 'writing'
              ? 'Tap to Till NFC Device'
              : 'Transaction Details'}
          </h2>

          {/* NFC Status Messages */}
          {nfcStatus === 'idle' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900 mb-3">
                Tap the <strong>Tap to NFC</strong> button below, then bring your phone close to the garage till's NFC reader.
              </p>
            </div>
          )}

          {nfcStatus === 'writing' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="animate-pulse">
                <p className="text-sm font-medium text-amber-900">
                  Hold your phone near the NFC reader...
                </p>
              </div>
            </div>
          )}

          {nfcStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-900">
                Data sent successfully! Wait for garage authorization.
              </p>
            </div>
          )}

          {nfcStatus === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-red-900 mb-2">
                NFC transmission failed
              </p>
              <p className="text-xs text-red-700">
                Use the button below to display account details manually
              </p>
            </div>
          )}

          {nfcStatus === 'not_supported' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-amber-900 mb-2">
                NFC not available on this device
              </p>
              <p className="text-xs text-amber-700">
                Account details shown below
              </p>
            </div>
          )}

          {/* NFC Tap Button */}
          {(nfcStatus === 'idle' || nfcStatus === 'failed') && (
            <button
              onClick={writeToNFC}
              disabled={nfcStatus === 'writing'}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mb-4"
            >
              <Camera className="w-5 h-5" />
              {nfcStatus === 'idle' ? 'Tap to NFC' : 'Try NFC Again'}
            </button>
          )}

          {/* Show Account Details Button or Details */}
          {(nfcStatus === 'failed' || nfcStatus === 'not_supported' || showAccountDetails) && (paymentOption === 'Local Account' ? garageAccountNumber : encryptedCardData) && (
            <>
              {!showAccountDetails && (
                <button
                  onClick={() => setShowAccountDetails(true)}
                  className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors mb-4 text-sm"
                >
                  Show Payment Details Manually
                </button>
              )}

              {showAccountDetails && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-amber-900 mb-3">
                    <strong>{paymentOption === 'Local Account' ? 'Account Details for Garage Till:' : 'Card Details for Till:'}</strong>
                  </p>
                  <div className="space-y-2">
                    {paymentOption === 'Local Account' ? (
                      <>
                        <div>
                          <p className="text-xs text-amber-700 mb-1">Account Number</p>
                          <p className="text-3xl font-bold text-amber-900">{garageAccountNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-amber-700 mb-1">Vehicle Number</p>
                          <p className="text-2xl font-bold text-amber-900">{drawnVehicle?.vehicle_number || drawnVehicle?.registration_number}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs text-amber-700 mb-1">Card</p>
                          <p className="text-2xl font-bold text-amber-900">{encryptedCardData?.card_brand} •••• {encryptedCardData?.last_four_digits}</p>
                        </div>
                        <div>
                          <p className="text-xs text-amber-700 mb-1">Vehicle Number</p>
                          <p className="text-2xl font-bold text-amber-900">{drawnVehicle?.vehicle_number || drawnVehicle?.registration_number}</p>
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-amber-700 mt-3 italic">
                    {paymentOption === 'Local Account'
                      ? 'Provide these numbers to the garage attendant'
                      : 'Encrypted card data will be transmitted via NFC'}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-gray-600 text-sm mb-1">
              Amount: <strong>R {parseFloat(formData.totalAmount).toFixed(2)}</strong>
            </p>
            <p className="text-gray-600 text-sm">
              Liters: <strong>{parseFloat(formData.liters).toFixed(2)} L</strong>
            </p>
          </div>

          <p className="text-sm text-gray-500 mb-6 italic">
            Wait for the garage attendant to authorize or decline the transaction.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => {
                console.log('[FuelPurchase] Garage authorized local account transaction');
                setCurrentStep('garage_selection'); // Reset step so success screen can show
                setSuccess(true);
              }}
              disabled={loading}
              className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-lg"
            >
              <CheckCircle className="w-6 h-6" />
              Authorized
            </button>

            <button
              onClick={() => {
                setError('Transaction was not authorized by the garage. Please try again or contact the garage.');
                resetForm();
              }}
              className="w-full bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-lg"
            >
              <XCircle className="w-6 h-6" />
              Not Authorized
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Transaction Authorized!</h2>
          <p className="text-gray-600 mb-6">
            {isLocalAccount
              ? 'Fuel purchase authorized. Payment will be processed via your local account.'
              : 'Card details transferred. When Card transaction is processed select OK.'
            }
          </p>

          {transactionWarning && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-amber-900 mb-1">Tank Capacity Warning</p>
                  <p className="text-xs text-amber-800">{transactionWarning}</p>
                </div>
              </div>
            </div>
          )}

          {fuelEfficiency !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-blue-900 mb-1">Fuel Efficiency</p>
              <p className="text-3xl font-bold text-blue-600">{fuelEfficiency.toFixed(2)}</p>
              <p className="text-sm text-blue-700">km per liter</p>
              <p className="text-xs text-blue-600 mt-2">Since last refueling</p>
            </div>
          )}

          <button
            onClick={() => {
              if (onComplete) {
                onComplete();
              } else {
                resetForm();
              }
            }}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            {isLocalAccount ? 'Return to Main Menu' : 'OK'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fuel className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">Fuel Purchase</h1>
              <p className="text-sm text-blue-100">Driver: {driver.firstName} {driver.lastName}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {SKIP_LICENSE_SCAN_FOR_TESTING && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-semibold">
          ⚠️ TESTING MODE: License disk scanning is disabled
        </div>
      )}

      <div className="p-4 max-w-2xl mx-auto">
        {loadingVehicle ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading vehicle information...</p>
          </div>
        ) : !drawnVehicle ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-900 font-medium mb-1">No Vehicle Drawn</p>
                <p className="text-amber-800 text-sm">{error || 'You must draw a vehicle before you can refuel. Please contact your administrator.'}</p>
              </div>
            </div>
            <button
              onClick={onComplete}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Driver's Main Menu
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {currentStep === 'garage_selection' ? 'Select Garage' : 'Enter Fuel Details'}
            </h2>

            {error && (
              <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-4 flex items-start gap-3 animate-pulse">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-900 font-semibold text-base mb-1">Error</p>
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 mb-4 flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-blue-800 font-medium">Processing transaction...</p>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900 font-medium mb-2">Your Drawn Vehicle:</p>
              <p className="text-xl font-bold text-blue-900">{drawnVehicle.registration_number}</p>
              <p className="text-sm text-blue-700">{drawnVehicle.make} {drawnVehicle.model}</p>
              <p className="text-xs text-blue-600 mt-2">License Expires: {new Date(drawnVehicle.license_disk_expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              {drawnVehicle.vin_number && (
                <p className="text-xs text-blue-600">VIN: {drawnVehicle.vin_number}</p>
              )}
              {drawnVehicle.tank_capacity && (
                <div className="bg-amber-100 border-2 border-amber-400 rounded-lg px-3 py-2 mt-3">
                  <p className="text-sm text-amber-900 font-bold">⛽ Tank Capacity: {drawnVehicle.tank_capacity}L</p>
                  <p className="text-xs text-amber-800 mt-1">Maximum refuel allowed: {drawnVehicle.tank_capacity + 2}L (includes 2L buffer)</p>
                </div>
              )}
            </div>

            {location && (
              <div className="bg-green-50 rounded-lg p-3 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Location Captured</p>
                  <p className="text-xs text-green-700">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                </div>
              </div>
            )}

            {currentStep === 'garage_selection' && (
              <div className="space-y-4">
                {/* Nearest garage auto-detected card */}
                {detectingGarage || (garages.length > 0 && !nearestGarage && location) ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-gray-600">Detecting nearest garage...</p>
                    </div>
                  </div>
                ) : nearestGarage ? (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Nearest garage detected
                    </p>

                    <div className="rounded-xl border-2 border-blue-500 bg-blue-50 p-4 mb-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-lg font-bold text-blue-900">{nearestGarage.name}</p>
                          <p className="text-sm text-blue-700">{nearestGarage.address}{nearestGarage.address_line_2 ? `, ${nearestGarage.address_line_2}` : ''}</p>
                          <p className="text-sm text-blue-700">{nearestGarage.city}{nearestGarage.province ? `, ${nearestGarage.province}` : ''}</p>
                          {nearestGarage.phone && <p className="text-sm text-blue-600 mt-1">Tel: {nearestGarage.phone}</p>}
                        </div>
                        <div className="ml-3 text-right flex-shrink-0">
                          {distanceFromGarage !== null && (
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${distanceFromGarage <= 0.5 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              {distanceFromGarage < 1
                                ? `${(distanceFromGarage * 1000).toFixed(0)}m`
                                : `${distanceFromGarage.toFixed(1)}km`}
                            </span>
                          )}
                          {nearestGarage.accountNumber && (
                            <span className="block mt-1 px-2 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                              Local Account
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Payment method indicator */}
                    {nearestGarage.accountNumber ? (
                      <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-lg mb-3">
                        <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0" />
                        <p className="text-sm text-teal-800">Local account available — payment via account number</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-3">
                        <CheckCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <p className="text-sm text-gray-700">Payment via card</p>
                      </div>
                    )}

                    {paymentCheckError && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800">{paymentCheckError}</p>
                      </div>
                    )}

                    {distanceFromGarage !== null && distanceFromGarage > 0.5 && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                          You are {distanceFromGarage < 1 ? `${(distanceFromGarage * 1000).toFixed(0)} meters` : `${distanceFromGarage.toFixed(1)} km`} from this garage. If this is not correct, select a different garage below.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleGarageSelection}
                      disabled={loading || !!paymentCheckError}
                      className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-base mb-3"
                    >
                      {loading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying...</>
                      ) : (
                        <><CheckCircle className="w-5 h-5" /> Confirm — {nearestGarage.name}</>
                      )}
                    </button>

                    {/* Separator */}
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 font-medium">Not the right garage?</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* Manual override dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Select a different garage</label>
                      <select
                        value={selectedGarageId}
                        onChange={(e) => {
                          setSelectedGarageId(e.target.value);
                          setPaymentCheckError('');
                          const g = garages.find(x => x.id === e.target.value);
                          if (g) {
                            setNearestGarage(g);
                            if (location && g.latitude && g.longitude) {
                              const d = calculateDistance(location.lat, location.lng, g.latitude, g.longitude);
                              setDistanceFromGarage(d);
                              setLocationMismatch(d > 0.5);
                            } else {
                              setDistanceFromGarage(null);
                              setLocationMismatch(false);
                            }
                          }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="">Choose a garage...</option>
                        {garages.map((garage) => (
                          <option key={garage.id} value={garage.id}>
                            {garage.name} — {garage.city}{garage.accountNumber ? ' (Local Account)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* Fallback: no GPS coords available — show dropdown */
                  <div>
                    {!location && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <p className="text-sm text-amber-800">Location not available. Please select your garage manually.</p>
                      </div>
                    )}

                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Garage</label>
                    <select
                      value={selectedGarageId}
                      onChange={(e) => {
                        setSelectedGarageId(e.target.value);
                        setPaymentCheckError('');
                        const g = garages.find(x => x.id === e.target.value);
                        if (g) {
                          if (location && g.latitude && g.longitude) {
                            const d = calculateDistance(location.lat, location.lng, g.latitude, g.longitude);
                            setDistanceFromGarage(d);
                            setLocationMismatch(d > 0.5);
                          }
                        }
                      }}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3"
                    >
                      <option value="">Choose a garage to refuel at</option>
                      {garages.map((garage) => (
                        <option key={garage.id} value={garage.id}>
                          {garage.name} — {garage.city}{garage.accountNumber ? ' (Local Account)' : ''}
                        </option>
                      ))}
                    </select>

                    {paymentCheckError && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800">{paymentCheckError}</p>
                      </div>
                    )}

                    <button
                      onClick={handleGarageSelection}
                      disabled={loading || !selectedGarageId}
                      className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying...</>
                      ) : (
                        <><MapPin className="w-5 h-5" /> Continue</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentStep === 'fuel_details' && (
              <>
                {spendingLimitInfo && !spendingLimitInfo.isBlocked && (
                  <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-amber-900 mb-1">Spending Limit Active</p>
                        <p className="text-xs text-amber-800 mb-2">
                          Your {spendingLimitInfo.type} spending limit restricts total transaction amount
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-700">Available to spend:</span>
                        <span className="text-base font-bold text-amber-900">R {spendingLimitInfo.availableAmount.toFixed(2)}</span>
                      </div>

                      {(() => {
                        const currentTotal = parseFloat(formData.totalAmount || '0');
                        const oilTotal = parseFloat(formData.oilTotalAmount || '0');
                        const fuelTotal = currentTotal - oilTotal;
                        const percentage = (currentTotal / spendingLimitInfo.availableAmount) * 100;
                        const isOverLimit = currentTotal > spendingLimitInfo.availableAmount;

                        return (
                          <>
                            {currentTotal > 0 && (
                              <>
                                <div className="border-t border-amber-200 pt-2">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-gray-700">Current transaction:</span>
                                    <span className={`text-sm font-bold ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
                                      R {currentTotal.toFixed(2)}
                                    </span>
                                  </div>
                                  {oilTotal > 0 && (
                                    <div className="text-xs text-gray-600 ml-4 space-y-0.5">
                                      <div className="flex justify-between">
                                        <span>- Fuel:</span>
                                        <span>R {fuelTotal.toFixed(2)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>- Oil:</span>
                                        <span>R {oilTotal.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="border-t border-amber-200 pt-2">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-gray-700">Remaining:</span>
                                    <span className={`text-sm font-bold ${isOverLimit ? 'text-red-600' : 'text-green-600'}`}>
                                      R {Math.max(0, spendingLimitInfo.availableAmount - currentTotal).toFixed(2)}
                                    </span>
                                  </div>

                                  <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                      className={`h-3 rounded-full transition-all ${
                                        isOverLimit
                                          ? 'bg-red-500'
                                          : percentage >= 90
                                          ? 'bg-amber-500'
                                          : percentage >= 75
                                          ? 'bg-yellow-500'
                                          : 'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(percentage, 100)}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-center mt-1 text-gray-600">
                                    {percentage.toFixed(0)}% of limit
                                  </p>
                                </div>
                              </>
                            )}

                            {isOverLimit && currentTotal > 0 && (
                              <div className="border-t-2 border-red-300 pt-2 mt-2">
                                <p className="text-xs font-bold text-red-700 text-center">
                                  ⚠️ EXCEEDS SPENDING LIMIT - Payment will be declined
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      <div className="border-t border-amber-200 pt-2 mt-2">
                        <p className="text-xs text-amber-700 text-center">
                          Ensure fuel + oil total stays within the available amount
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Liters</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.liters}
                      onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                      className={`w-full border rounded-lg px-4 py-3 ${
                        drawnVehicle?.tank_capacity && parseFloat(formData.liters || '0') > (drawnVehicle.tank_capacity + 2)
                          ? 'border-red-400 bg-red-50'
                          : 'border-gray-300'
                      }`}
                      placeholder="50.00"
                      required
                    />
                    {drawnVehicle?.tank_capacity && parseFloat(formData.liters || '0') > (drawnVehicle.tank_capacity + 2) && (
                      <div className="mt-2 bg-red-50 border-2 border-red-400 rounded-lg p-3">
                        <p className="text-sm font-bold text-red-900">⚠️ EXCEEDS TANK CAPACITY!</p>
                        <p className="text-xs text-red-800 mt-1">
                          You entered {formData.liters}L but tank capacity is {drawnVehicle.tank_capacity}L.
                          Maximum allowed: {drawnVehicle.tank_capacity + 2}L
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price per Liter (R)
                      {selectedGarageId && !formData.pricePerLiter && drawnVehicle?.fuel_type?.startsWith('Diesel') && (
                        <span className="text-blue-600 text-xs ml-2">- Enter price manually</span>
                      )}
                      {drawnVehicle?.fuel_type?.startsWith('ULP') && (
                        <span className="text-gray-500 text-xs ml-2">- Fixed by zone</span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.pricePerLiter}
                      onChange={(e) => {
                        const newPrice = e.target.value;
                        setFormData(prev => {
                          const fuelTotal = parseFloat(prev.liters || '0') * parseFloat(newPrice || '0');
                          const oilTotal = parseFloat(prev.oilTotalAmount || '0');
                          const grandTotal = fuelTotal + oilTotal;

                          return {
                            ...prev,
                            pricePerLiter: newPrice,
                            totalAmount: !isNaN(grandTotal) ? grandTotal.toFixed(2) : ''
                          };
                        });
                      }}
                      readOnly={drawnVehicle?.fuel_type?.startsWith('ULP')}
                      className={`w-full border rounded-lg px-4 py-3 ${
                        drawnVehicle?.fuel_type?.startsWith('ULP')
                          ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                          : formData.pricePerLiter ? 'border-gray-300 bg-white' : 'border-blue-400 bg-blue-50'
                      }`}
                      placeholder={selectedGarageId ? (drawnVehicle?.fuel_type?.startsWith('Diesel') ? "Enter diesel price" : "Price set by system") : "Select garage first"}
                      required
                    />
                    {drawnVehicle?.fuel_type && (
                      <p className="text-xs text-gray-500 mt-1">
                        Fuel Type: {drawnVehicle.fuel_type}
                      </p>
                    )}
                    {drawnVehicle?.fuel_type?.startsWith('ULP') && (
                      <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded border border-gray-200">
                        ℹ️ ULP prices are regulated and fixed per zone. Prices are updated automatically on the first Wednesday of each month by the system.
                      </p>
                    )}
                    {selectedGarageId && !formData.pricePerLiter && drawnVehicle?.fuel_type?.startsWith('Diesel') && (
                      <p className="text-xs text-blue-600 mt-1">
                        This garage hasn't set a price for {drawnVehicle?.fuel_type}. Please enter the current price per liter.
                      </p>
                    )}
                    {formData.pricePerLiter && parseFloat(formData.pricePerLiter) > 30 && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Price seems high. Please verify: R{formData.pricePerLiter}/L
                      </p>
                    )}
                    {formData.pricePerLiter && parseFloat(formData.pricePerLiter) < 15 && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Price seems low. Please verify: R{formData.pricePerLiter}/L
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (R)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.totalAmount}
                      readOnly
                      className={`w-full border rounded-lg px-4 py-3 bg-gray-50 ${
                        spendingLimitInfo && !spendingLimitInfo.isBlocked && parseFloat(formData.totalAmount || '0') > spendingLimitInfo.availableAmount
                          ? 'border-red-400 text-red-700 font-bold'
                          : 'border-gray-300'
                      }`}
                    />
                    {purchasingOil && formData.oilTotalAmount && (
                      <p className="text-xs text-gray-500 mt-1">
                        Includes R{formData.oilTotalAmount} for oil
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Odometer Reading (km)</label>
                    <input
                      type="number"
                      value={formData.odometerReading}
                      onChange={(e) => setFormData({ ...formData, odometerReading: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3"
                      placeholder="125000"
                      required
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">Purchasing Oil?</label>
                      <button
                        type="button"
                        onClick={() => {
                          setPurchasingOil(!purchasingOil);
                          if (purchasingOil) {
                            setFormData({
                              ...formData,
                              oilQuantity: '',
                              oilUnitPrice: '',
                              oilTotalAmount: '',
                              oilType: '',
                              oilBrand: '',
                            });
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          purchasingOil ? 'bg-green-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            purchasingOil ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {purchasingOil && (
                      <div className="space-y-3 mt-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Oil Type</label>
                          <select
                            value={formData.oilType}
                            onChange={(e) => setFormData({ ...formData, oilType: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3"
                            required={purchasingOil}
                          >
                            <option value="">Select oil type</option>
                            <option value="Engine oil">Engine oil</option>
                            <option value="Brake fluid">Brake fluid</option>
                            <option value="Transmission oil">Transmission oil</option>
                            <option value="Coolant">Coolant</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                          <input
                            type="text"
                            value={formData.oilBrand}
                            onChange={(e) => setFormData({ ...formData, oilBrand: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3"
                            placeholder="e.g., Castrol, Mobil, Shell"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Number of Units</label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={formData.oilQuantity}
                            onChange={(e) => {
                              const quantity = e.target.value;
                              setFormData(prev => {
                                const unitPrice = parseFloat(prev.oilUnitPrice || '0');
                                const qty = parseFloat(quantity || '0');
                                const oilTotal = Math.round(qty * unitPrice * 100) / 100;

                                // Update grand total with fuel + oil
                                const fuelTotal = Math.round(parseFloat(prev.liters || '0') * parseFloat(prev.pricePerLiter || '0') * 100) / 100;
                                const grandTotal = Math.round((fuelTotal + oilTotal) * 100) / 100;

                                return {
                                  ...prev,
                                  oilQuantity: quantity,
                                  oilTotalAmount: oilTotal > 0 ? oilTotal.toFixed(2) : '',
                                  totalAmount: !isNaN(grandTotal) ? grandTotal.toFixed(2) : prev.totalAmount
                                };
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3"
                            placeholder="4"
                            required={purchasingOil}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Number of bottles/units purchased (e.g., 4 bottles)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit (R) <span className="text-xs text-gray-500">incl. VAT</span></label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.oilUnitPrice}
                            onChange={(e) => {
                              const unitPrice = e.target.value;
                              setFormData(prev => {
                                const qty = parseFloat(prev.oilQuantity || '0');
                                const price = parseFloat(unitPrice || '0');
                                const oilTotal = Math.round(qty * price * 100) / 100;

                                // Update grand total with fuel + oil
                                const fuelTotal = Math.round(parseFloat(prev.liters || '0') * parseFloat(prev.pricePerLiter || '0') * 100) / 100;
                                const grandTotal = Math.round((fuelTotal + oilTotal) * 100) / 100;

                                return {
                                  ...prev,
                                  oilUnitPrice: unitPrice,
                                  oilTotalAmount: oilTotal > 0 ? oilTotal.toFixed(2) : '',
                                  totalAmount: !isNaN(grandTotal) ? grandTotal.toFixed(2) : prev.totalAmount
                                };
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3"
                            placeholder="65.00"
                            required={purchasingOil}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Price per bottle/unit (e.g., R65 per 0.5L bottle). Oil is subject to 15% VAT.
                          </p>
                        </div>

                        {formData.oilQuantity && formData.oilUnitPrice && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-blue-900">Oil Total:</span>
                              <span className="text-lg font-bold text-blue-900">
                                R {formData.oilTotalAmount || '0.00'}
                              </span>
                            </div>
                            <p className="text-xs text-blue-700 mt-1">
                              {formData.oilQuantity} units × R{formData.oilUnitPrice} = R{formData.oilTotalAmount}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-800">
                    You are authorized to refuel. Enter the fuel details from your transaction.
                  </p>
                </div>

                {purchasingOil && (!formData.oilType || !formData.oilQuantity || !formData.oilUnitPrice) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-amber-900 mb-2">Complete oil purchase details:</p>
                    <ul className="text-xs text-amber-700 space-y-1">
                      {!formData.oilType && <li>• Select oil type</li>}
                      {!formData.oilQuantity && <li>• Enter number of units</li>}
                      {!formData.oilUnitPrice && <li>• Enter price per unit</li>}
                    </ul>
                  </div>
                )}

                {/* Debug: Show what's missing */}
                {(!formData.liters || !formData.pricePerLiter || !formData.odometerReading) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-red-900 mb-2">Required fields missing:</p>
                    <ul className="text-xs text-red-700 space-y-1">
                      {!formData.liters && <li>• Enter liters</li>}
                      {!formData.pricePerLiter && <li>• Price per liter not set (check garage fuel prices)</li>}
                      {!formData.odometerReading && <li>• Enter odometer reading</li>}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => {
                    console.log('[FuelPurchase] Complete button clicked');
                    console.log('[FuelPurchase] Form data:', formData);
                    console.log('[FuelPurchase] Button disabled?',
                      loading ||
                      !formData.liters ||
                      !formData.pricePerLiter ||
                      !formData.odometerReading ||
                      (purchasingOil && (!formData.oilQuantity || !formData.oilUnitPrice || !formData.oilType)) ||
                      (spendingLimitInfo && !spendingLimitInfo.isBlocked && parseFloat(formData.totalAmount || '0') > spendingLimitInfo.availableAmount)
                    );
                    handleFuelDetailsSubmit();
                  }}
                  disabled={
                    loading ||
                    !formData.liters ||
                    !formData.pricePerLiter ||
                    !formData.odometerReading ||
                    (purchasingOil && (!formData.oilQuantity || !formData.oilUnitPrice || !formData.oilType)) ||
                    (spendingLimitInfo && !spendingLimitInfo.isBlocked && parseFloat(formData.totalAmount || '0') > spendingLimitInfo.availableAmount) ||
                    (drawnVehicle?.tank_capacity && parseFloat(formData.liters || '0') > (drawnVehicle.tank_capacity + 2))
                  }
                  className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Processing...'
                  ) : (
                    <>
                      <Fuel className="w-5 h-5" />
                      Complete Fuel Purchase
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
