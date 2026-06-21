import { useState, useEffect } from 'react';
import { Fuel, Car, LogOut, MapPin, ArrowLeft, Lock, AlertCircle } from 'lucide-react';
import { DriverData } from './DriverAuth';
import DriverMobileFuelPurchase from './DriverMobileFuelPurchase';
import DrawVehicle from './DrawVehicle';
import ReturnVehicle from './ReturnVehicle';
import MobileGarageDirectory from './MobileGarageDirectory';
import { DriverPINSetup } from './DriverPINSetup';
import { supabase } from '../lib/supabase';

interface DriverMobileAppProps {
  driver: DriverData;
  onLogout: () => void | Promise<void>;
  onDriverUpdate?: (updatedDriver: DriverData) => void;
}

type MenuOption = 'menu' | 'draw' | 'return' | 'refuel' | 'directory' | 'pin_setup';

interface DrawnVehicle {
  id: string;
  vehicleId: string;
  vehicleRegistration: string;
  odometerReading: number;
  drawnAt: string;
}

export default function DriverMobileApp({ driver, onLogout, onDriverUpdate }: DriverMobileAppProps) {
  const [localDriver, setLocalDriver] = useState(driver);
  const [needsPINSetup, setNeedsPINSetup] = useState(!localDriver.hasPIN);
  const [currentView, setCurrentView] = useState<MenuOption>(localDriver.hasPIN ? 'menu' : 'pin_setup');
  const [drawnVehicles, setDrawnVehicles] = useState<DrawnVehicle[]>([]);
  const [showDrawnReminder, setShowDrawnReminder] = useState(false);

  console.log('[DriverMobileApp] Rendering. currentView:', currentView, 'needsPINSetup:', needsPINSetup, 'localDriver.hasPIN:', localDriver.hasPIN);

  // Update local driver when prop changes
  useEffect(() => {
    console.log('[DriverMobileApp] Driver prop updated, syncing localDriver');
    setLocalDriver(driver);
    setNeedsPINSetup(!driver.hasPIN);
  }, [driver]);

  // Prevent going back to PIN setup if driver already has a PIN
  useEffect(() => {
    if (currentView === 'pin_setup' && !needsPINSetup && localDriver.hasPIN) {
      console.log('[DriverMobileApp] Preventing return to PIN setup - driver already has PIN');
      setCurrentView('menu');
    }
  }, [currentView, needsPINSetup, localDriver.hasPIN]);

  // Fetch drawn vehicles that haven't been returned
  useEffect(() => {
    async function fetchDrawnVehicles() {
      try {
        const { data: draws, error } = await supabase
          .from('vehicle_transactions')
          .select(`
            id,
            vehicle_id,
            odometer_reading,
            created_at,
            vehicles!inner(registration_number)
          `)
          .eq('driver_id', driver.id)
          .eq('transaction_type', 'draw')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (draws) {
          const unreturned: DrawnVehicle[] = [];

          for (const draw of draws) {
            const { data: returnData } = await supabase
              .from('vehicle_transactions')
              .select('id')
              .eq('related_transaction_id', draw.id)
              .eq('transaction_type', 'return')
              .limit(1)
              .maybeSingle();

            if (!returnData) {
              unreturned.push({
                id: draw.id,
                vehicleId: draw.vehicle_id,
                vehicleRegistration: draw.vehicles.registration_number,
                odometerReading: draw.odometer_reading,
                drawnAt: draw.created_at
              });
            }
          }

          setDrawnVehicles(unreturned);
        }
      } catch (error) {
        console.error('Error fetching drawn vehicles:', error);
      }
    }

    if (currentView === 'menu') {
      fetchDrawnVehicles();
    }
  }, [currentView, driver.id]);

  if (currentView === 'pin_setup') {
    console.log('[DriverMobileApp] Rendering PIN setup screen');
    return (
      <DriverPINSetup
        driverId={driver.id}
        onComplete={() => {
          console.log('[DriverMobileApp] PIN setup onComplete called, updating state...');
          setNeedsPINSetup(false);

          // Update driver data to reflect PIN is now set
          const updatedDriver = { ...localDriver, hasPIN: true };
          setLocalDriver(updatedDriver);

          // Update localStorage
          const storedDriverData = localStorage.getItem('driverData');
          if (storedDriverData) {
            const driverDataObj = JSON.parse(storedDriverData);
            driverDataObj.hasPIN = true;
            localStorage.setItem('driverData', JSON.stringify(driverDataObj));
          }

          // Notify parent component if callback provided
          if (onDriverUpdate) {
            onDriverUpdate(updatedDriver);
          }

          setCurrentView('menu');
          console.log('[DriverMobileApp] State updated: needsPINSetup=false, currentView=menu, hasPIN=true');
        }}
        onCancel={needsPINSetup ? undefined : () => setCurrentView('menu')}
      />
    );
  }

  if (currentView === 'draw') {
    if (showDrawnReminder && drawnVehicles.length > 0) {
      return (
        <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-7 h-7 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold text-amber-900">Vehicle Already Drawn</h2>
                <p className="text-sm text-amber-700 mt-1">
                  You have {drawnVehicles.length} vehicle{drawnVehicles.length > 1 ? 's' : ''} currently drawn under your name:
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              {drawnVehicles.map((vehicle) => (
                <div key={vehicle.id} className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{vehicle.vehicleRegistration}</p>
                      <p className="text-xs text-gray-600">Drawn at {vehicle.odometerReading.toLocaleString()} km</p>
                      <p className="text-xs text-gray-500">{new Date(vehicle.drawnAt).toLocaleString()}</p>
                    </div>
                    <Car className="w-6 h-6 text-amber-500" />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-600 mb-5">
              Please return {drawnVehicles.length > 1 ? 'these vehicles' : 'this vehicle'} before drawing a new one. Do you still want to proceed?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => { setShowDrawnReminder(false); }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Proceed Anyway
              </button>
              <button
                onClick={() => { setShowDrawnReminder(false); setCurrentView('menu'); }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <DrawVehicle
        organizationId={driver.organizationId}
        driverId={driver.id}
        onBack={() => setCurrentView('menu')}
      />
    );
  }

  if (currentView === 'return') {
    return (
      <ReturnVehicle
        organizationId={driver.organizationId}
        driverId={driver.id}
        onBack={() => setCurrentView('menu')}
        drawnVehicleId={drawnVehicles.length > 0 ? drawnVehicles[0].vehicleId : undefined}
      />
    );
  }

  if (currentView === 'refuel') {
    return (
      <div>
        <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('menu')}
              className="hover:bg-blue-700 p-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Refueling</h1>
              <p className="text-sm text-blue-100">Driver: {driver.firstName} {driver.lastName}</p>
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
        <div className="pt-16">
          <DriverMobileFuelPurchase
            driver={driver}
            onLogout={onLogout}
            onComplete={() => setCurrentView('menu')}
          />
        </div>
      </div>
    );
  }

  if (currentView === 'directory') {
    return (
      <MobileGarageDirectory
        onBack={() => setCurrentView('menu')}
        organizationId={driver.organizationId}
      />
    );
  }

  console.log('[DriverMobileApp] Rendering main menu');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fuel className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">Driver Portal</h1>
              <p className="text-sm text-blue-100">{driver.firstName} {driver.lastName}</p>
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

      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h2>
          <p className="text-gray-600">Select an option to get started</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => {
              if (drawnVehicles.length > 0) {
                setShowDrawnReminder(true);
              }
              setCurrentView('draw');
            }}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition-colors">
                <Car className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Draw Vehicle</h3>
                <p className="text-sm text-gray-600">Check out a vehicle and record the starting odometer reading</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setCurrentView('return')}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Car className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Return Vehicle</h3>
                <p className="text-sm text-gray-600">Check in a vehicle and record the closing odometer reading</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setCurrentView('refuel')}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="bg-orange-100 p-3 rounded-lg group-hover:bg-orange-200 transition-colors">
                <Fuel className="w-8 h-8 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Refueling</h3>
                <p className="text-sm text-gray-600">Record a fuel purchase transaction</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setCurrentView('directory')}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                <MapPin className="w-8 h-8 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Garage Directory</h3>
                <p className="text-sm text-gray-600">Find participating garages near you</p>
              </div>
            </div>
          </button>

          {!needsPINSetup && (
            <button
              onClick={() => setCurrentView('pin_setup')}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1 text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="bg-amber-100 p-3 rounded-lg group-hover:bg-amber-200 transition-colors">
                  <Lock className="w-8 h-8 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Change PIN</h3>
                  <p className="text-sm text-gray-600">Update your payment PIN</p>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
