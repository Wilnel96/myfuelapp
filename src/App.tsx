import { useEffect, useState, useRef } from 'react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import DriverAuth from './components/DriverAuth';
import GarageAuth from './components/GarageAuth';
import GaragePortal from './components/GaragePortal';
import DriverMobileApp from './components/DriverMobileApp';
import MobileFuelPurchase from './components/MobileFuelPurchase';
import VehicleManagement from './components/VehicleManagement';
import GarageManagement from './components/GarageManagement';
import EFTBatchProcessing from './components/EFTBatchProcessing';
import DriverManagement from './components/DriverManagement';
import OrganizationManagement from './components/OrganizationManagement';
import ClientOrganizations from './components/ClientOrganizations';
import ClientOrganizationsMenu from './components/ClientOrganizationsMenu';
import ClientOrgInfo from './components/ClientOrgInfo';
import UserManagement from './components/UserManagement';
import ClientFinancialInfo from './components/ClientFinancialInfo';
import CreateClientOrganization from './components/CreateClientOrganization';
import ConsolidatedReports from './components/ConsolidatedReports';
import ReportsDashboard from './components/ReportsDashboard';
import ClientDashboard from './components/ClientDashboard';
import ClientCardDashboard from './components/ClientCardDashboard';
import ClientAccountDashboard from './components/ClientAccountDashboard';
import ClientPortalSelection from './components/ClientPortalSelection';
import ClientSignup from './components/ClientSignup';
import GarageSignup from './components/GarageSignup';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import GaragesDirectory from './components/GaragesDirectory';
import ClientGaragesView from './components/ClientGaragesView';
import ClientGarageAccounts from './components/ClientGarageAccounts';
import BackOffice from './components/BackOffice';
import CustomReportBuilder from './components/CustomReportBuilder';
import BackupManagement from './components/BackupManagement';
import ClientInvoices from './components/ClientInvoices';
import InvoiceManagement from './components/InvoiceManagement';
import ClientFuelInvoices from './components/ClientFuelInvoices';
import AdminPasswordReset from './components/AdminPasswordReset';
import { Truck, Store, DollarSign, Fuel, LogOut, X, Users, Building2, BarChart3, FileText, Settings, CreditCard as Edit3, ArrowLeft, UserPlus } from 'lucide-react';
import { DriverData } from './components/DriverAuth';

type UserMode = 'admin' | 'driver' | 'garage' | null;
type ClientPortalType = 'card' | 'account' | null;

function App() {
  const [session, setSession] = useState<any>(null);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [garageId, setGarageId] = useState<string | null>(null);
  const [garageName, setGarageName] = useState<string | null>(null);
  const [garageEmail, setGarageEmail] = useState<string | null>(null);
  const [garagePassword, setGaragePassword] = useState<string | null>(null);
  const [userMode, setUserMode] = useState<UserMode>(null);
  const [clientPortalType, setClientPortalType] = useState<ClientPortalType>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentViewState] = useState<'dashboard' | 'clients' | 'client-organizations-menu' | 'create-client-org' | 'client-org-info' | 'client-user-info' | 'client-financial-info' | 'vehicles' | 'garages' | 'drivers' | 'invoices' | 'reports' | 'reports-menu' | 'backoffice' | 'organization' | 'custom-reports' | 'backup' | null>(() => {
    const saved = sessionStorage.getItem('appCurrentView');
    return saved ? saved as any : null;
  });

  const setCurrentView = (view: typeof currentView) => {
    setCurrentViewState(view);
    if (view === null) {
      sessionStorage.removeItem('appCurrentView');
    } else {
      sessionStorage.setItem('appCurrentView', view);
    }
  };
  const [showModeSelection, setShowModeSelection] = useState(true);
  const [showPortalSelection, setShowPortalSelection] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showGarageSignup, setShowGarageSignup] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [userRole, setUserRole] = useState<string>('admin');
  // 'client' = Client Portal login, 'system_admin' = System Admin login
  const [loginPortal, setLoginPortal] = useState<'client' | 'system_admin' | null>(null);
  const [portalError, setPortalError] = useState<string>('');
  const [paymentOption, setPaymentOption] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      console.warn('Emergency timeout: Showing UI after 10 seconds');
      setLoading(false);
    }, 10000);

    return () => clearTimeout(emergencyTimeout);
  }, []);

  useEffect(() => {
    let mounted = true;

    const storedDriverToken = localStorage.getItem('driverToken');
    const storedDriverData = localStorage.getItem('driverData');
    const storedGarageData = localStorage.getItem('garageData');

    if (storedDriverToken && storedDriverData) {
      try {
        const driver = JSON.parse(storedDriverData);
        setDriverData({ ...driver, token: storedDriverToken });
        setUserMode('driver');
        setShowModeSelection(false);
        setLoading(false);
        console.log('Driver session restored from localStorage');
        return;
      } catch (e) {
        console.error('Failed to restore driver session:', e);
        localStorage.removeItem('driverToken');
        localStorage.removeItem('driverData');
      }
    }

    if (storedGarageData) {
      try {
        const garage = JSON.parse(storedGarageData);
        setGarageId(garage.id);
        setGarageName(garage.name);
        setGarageEmail(garage.email);
        setGaragePassword(garage.password);
        setUserMode('garage');
        setShowModeSelection(false);
        setLoading(false);
        console.log('Garage session restored from localStorage');
        return;
      } catch (e) {
        console.error('Failed to restore garage session:', e);
        localStorage.removeItem('garageData');
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event, 'Session:', !!session, 'Mounted:', mounted);

      if (!mounted) {
        console.log('Component unmounted, ignoring auth state change');
        return;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // For token refresh, just update session silently without changing UI
      if (session && _event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed, updating session silently');
        setSession(session);
        return;
      }

      if (session && (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION')) {
        console.log('Auth state - Session detected, loading profile...');
        setSession(session);
        setLoading(true);

        const profileTimeout = setTimeout(() => {
          console.warn('Profile load timeout, using defaults');
          if (!mounted) return;
          setUserRole('admin');
          setUserMode('admin');
          setShowModeSelection(false);
          setLoading(false);
        }, 3000);

        Promise.all([
          supabase
            .from('profiles')
            .select('role, organization_id, organizations(name, payment_option, is_management_org, organization_type)')
            .eq('id', session.user.id)
            .maybeSingle(),
          supabase
            .from('organization_users')
            .select('role, organization_id')
            .eq('user_id', session.user.id)
            .maybeSingle()
        ]).then(([{ data: profile, error: profileError }, { data: orgUser }]) => {
            clearTimeout(profileTimeout);

            if (!mounted) return;

            if (profileError) {
              console.error('Auth state - Profile error:', profileError);
              setUserRole('admin');
              setUserMode('admin');
              setShowModeSelection(false);
              setLoading(false);
              return;
            }

            console.log('Auth state - Profile loaded:', profile);
            console.log('Auth state - Organization user loaded:', orgUser);

            if (!profile) {
              console.warn('Auth state - No profile found, using defaults');
              setUserRole('admin');
              setUserMode('admin');
              setShowModeSelection(false);
              setLoading(false);
              return;
            }

            // Check if this is a garage user (check both profile and organization_users)
            const isGarageUser = profile.role === 'garage_user' || orgUser?.role === 'garage_user';

            if (isGarageUser) {
              console.log('Auth state - Garage user detected, loading garage details');

              const garageOrgId = orgUser?.organization_id || profile.organization_id;

              // Fetch garage details from organization
              supabase
                .from('garages')
                .select('id, name, email_address')
                .eq('organization_id', garageOrgId)
                .maybeSingle()
                .then(({ data: garage, error: garageError }) => {
                  if (!mounted) return;

                  if (garageError || !garage) {
                    console.error('Auth state - Failed to load garage:', garageError);
                    setLoading(false);
                    return;
                  }

                  console.log('Auth state - Garage loaded:', garage);

                  // Set garage mode
                  const garageData = {
                    id: garage.id,
                    name: garage.name,
                    email: garage.email_address || session.user.email || '',
                    password: ''
                  };

                  localStorage.setItem('garageData', JSON.stringify(garageData));
                  setGarageId(garage.id);
                  setGarageName(garage.name);
                  setGarageEmail(garage.email_address || session.user.email || '');
                  setGaragePassword('');
                  setUserMode('garage');
                  setShowModeSelection(false);
                  setLoading(false);
                });

              return;
            }

            // Regular client/admin user
            const isManagementUser = profile.organizations &&
              typeof profile.organizations === 'object' &&
              'is_management_org' in profile.organizations &&
              (profile.organizations as any).is_management_org === true;

            const effectiveRole = isManagementUser ? 'super_admin' : profile.role;

            console.log('Auth state - Effective role:', effectiveRole, 'Is management org:', isManagementUser);

            // Portal access validation — only enforce during an active sign-in (not token refresh or page reload)
            if (_event === 'SIGNED_IN' && loginPortal) {
              const isClientRole = !isManagementUser && effectiveRole !== 'garage_user' && effectiveRole !== 'super_admin';
              const isAdminRole = isManagementUser || effectiveRole === 'super_admin';

              if (loginPortal === 'client' && !isClientRole) {
                // Wrong portal — sign out and show error
                const msg = effectiveRole === 'garage_user'
                  ? 'Garage accounts must sign in via the Garage Portal.'
                  : 'System administrators must sign in via the System Admin portal.';
                supabase.auth.signOut();
                setPortalError(msg);
                setSession(null);
                setUserMode('admin');
                setShowModeSelection(false);
                setLoading(false);
                return;
              }

              if (loginPortal === 'system_admin' && !isAdminRole) {
                supabase.auth.signOut();
                setPortalError('This account does not have System Admin access. Please use the Client Portal.');
                setSession(null);
                setUserMode('admin');
                setShowModeSelection(false);
                setLoading(false);
                return;
              }
            }

            setUserRole(effectiveRole);
            setUserMode('admin');
            setShowModeSelection(false);

            // Only reset currentView on initial sign-in, not on token refresh
            if (_event === 'SIGNED_IN') {
              setCurrentView(null);
            }

            // Set payment option and derive portal type if organization data is available
            if (profile.organizations && typeof profile.organizations === 'object' && 'payment_option' in profile.organizations) {
              const po = (profile.organizations as any).payment_option;
              setPaymentOption(po);
              if (!isManagementUser) {
                if (po === 'Card Payment') setClientPortalType('card');
                else if (po === 'Local Account') setClientPortalType('account');
              }
            }

            // Set organization ID and name
            if (profile.organization_id) {
              setOrganizationId(profile.organization_id);
            }
            if (profile.organizations && typeof profile.organizations === 'object' && 'name' in profile.organizations) {
              setOrganizationName((profile.organizations as any).name);
            }

            setLoading(false);
          })
          .catch((err) => {
            clearTimeout(profileTimeout);
            console.error('Auth state - Exception loading profile:', err);
            if (!mounted) return;
            setUserRole('admin');
            setUserMode('admin');
            setShowModeSelection(false);
            setLoading(false);
          });
      } else if (_event === 'SIGNED_OUT') {
        console.log('User signed out event');
        setSession(null);
        setDriverData(null);
        setGarageId(null);
        setGarageName(null);
        setCurrentView(null);
        setUserRole('admin');
        setUserMode(null);
        setShowModeSelection(true);
        setLoading(false);
      } else if (_event === 'INITIAL_SESSION' && !session) {
        console.log('Initial session check - no session found');
        if (!mounted) return;
        setLoading(false);
      }
    });

    console.log('Checking session... Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      console.log('Initial getSession call:', { hasSession: !!currentSession, error, mounted });
      if (!mounted) return;

      if (error) {
        console.error('Error getting session:', error);
        setLoading(false);
        return;
      }

      if (currentSession) {
        console.log('Existing session found on mount');
        setSession(currentSession);
        setLoading(true);

        // Load profile AND check organization_users to determine user type
        Promise.all([
          supabase
            .from('profiles')
            .select('role, organization_id, organizations(name, payment_option, is_management_org, organization_type)')
            .eq('id', currentSession.user.id)
            .maybeSingle(),
          supabase
            .from('organization_users')
            .select('role, organization_id')
            .eq('user_id', currentSession.user.id)
            .maybeSingle()
        ]).then(([{ data: profile }, { data: orgUser }]) => {
            if (!mounted) return;

            if (!profile) {
              console.log('No profile found on mount');
              setUserMode('admin');
              setShowModeSelection(false);
              setLoading(false);
              return;
            }

            console.log('Profile loaded on mount:', profile);
            console.log('Organization user loaded on mount:', orgUser);

            // Check if this is a garage user (check both profile and organization_users)
            const isGarageUser = profile.role === 'garage_user' || orgUser?.role === 'garage_user';

            if (isGarageUser) {
              console.log('Garage user detected on mount, loading garage details');

              const garageOrgId = orgUser?.organization_id || profile.organization_id;

              // Fetch garage details
              supabase
                .from('garages')
                .select('id, name, email_address')
                .eq('organization_id', garageOrgId)
                .maybeSingle()
                .then(({ data: garage }) => {
                  if (!mounted) return;

                  if (!garage) {
                    console.error('No garage found for garage user on mount');
                    setLoading(false);
                    return;
                  }

                  console.log('Garage loaded on mount:', garage);

                  // Set garage mode
                  const garageData = {
                    id: garage.id,
                    name: garage.name,
                    email: garage.email_address || currentSession.user.email || '',
                    password: ''
                  };

                  localStorage.setItem('garageData', JSON.stringify(garageData));
                  setGarageId(garage.id);
                  setGarageName(garage.name);
                  setGarageEmail(garage.email_address || currentSession.user.email || '');
                  setGaragePassword('');
                  setUserMode('garage');
                  setShowModeSelection(false);
                  setLoading(false);
                });

              return;
            }

            // Regular client/admin user
            const isManagementUser = profile.organizations &&
              typeof profile.organizations === 'object' &&
              'is_management_org' in profile.organizations &&
              (profile.organizations as any).is_management_org === true;

            const effectiveRole = isManagementUser ? 'super_admin' : profile.role;

            setUserRole(effectiveRole);
            setUserMode('admin');
            setShowModeSelection(false);

            // Set payment option and derive portal type if organization data is available
            if (profile.organizations && typeof profile.organizations === 'object' && 'payment_option' in profile.organizations) {
              const po = (profile.organizations as any).payment_option;
              setPaymentOption(po);
              if (!isManagementUser) {
                if (po === 'Card Payment') setClientPortalType('card');
                else if (po === 'Local Account') setClientPortalType('account');
              }
            }

            // Set organization ID and name
            if (profile.organization_id) {
              setOrganizationId(profile.organization_id);
            }
            if (profile.organizations && typeof profile.organizations === 'object' && 'name' in profile.organizations) {
              setOrganizationName((profile.organizations as any).name);
            }

            setLoading(false);
          })
          .catch((err) => {
            console.error('Error loading profile on mount:', err);
            if (!mounted) return;
            setUserRole('admin');
            setUserMode('admin');
            setShowModeSelection(false);
            setLoading(false);
          });
      } else {
        console.log('No existing session on mount');
        setLoading(false);
      }
    });

    timeoutRef.current = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Initial load timeout after 2 seconds, showing UI');
        setLoading(false);
      }
    }, 2000);

    return () => {
      mounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, []);

  const handleAdminSignOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('garageData');
      setSession(null);
      setDriverData(null);
      setGarageId(null);
      setGarageName(null);
      setGarageEmail(null);
      setGaragePassword(null);
      setUserMode(null);
      setClientPortalType(null);
      setLoginPortal(null);
      setPortalError('');
      setUserRole('admin');
      setCurrentView(null);
      setShowModeSelection(true);
      setShowPortalSelection(false);
      setShowSignup(false);
    } catch (error) {
      console.error('Error signing out:', error);
      localStorage.removeItem('garageData');
      setSession(null);
      setDriverData(null);
      setGarageId(null);
      setGarageName(null);
      setGarageEmail(null);
      setGaragePassword(null);
      setUserMode(null);
      setClientPortalType(null);
      setLoginPortal(null);
      setPortalError('');
      setUserRole('admin');
      setCurrentView(null);
      setShowModeSelection(true);
      setShowPortalSelection(false);
      setShowSignup(false);
    }
  };

  const handleDriverLogin = (driver: DriverData) => {
    setDriverData(driver);
    setUserMode('driver');
    setShowModeSelection(false);
  };

  const handleDriverUpdate = (updatedDriver: DriverData) => {
    console.log('[App] Updating driver data:', updatedDriver);
    setDriverData(updatedDriver);
    // Update localStorage as well
    const storedDriverData = localStorage.getItem('driverData');
    if (storedDriverData) {
      localStorage.setItem('driverData', JSON.stringify(updatedDriver));
    }
  };

  const handleDriverLogout = async () => {
    console.log('Driver logout initiated');
    localStorage.removeItem('driverToken');
    localStorage.removeItem('driverData');

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error clearing Supabase session:', error);
    }

    setDriverData(null);
    setSession(null);
    setGarageId(null);
    setGarageName(null);
    setUserMode(null);
    setShowModeSelection(true);
    console.log('Driver logout complete, state reset');
  };

  const handleGarageLogin = (id: string, name: string, email: string, password: string) => {
    console.log('handleGarageLogin called with:', { id, name, email });
    const garageData = { id, name, email, password };
    localStorage.setItem('garageData', JSON.stringify(garageData));
    setGarageId(id);
    setGarageName(name);
    setGarageEmail(email);
    setGaragePassword(password);
    setUserMode('garage');
    setShowModeSelection(false);
    setLoading(false);
    console.log('Garage login complete - state updated:', { garageId: id, userMode: 'garage' });
  };

  const handleGarageLogout = async () => {
    console.log('Garage logout initiated');
    localStorage.removeItem('garageData');

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error clearing Supabase session:', error);
    }

    setGarageId(null);
    setGarageName(null);
    setGarageEmail(null);
    setGaragePassword(null);
    setSession(null);
    setDriverData(null);
    setUserMode(null);
    setShowModeSelection(true);
    console.log('Garage logout complete, state reset');
  };

  if (!loading && userMode && showModeSelection) {
    setShowModeSelection(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (showModeSelection && !session && !driverData && !garageId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh]">
          <div className="p-6 space-y-3 overflow-y-auto max-h-[90vh]">
            <div className="text-center mb-3">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Fuel className="w-7 h-7 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">FleetFuel</h1>
              </div>
              <p className="text-blue-600 text-xs">Mobile Fuel Management</p>
            </div>

            <h2 className="text-base font-semibold text-gray-900 text-center mb-3">
              Select Login Type
            </h2>

            <button
              onClick={() => {
                setUserMode('driver');
                setShowModeSelection(false);
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                <div className="text-left flex-1">
                  <div className="font-bold">Driver Login</div>
                  <div className="text-xs text-blue-100">For drivers using mobile app</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setUserMode('admin');
                setLoginPortal('client');
                setPortalError('');
                setShowModeSelection(false);
              }}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6" />
                <div className="text-left flex-1">
                  <div className="font-bold">Client Portal</div>
                  <div className="text-xs text-green-100">For clients to review and manage their account</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setUserMode('garage');
                setShowModeSelection(false);
              }}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <Store className="w-6 h-6" />
                <div className="text-left flex-1">
                  <div className="font-bold">Garage Portal</div>
                  <div className="text-xs text-orange-100">For garage managers</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setUserMode('admin');
                setLoginPortal('system_admin');
                setPortalError('');
                setShowModeSelection(false);
              }}
              className="w-full bg-gradient-to-r from-gray-700 to-gray-800 text-white py-3 px-4 rounded-lg font-semibold hover:from-gray-800 hover:to-gray-900 transition-all shadow-md hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6" />
                <div className="text-left flex-1">
                  <div className="font-bold">System Admin</div>
                  <div className="text-xs text-gray-300">For management company</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setUserMode('admin');
                setShowModeSelection(false);
                setShowPortalSelection(true);
              }}
              className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-teal-700 hover:to-teal-800 transition-all shadow-md hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <UserPlus className="w-6 h-6" />
                <div className="text-left flex-1">
                  <div className="font-bold">New Client Signup</div>
                  <div className="text-xs text-teal-100">Create a new organization account</div>
                </div>
              </div>
            </button>

            <div className="pt-3 border-t border-gray-200 mt-4">
              <p className="text-xs text-gray-600 text-center leading-relaxed">
                <strong>Drivers:</strong> First name and date of birth
                <br />
                <strong>Garages:</strong> Contact email and password
                <br />
                <strong>Admins:</strong> Email and password
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (userMode === 'driver' && !driverData) {
    return <DriverAuth onLogin={handleDriverLogin} onBack={() => {
      setUserMode(null);
      setShowModeSelection(true);
    }} />;
  }

  if (userMode === 'driver' && driverData) {
    return <DriverMobileApp driver={driverData} onLogout={handleDriverLogout} onDriverUpdate={handleDriverUpdate} />;
  }

  if (userMode === 'garage' && showGarageSignup) {
    return (
      <GarageSignup
        onBack={() => {
          setShowGarageSignup(false);
        }}
        onSuccess={() => {
          setShowGarageSignup(false);
        }}
      />
    );
  }

  if (userMode === 'garage' && !garageId) {
    return <GarageAuth
      onLogin={handleGarageLogin}
      onBack={() => {
        setUserMode(null);
        setShowModeSelection(true);
      }}
      onSignup={() => {
        setShowGarageSignup(true);
      }}
    />;
  }

  if (userMode === 'garage' && garageId && garageName) {
    return <GaragePortal garageId={garageId} garageName={garageName} garageEmail={garageEmail || ''} garagePassword={garagePassword || ''} onLogout={handleGarageLogout} />;
  }

  if (userMode === 'admin' && showSignup && clientPortalType) {
    return (
      <ClientSignup
        portalType={clientPortalType}
        onBack={() => {
          setShowSignup(false);
          setShowPortalSelection(true);
        }}
        onSignupSuccess={() => {
          setShowSignup(false);
          window.location.reload();
        }}
      />
    );
  }

  if (userMode === 'admin' && showPortalSelection && !session) {
    return (
      <ClientPortalSelection
        onSelectPortal={(portalType) => {
          setClientPortalType(portalType);
          setShowPortalSelection(false);
          setShowSignup(true);
        }}
        onBack={() => {
          setUserMode(null);
          setShowModeSelection(true);
          setShowPortalSelection(false);
        }}
      />
    );
  }

  if (showPasswordReset) {
    return <AdminPasswordReset />;
  }

  if (userMode === 'admin' && !session && !showPortalSelection && !showSignup) {
    return <Auth
      onBack={() => {
        setUserMode(null);
        setClientPortalType(null);
        setLoginPortal(null);
        setPortalError('');
        setShowModeSelection(true);
        setShowPortalSelection(false);
      }}
      onPasswordReset={() => setShowPasswordReset(true)}
      portalError={portalError}
      portalLabel={loginPortal === 'client' ? 'Client Portal' : loginPortal === 'system_admin' ? 'System Admin' : undefined}
    />;
  }

  if (userMode === 'admin' && session) {
    const showNavigation = true;

    return (
      <div className="h-screen flex flex-col bg-gray-50">
      {showNavigation && (
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40 flex-shrink-0 no-print">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => setCurrentView(null)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Fuel className="w-8 h-8 text-blue-600" />
              <div>
                {userRole === 'super_admin' ? (
                  <>
                    <div className="text-sm font-semibold text-gray-700">Fuel Empowerment Systems (Pty) Ltd</div>
                    <h1 className="text-lg font-bold text-gray-900">FleetFuel System</h1>
                  </>
                ) : (
                  <h1 className="text-xl font-bold text-gray-900 text-left">FleetFuel</h1>
                )}
              </div>
            </button>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView(null)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Main Menu
              </button>
              <button
                onClick={handleAdminSignOut}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>
      )}

      <main className="flex-1 overflow-auto">
        <div className={`max-w-7xl mx-auto ${(currentView === 'garages' && userRole !== 'super_admin') || (currentView === 'reports' && userRole !== 'super_admin') ? 'px-4' : 'px-4 py-6'}`}>
        {!showNavigation && (
          <div className="flex items-center justify-between mb-6 no-print">
            <div className="flex items-center gap-2">
              <Fuel className="w-8 h-8 text-blue-600" />
              <div>
                {userRole === 'super_admin' ? (
                  <>
                    <div className="text-sm font-semibold text-gray-700">Fuel Empowerment Systems (Pty) Ltd</div>
                    <h1 className="text-lg font-bold text-gray-900">FleetFuel System</h1>
                  </>
                ) : (
                  <h1 className="text-xl font-bold text-gray-900">FleetFuel</h1>
                )}
              </div>
            </div>
            <button
              onClick={handleAdminSignOut}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        )}

        {!currentView ? (
          userRole === 'super_admin' ? (
            <SuperAdminDashboard key="dashboard-super" onNavigate={setCurrentView} />
          ) : clientPortalType === 'card' ? (
            <ClientCardDashboard key="dashboard-card" onNavigate={setCurrentView} onSignOut={handleAdminSignOut} />
          ) : clientPortalType === 'account' ? (
            <ClientAccountDashboard key="dashboard-account" onNavigate={setCurrentView} onSignOut={handleAdminSignOut} />
          ) : (
            <ClientDashboard key="dashboard-client" onNavigate={setCurrentView} onSignOut={handleAdminSignOut} paymentOption={paymentOption} />
          )
        ) : currentView === 'organization' ? (
          <div className="space-y-4">
            <button
              onClick={() => setCurrentView(null)}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Main Menu
            </button>
            <OrganizationManagement key="organization" />
          </div>
        ) : currentView === 'clients' ? (
          <div className="space-y-4">
            <button
              onClick={() => setCurrentView(null)}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Main Menu
            </button>
            <ClientOrganizations key="clients" />
          </div>
        ) : currentView === 'client-organizations-menu' ? (
          <ClientOrganizationsMenu key="client-organizations-menu" onNavigate={setCurrentView} />
        ) : currentView === 'create-client-org' ? (
          <CreateClientOrganization key="create-client-org" onNavigate={setCurrentView} />
        ) : currentView === 'client-org-info' ? (
          <ClientOrgInfo key="client-org-info" onNavigate={setCurrentView} />
        ) : currentView === 'client-user-info' ? (
          <UserManagement key="client-user-info" onNavigate={setCurrentView} />
        ) : currentView === 'client-financial-info' ? (
          <ClientFinancialInfo key="client-financial-info" onNavigate={setCurrentView} />
        ) : currentView === 'vehicles' ? (
          <VehicleManagement key="vehicles" onNavigate={setCurrentView} />
        ) : currentView === 'garages' ? (
          userRole === 'super_admin' ? (
            <GarageManagement key="garages" onNavigate={setCurrentView} />
          ) : clientPortalType === 'account' ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Local Garage Accounts</h2>
              <p className="text-gray-600">Manage your local accounts with garages where you can refuel</p>
              {organizationId && organizationName && (
                <ClientGarageAccounts organizationId={organizationId} organizationName={organizationName} />
              )}
            </div>
          ) : (
            <ClientGaragesView key="garages" onNavigate={setCurrentView} />
          )
        ) : currentView === 'drivers' ? (
          <DriverManagement key="drivers" onNavigate={setCurrentView} />
        ) : currentView === 'invoices' ? (
          userRole === 'super_admin' ? <InvoiceManagement key="invoices" /> : <ClientInvoices key="invoices" />
        ) : currentView === 'invoices-menu' ? (
          clientPortalType === 'card' ? (
            <ClientCardDashboard key="invoices-menu-card" onNavigate={setCurrentView} onSignOut={handleAdminSignOut} initialView="invoices" />
          ) : clientPortalType === 'account' ? (
            <ClientAccountDashboard key="invoices-menu-account" onNavigate={setCurrentView} onSignOut={handleAdminSignOut} initialView="invoices" />
          ) : (
            <ClientDashboard key="invoices-menu" onNavigate={setCurrentView} onSignOut={handleAdminSignOut} initialView="invoices" paymentOption={paymentOption} />
          )
        ) : currentView === 'fee-invoices' ? (
          <ClientInvoices key="fee-invoices" onNavigate={setCurrentView} />
        ) : currentView === 'fuel-invoices' ? (
          <ClientFuelInvoices key="fuel-invoices" onNavigate={setCurrentView} />
        ) : currentView === 'reports-menu' ? (
          clientPortalType === 'card' ? (
            <ClientCardDashboard key="reports-menu-card" onNavigate={setCurrentView} onSignOut={handleAdminSignOut} initialView="reports" />
          ) : clientPortalType === 'account' ? (
            <ClientAccountDashboard key="reports-menu-account" onNavigate={setCurrentView} onSignOut={handleAdminSignOut} initialView="reports" />
          ) : (
            <ClientDashboard key="reports-menu" onNavigate={setCurrentView} onSignOut={handleAdminSignOut} initialView="reports" paymentOption={paymentOption} />
          )
        ) : currentView === 'reports' ? (
          userRole === 'super_admin' ? <ConsolidatedReports key="reports" onNavigate={setCurrentView} /> : <ReportsDashboard key="reports" onNavigate={setCurrentView} />
        ) : currentView === 'backoffice' ? (
          <BackOffice key="backoffice" userRole={userRole} paymentOption={paymentOption} onNavigateToMain={() => setCurrentView(null)} />
        ) : currentView === 'custom-reports' ? (
          <CustomReportBuilder key="custom-reports" onNavigate={setCurrentView} />
        ) : currentView === 'backup' ? (
          <BackupManagement key="backup" />
        ) : null}
        </div>
      </main>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow p-6 max-w-md">
        <h2 className="text-xl font-bold text-red-600 mb-4">Debug: Unexpected State</h2>
        <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify({
            userMode,
            hasSession: !!session,
            hasDriverData: !!driverData,
            showModeSelection,
            loading
          }, null, 2)}
        </pre>
        <button
          onClick={() => {
            setUserMode(null);
            setShowModeSelection(true);
            setSession(null);
            setDriverData(null);
          }}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded"
        >
          Reset to Mode Selection
        </button>
      </div>
    </div>
  );
}

export default App;
