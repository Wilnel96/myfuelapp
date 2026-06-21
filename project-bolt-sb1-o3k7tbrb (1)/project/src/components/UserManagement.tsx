import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Plus, CreditCard as Edit2, Trash2, Save, X, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
}

interface OrganizationUser {
  id: string;
  email: string;
  password: string | null;
  first_name: string;
  surname: string;
  title: string;
  phone_office: string | null;
  phone_mobile: string | null;
  is_main_user: boolean;
  is_secondary_main_user: boolean;
  can_add_vehicles: boolean;
  can_edit_vehicles: boolean;
  can_delete_vehicles: boolean;
  can_add_drivers: boolean;
  can_edit_drivers: boolean;
  can_delete_drivers: boolean;
  can_view_reports: boolean;
  can_edit_organization_info: boolean;
  can_view_fuel_transactions: boolean;
  can_create_reports: boolean;
  can_view_custom_reports: boolean;
  can_manage_users: boolean;
  can_view_financial_data: boolean;
  is_active: boolean;
  // Management org Back Office permissions
  can_access_back_office: boolean;
  can_view_org_info: boolean;
  can_edit_org_info: boolean;
  can_view_client_settings: boolean;
  can_edit_client_settings: boolean;
  can_view_invoice_management: boolean;
  can_edit_invoice_management: boolean;
  can_view_fuel_price_update: boolean;
  can_edit_fuel_price_update: boolean;
}

interface UserManagementProps {
  managementMode?: boolean;
  clientSelfMode?: boolean;
  onNavigate?: (view: string) => void;
}

export default function UserManagement({ managementMode = false, clientSelfMode = false, onNavigate }: UserManagementProps) {
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<OrganizationUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isMainUser, setIsMainUser] = useState(false);
  const [isSecondaryMainUser, setIsSecondaryMainUser] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [currentOrgUserId, setCurrentOrgUserId] = useState<string | null>(null);
  const [viewingPermissionsUserId, setViewingPermissionsUserId] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const [hasMainUser, setHasMainUser] = useState(false);
  const editFormRef = useRef<HTMLDivElement>(null);
  const [showDemoteDialog, setShowDemoteDialog] = useState(false);
  const [demotingUserId, setDemotingUserId] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [currentOrgName, setCurrentOrgName] = useState<string>('');
  const [currentOrgEntityType, setCurrentOrgEntityType] = useState<string | null>(null);
  const [clientOrganizations, setClientOrganizations] = useState<Organization[]>([]);
  const [demoteForm, setDemoteForm] = useState({
    title: 'User',
    can_add_vehicles: false,
    can_edit_vehicles: false,
    can_delete_vehicles: false,
    can_add_drivers: false,
    can_edit_drivers: false,
    can_delete_drivers: false,
    can_view_reports: false,
    can_edit_organization_info: false,
    can_view_fuel_transactions: false,
    can_create_reports: false,
    can_view_custom_reports: false,
    can_manage_users: false,
    can_view_financial_data: false,
  });
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    first_name: '',
    surname: '',
    title: 'User',
    phone_office: '',
    phone_mobile: '',
    can_add_vehicles: false,
    can_edit_vehicles: false,
    can_delete_vehicles: false,
    can_add_drivers: false,
    can_edit_drivers: false,
    can_delete_drivers: false,
    can_view_reports: false,
    can_edit_organization_info: false,
    can_view_fuel_transactions: false,
    can_create_reports: false,
    can_view_custom_reports: false,
    can_manage_users: false,
    can_view_financial_data: false,
    can_access_back_office: false,
    can_view_org_info: false,
    can_edit_org_info: false,
    can_view_client_settings: false,
    can_edit_client_settings: false,
    can_view_invoice_management: false,
    can_edit_invoice_management: false,
    can_view_fuel_price_update: false,
    can_edit_fuel_price_update: false,
  });

  const permissionTemplates = {
    admin: {
      name: 'Administrator',
      description: 'Full access to all features except user management',
      permissions: {
        can_add_vehicles: true,
        can_edit_vehicles: true,
        can_delete_vehicles: true,
        can_add_drivers: true,
        can_edit_drivers: true,
        can_delete_drivers: true,
        can_view_reports: true,
        can_edit_organization_info: true,
        can_view_fuel_transactions: true,
        can_create_reports: true,
        can_view_custom_reports: true,
        can_manage_users: false,
        can_view_financial_data: true,
      }
    },
    manager: {
      name: 'Manager',
      description: 'Can manage vehicles, drivers, and view reports',
      permissions: {
        can_add_vehicles: true,
        can_edit_vehicles: true,
        can_delete_vehicles: false,
        can_add_drivers: true,
        can_edit_drivers: true,
        can_delete_drivers: false,
        can_view_reports: true,
        can_edit_organization_info: false,
        can_view_fuel_transactions: true,
        can_create_reports: true,
        can_view_custom_reports: true,
        can_manage_users: false,
        can_view_financial_data: false,
      }
    },
    viewer: {
      name: 'Viewer',
      description: 'Read-only access to reports and data',
      permissions: {
        can_add_vehicles: false,
        can_edit_vehicles: false,
        can_delete_vehicles: false,
        can_add_drivers: false,
        can_edit_drivers: false,
        can_delete_drivers: false,
        can_view_reports: true,
        can_edit_organization_info: false,
        can_view_fuel_transactions: true,
        can_create_reports: false,
        can_view_custom_reports: true,
        can_manage_users: false,
        can_view_financial_data: false,
      }
    },
    custom: {
      name: 'Custom',
      description: 'Manually select permissions',
      permissions: {
        can_add_vehicles: false,
        can_edit_vehicles: false,
        can_delete_vehicles: false,
        can_add_drivers: false,
        can_edit_drivers: false,
        can_delete_drivers: false,
        can_view_reports: false,
        can_edit_organization_info: false,
        can_view_fuel_transactions: false,
        can_create_reports: false,
        can_view_custom_reports: false,
        can_manage_users: false,
        can_view_financial_data: false,
      }
    }
  };

  const applyPermissionTemplate = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = permissionTemplates[templateKey as keyof typeof permissionTemplates];
    if (template) {
      setNewUser({
        ...newUser,
        ...template.permissions
      });
    }
  };

  const loadClientOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('organization_type', 'client')
        .eq('is_management_org', false)
        .order('name');

      if (error) throw error;

      setClientOrganizations(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading client organizations:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    checkMainUserStatus();
  }, []);

  useEffect(() => {
    if (isSuperAdmin && !managementMode) {
      loadClientOrganizations();
    }
  }, [isSuperAdmin, managementMode]);

  useEffect(() => {
    if (selectedOrgId) {
      loadUsers();
    }
  }, [selectedOrgId, isSuperAdmin, managementMode]);

  useEffect(() => {
    if (editingUser && editFormRef.current) {
      const scrollToTop = () => {
        if (editFormRef.current) {
          editFormRef.current.scrollTop = 0;
        }
      };

      scrollToTop();
      requestAnimationFrame(scrollToTop);
      setTimeout(scrollToTop, 0);
      setTimeout(scrollToTop, 50);
      setTimeout(scrollToTop, 100);
      setTimeout(scrollToTop, 200);
      setTimeout(scrollToTop, 300);
    }
  }, [editingUser]);

  const checkMainUserStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setError('Not authenticated');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setError('Error loading profile');
        setLoading(false);
        return;
      }

      if (profile?.role === 'super_admin') {
        setIsMainUser(true);
        setIsSuperAdmin(true);

        if (managementMode) {
          const { data: mgmtOrg } = await supabase
            .from('organizations')
            .select('id')
            .eq('name', 'FUEL EMPOWERMENT SYSTEMS (PTY) LTD')
            .maybeSingle();

          if (mgmtOrg) {
            setSelectedOrgId(mgmtOrg.id);
          } else {
            setLoading(false);
            setError('Management organization not found');
          }
        }
        return;
      }

      // For regular users, check permissions and set organization ID
      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('id, is_main_user, is_secondary_main_user, can_manage_users')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      const mainUser = orgUser?.is_main_user || false;
      const secondaryMainUser = orgUser?.is_secondary_main_user || false;
      const manageUsers = orgUser?.can_manage_users || false;

      console.log('User permissions:', { mainUser, secondaryMainUser, manageUsers, orgUser });

      setIsMainUser(mainUser);
      setIsSecondaryMainUser(secondaryMainUser);
      setCanManageUsers(manageUsers);
      setCurrentOrgUserId(orgUser?.id || null);

      // Set the organization ID for non-super admin users (works for both management mode and regular mode)
      if (profile?.organization_id) {
        setSelectedOrgId(profile.organization_id);
      } else {
        setLoading(false);
        setError('No organization found for user');
      }
    } catch (err) {
      console.error('Error checking main user status:', err);
      setError('Error loading user permissions');
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let organizationId: string;

      if (isSuperAdmin && selectedOrgId) {
        organizationId = selectedOrgId;

        const selectedOrg = clientOrganizations.find(org => org.id === selectedOrgId);
        if (selectedOrg) {
          setCurrentOrgName(selectedOrg.name);
        }
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id, organizations(name, entity_type)')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.organization_id) throw new Error('No organization found');
        organizationId = profile.organization_id;

        if (profile.organizations && 'name' in profile.organizations) {
          setCurrentOrgName(profile.organizations.name as string);
          setCurrentOrgEntityType((profile.organizations as any).entity_type as string | null);
        }
      }

      const { data, error: fetchError } = await supabase
        .from('organization_users')
        .select('*')
        .eq('organization_id', organizationId)
        .order('first_name');

      if (fetchError) throw fetchError;

      // Custom sort order for titles
      const titleOrder: { [key: string]: number } = {
        'Main User': 1,
        'Secondary Main User': 2,
        'Billing User': 3,
        'Driver User': 4,
        'Vehicle User': 5,
        'User': 6
      };

      // Sort by title hierarchy, then by secondary main user status, then by main user status, then by name
      const sortedData = (data || []).sort((a, b) => {
        // First, sort by main user status (main users first)
        if (a.is_main_user && !b.is_main_user) return -1;
        if (!a.is_main_user && b.is_main_user) return 1;

        // Then by secondary main user status
        if (a.is_secondary_main_user && !b.is_secondary_main_user) return -1;
        if (!a.is_secondary_main_user && b.is_secondary_main_user) return 1;

        // Then by title order
        const orderA = titleOrder[a.title] || 999;
        const orderB = titleOrder[b.title] || 999;
        if (orderA !== orderB) return orderA - orderB;

        // Finally by name
        return a.first_name.localeCompare(b.first_name);
      });

      setUsers(sortedData);
      setHasMainUser((sortedData || []).some(u => u.is_main_user));
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    try {
      setError('');
      setSuccess('');

      if (!newUser.email || !newUser.password || !newUser.first_name) {
        throw new Error('Email, password, and first name are required');
      }

      if (newUser.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      let apiUrl: string;
      let requestBody: any;

      if (isSuperAdmin && managementMode && selectedOrgId) {
        apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization-users`;
        requestBody = {
          organization_id: selectedOrgId,
          users: [{
            email: newUser.email,
            password: newUser.password,
            name: newUser.first_name,
            surname: newUser.surname,
            title: newUser.title,
            phone_office: newUser.phone_office || null,
            phone_mobile: newUser.phone_mobile || null,
            is_main_user: false,
            role: 'user',
            can_add_vehicles: newUser.can_add_vehicles,
            can_edit_vehicles: newUser.can_edit_vehicles,
            can_delete_vehicles: newUser.can_delete_vehicles,
            can_add_drivers: newUser.can_add_drivers,
            can_edit_drivers: newUser.can_edit_drivers,
            can_delete_drivers: newUser.can_delete_drivers,
            can_view_reports: newUser.can_view_reports,
            can_edit_organization_info: newUser.can_edit_organization_info,
            can_view_fuel_transactions: newUser.can_view_fuel_transactions,
            can_create_reports: newUser.can_create_reports,
            can_view_custom_reports: newUser.can_view_custom_reports,
            can_manage_users: newUser.can_manage_users,
            can_view_financial_data: newUser.can_view_financial_data,
            can_access_back_office: newUser.can_access_back_office,
            can_view_org_info: newUser.can_view_org_info,
            can_edit_org_info: newUser.can_edit_org_info,
            can_view_client_settings: newUser.can_view_client_settings,
            can_edit_client_settings: newUser.can_edit_client_settings,
            can_view_invoice_management: newUser.can_view_invoice_management,
            can_edit_invoice_management: newUser.can_edit_invoice_management,
            can_view_fuel_price_update: newUser.can_view_fuel_price_update,
            can_edit_fuel_price_update: newUser.can_edit_fuel_price_update,
          }],
        };
      } else {
        apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
        requestBody = {
          email: newUser.email,
          password: newUser.password,
          name: newUser.first_name,
          surname: newUser.surname,
          title: newUser.title,
          organization_id: isSuperAdmin && selectedOrgId ? selectedOrgId : undefined,
          phone_office: newUser.phone_office || null,
          phone_mobile: newUser.phone_mobile || null,
          can_add_vehicles: newUser.can_add_vehicles,
          can_edit_vehicles: newUser.can_edit_vehicles,
          can_delete_vehicles: newUser.can_delete_vehicles,
          can_add_drivers: newUser.can_add_drivers,
          can_edit_drivers: newUser.can_edit_drivers,
          can_delete_drivers: newUser.can_delete_drivers,
          can_view_reports: newUser.can_view_reports,
          can_edit_organization_info: newUser.can_edit_organization_info,
          can_view_fuel_transactions: newUser.can_view_fuel_transactions,
          can_create_reports: newUser.can_create_reports,
          can_view_custom_reports: newUser.can_view_custom_reports,
          can_manage_users: newUser.can_manage_users,
          can_view_financial_data: newUser.can_view_financial_data,
        };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      setSuccess('User created successfully! They can now sign in with their email and password.');
      setShowAddForm(false);
      setSelectedTemplate('custom');
      setNewUser({
        email: '',
        password: '',
        first_name: '',
        surname: '',
        title: 'User',
        phone_office: '',
        phone_mobile: '',
        can_add_vehicles: false,
        can_edit_vehicles: false,
        can_delete_vehicles: false,
        can_add_drivers: false,
        can_edit_drivers: false,
        can_delete_drivers: false,
        can_view_reports: false,
        can_edit_organization_info: false,
        can_view_fuel_transactions: false,
        can_create_reports: false,
        can_view_custom_reports: false,
        can_manage_users: false,
        can_view_financial_data: false,
        can_access_back_office: false,
        can_view_org_info: false,
        can_edit_org_info: false,
        can_view_client_settings: false,
        can_edit_client_settings: false,
        can_view_invoice_management: false,
        can_edit_invoice_management: false,
        can_view_fuel_price_update: false,
        can_edit_fuel_price_update: false,
      });
      loadUsers();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('Error adding user:', err);
      setError(err.message);
    }
  };

  const handleEditUser = (user: OrganizationUser) => {
    console.log('Editing user:', user);
    console.log('is_main_user:', user.is_main_user, 'is_secondary_main_user:', user.is_secondary_main_user);
    setEditingUser(user);
    setNewPassword('');
    setShowAddForm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      setError('');
      setSuccess('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Check if user has a user_id (auth account)
      const { data: orgUserData } = await supabase
        .from('organization_users')
        .select('user_id')
        .eq('id', editingUser.id)
        .maybeSingle();

      // If no user_id exists and password is provided, create auth account
      if (!orgUserData?.user_id && newPassword && newPassword.trim()) {
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        // Create new auth user for legacy organization_user
        const createUserUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;

        const createResponse = await fetch(createUserUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: editingUser.email,
            password: newPassword,
            name: editingUser.first_name,
            surname: editingUser.surname,
            title: editingUser.title,
            phone_office: editingUser.phone_office || null,
            phone_mobile: editingUser.phone_mobile || null,
            can_add_vehicles: editingUser.can_add_vehicles,
            can_edit_vehicles: editingUser.can_edit_vehicles,
            can_delete_vehicles: editingUser.can_delete_vehicles,
            can_add_drivers: editingUser.can_add_drivers,
            can_edit_drivers: editingUser.can_edit_drivers,
            can_delete_drivers: editingUser.can_delete_drivers,
            can_view_reports: editingUser.can_view_reports,
            can_edit_organization_info: editingUser.can_edit_organization_info,
            can_view_fuel_transactions: editingUser.can_view_fuel_transactions,
            can_create_reports: editingUser.can_create_reports,
            can_view_custom_reports: editingUser.can_view_custom_reports,
            can_manage_users: editingUser.can_manage_users,
            can_view_financial_data: editingUser.can_view_financial_data,
          }),
        });

        const createResult = await createResponse.json();

        if (!createResponse.ok) {
          throw new Error(createResult.error || 'Failed to create auth account');
        }

        setSuccess('Auth account created and user updated successfully! User can now sign in.');
        setEditingUser(null);
        setNewPassword('');
        loadUsers();
        setTimeout(() => setSuccess(''), 5000);
        return;
      }

      // Warn if no user_id and no password provided
      if (!orgUserData?.user_id && (!newPassword || !newPassword.trim())) {
        setError('This user has no auth account. Please set a password to create one.');
        return;
      }

      // Update password if user_id exists and password is provided
      if (orgUserData?.user_id && newPassword && newPassword.trim()) {
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-password`;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: orgUserData.user_id,
            new_password: newPassword,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update password');
        }
      }

      // Update user details
      const { error: updateError } = await supabase
        .from('organization_users')
        .update({
          first_name: editingUser.first_name,
          surname: editingUser.surname,
          title: editingUser.title,
          phone_office: editingUser.phone_office || null,
          phone_mobile: editingUser.phone_mobile || null,
          can_add_vehicles: editingUser.can_add_vehicles,
          can_edit_vehicles: editingUser.can_edit_vehicles,
          can_delete_vehicles: editingUser.can_delete_vehicles,
          can_add_drivers: editingUser.can_add_drivers,
          can_edit_drivers: editingUser.can_edit_drivers,
          can_delete_drivers: editingUser.can_delete_drivers,
          can_view_reports: editingUser.can_view_reports,
          can_edit_organization_info: editingUser.can_edit_organization_info,
          can_view_fuel_transactions: editingUser.can_view_fuel_transactions,
          can_create_reports: editingUser.can_create_reports,
          can_view_custom_reports: editingUser.can_view_custom_reports,
          can_manage_users: editingUser.can_manage_users,
          can_view_financial_data: editingUser.can_view_financial_data,
          can_access_back_office: editingUser.can_access_back_office,
          can_view_org_info: editingUser.can_view_org_info,
          can_edit_org_info: editingUser.can_edit_org_info,
          can_view_client_settings: editingUser.can_view_client_settings,
          can_edit_client_settings: editingUser.can_edit_client_settings,
          can_view_invoice_management: editingUser.can_view_invoice_management,
          can_edit_invoice_management: editingUser.can_edit_invoice_management,
          can_view_fuel_price_update: editingUser.can_view_fuel_price_update,
          can_edit_fuel_price_update: editingUser.can_edit_fuel_price_update,
          is_active: editingUser.is_active,
        })
        .eq('id', editingUser.id);

      if (updateError) throw updateError;

      setSuccess(newPassword ? 'User and password updated successfully' : 'User updated successfully');
      setEditingUser(null);
      setNewPassword('');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message);
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<OrganizationUser>) => {
    try {
      setError('');
      const { error: updateError } = await supabase
        .from('organization_users')
        .update(updates)
        .eq('id', userId);

      if (updateError) throw updateError;

      setSuccess('User updated successfully');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      setError('');
      const { error: deleteError } = await supabase
        .from('organization_users')
        .delete()
        .eq('id', userId);

      if (deleteError) throw deleteError;

      setSuccess('User deleted successfully');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(err.message);
    }
  };

  const handleTransferMainUser = async (toUserId: string) => {
    const fromUser = editingUser;
    const toUser = users.find(u => u.id === toUserId);

    if (!fromUser || !toUser) return;

    const confirmMessage = fromUser.id === currentOrgUserId
      ? 'Are you sure you want to transfer your main user status to this user? This will remove your main user status and give them full control.'
      : `Are you sure you want to transfer main user status from ${fromUser.first_name} ${fromUser.surname} to ${toUser.first_name} ${toUser.surname}? This will give them full control of the organization.`;

    if (!confirm(confirmMessage)) return;

    try {
      setError('');
      setSuccess('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error: rpcError } = await supabase.rpc('transfer_main_user', {
        from_user_id: fromUser.id,
        to_user_id: toUserId
      });

      if (rpcError) throw rpcError;

      setSuccess(`Main user status transferred successfully to ${toUser.first_name} ${toUser.surname}`);
      setEditingUser(null);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error transferring main user:', err);
      setError(err.message);
    }
  };

  const handleToggleSecondaryMainUser = async (userId: string, currentStatus: boolean) => {
    if (currentStatus) {
      setDemotingUserId(userId);
      setDemoteForm({
        title: 'User',
        can_add_vehicles: false,
        can_edit_vehicles: false,
        can_delete_vehicles: false,
        can_add_drivers: false,
        can_edit_drivers: false,
        can_delete_drivers: false,
        can_view_reports: false,
        can_edit_organization_info: false,
        can_view_fuel_transactions: false,
        can_create_reports: false,
        can_view_custom_reports: false,
        can_manage_users: false,
        can_view_financial_data: false,
      });
      setShowDemoteDialog(true);
    } else {
      if (!confirm(`Are you sure you want to make this user a secondary main user?`)) return;

      try {
        setError('');
        setSuccess('');

        const { error: rpcError } = await supabase.rpc('toggle_secondary_main_user', {
          user_id_to_toggle: userId
        });

        if (rpcError) throw rpcError;

        setSuccess('User promoted to secondary main user successfully');
        if (editingUser?.id === userId) {
          setEditingUser({ ...editingUser, is_secondary_main_user: true });
        }
        loadUsers();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err: any) {
        console.error('Error promoting to secondary main user:', err);
        setError(err.message);
      }
    }
  };

  const handleDemoteSecondaryMainUser = async () => {
    if (!demotingUserId) return;

    try {
      setError('');
      setSuccess('');

      const { error: rpcError } = await supabase.rpc('remove_secondary_main_user_with_role', {
        user_id_to_demote: demotingUserId,
        new_title: demoteForm.title,
        new_permissions: demoteForm
      });

      if (rpcError) throw rpcError;

      setSuccess('Secondary main user status removed successfully');
      if (editingUser?.id === demotingUserId) {
        setEditingUser({ ...editingUser, is_secondary_main_user: false, title: demoteForm.title });
      }
      setShowDemoteDialog(false);
      setDemotingUserId(null);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error demoting secondary main user:', err);
      setError(err.message);
    }
  };

  const handleRemoveMainUser = async () => {
    const hasSecondaryMain = users.some(u => u.is_secondary_main_user && u.is_active && u.id !== editingUser?.id);

    if (!hasSecondaryMain) {
      setError('Cannot remove main user status: You must first nominate a secondary main user.');
      return;
    }

    if (!confirm('Are you sure you want to remove your main user status? The secondary main user will become the primary administrator.')) return;

    try {
      setError('');
      setSuccess('');

      const { error: updateError } = await supabase
        .from('organization_users')
        .update({ is_main_user: false })
        .eq('id', editingUser!.id);

      if (updateError) throw updateError;

      setSuccess('Main user status removed successfully');
      setEditingUser(null);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error removing main user:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isMainUser && !isSecondaryMainUser && !canManageUsers && !isSuperAdmin) {
    console.log('Showing Access Restricted. State:', { isMainUser, isSecondaryMainUser, canManageUsers, isSuperAdmin, loading, selectedOrgId });
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-1">Access Restricted</h3>
            <p className="text-yellow-800 text-sm">
              Only users with permission can manage organization users. Please contact your administrator for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuperAdmin && !managementMode && !selectedOrgId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Client User Management</h2>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('client-organizations-menu')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Client Organization Info
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Organization</h3>
          <p className="text-sm text-gray-600 mb-4">
            Please select a client organization to view and manage their users.
          </p>

          {clientOrganizations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No client organizations found
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client Organization
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select an organization --</option>
                {clientOrganizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 -my-6">
      <div className="sticky top-0 z-20 bg-white -mx-4 px-4 py-6 pb-4 border-b border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {showAddForm ? 'Adding New User' : managementMode ? 'Management User Management' : clientSelfMode ? 'User Management' : 'Client User Management'}
            </h2>
          </div>
          {showAddForm ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedTemplate('custom');
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={!newUser.email || !newUser.password || !newUser.first_name}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Creating...' : 'Create New User'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {(isSuperAdmin || isMainUser || isSecondaryMainUser || canManageUsers) && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add User
              </button>
              )}
              {onNavigate && (
                <button
                  onClick={() => onNavigate(managementMode ? 'management-org-menu' : clientSelfMode ? 'backoffice' : 'client-organizations-menu')}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  {managementMode ? 'Back to Management Organization Info' : clientSelfMode ? 'Back to Back Office' : 'Back to Client Organization Info'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      {isSuperAdmin && !managementMode && selectedOrgId && (
        <div className="sticky top-[88px] z-10 -mt-6 bg-white border border-gray-200 rounded-lg p-3">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            {showAddForm ? 'Creating a New user for' : 'Managing Users for'}
          </label>
          <select
            value={selectedOrgId}
            onChange={(e) => {
              setSelectedOrgId(e.target.value);
              setShowAddForm(false);
              setEditingUser(null);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {clientOrganizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!managementMode && !isSuperAdmin && showAddForm && currentOrgName && (
        <div className="sticky top-[88px] z-10 -mt-6 bg-white border border-gray-200 rounded-lg p-3">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Creating a New user
          </label>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-900">
              {currentOrgName}
            </p>
          </div>
        </div>
      )}

      {managementMode && showAddForm && isSuperAdmin && (
        <div className="sticky top-[88px] z-10 -mt-6 bg-white border border-gray-200 rounded-lg p-3">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Creating a New user
          </label>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-900">
              FUEL EMPOWERMENT SYSTEMS (PTY) LTD
            </p>
          </div>
        </div>
      )}

      {(!isSuperAdmin || managementMode || (isSuperAdmin && selectedOrgId)) && showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUser.first_name}
                  onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Surname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUser.surname}
                  onChange={(e) => setNewUser({ ...newUser, surname: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  User Title / Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={newUser.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    if (newTitle === 'Secondary Main User') {
                      // Grant all permissions to Secondary Main User
                      setNewUser({
                        ...newUser,
                        title: newTitle,
                        can_add_vehicles: true,
                        can_edit_vehicles: true,
                        can_delete_vehicles: true,
                        can_add_drivers: true,
                        can_edit_drivers: true,
                        can_delete_drivers: true,
                        can_view_reports: true,
                        can_edit_organization_info: true,
                        can_view_fuel_transactions: true,
                        can_create_reports: true,
                        can_view_custom_reports: true,
                        can_manage_users: true,
                        can_view_financial_data: true,
                      });
                    } else {
                      setNewUser({ ...newUser, title: newTitle });
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="Main User">Main User</option>
                  <option value="Secondary Main User">Secondary Main User</option>
                  <option value="Billing User">Billing User</option>
                  <option value="Driver User">Driver User</option>
                  <option value="Vehicle User">Vehicle User</option>
                  <option value="User">User</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Office Number</label>
                <input
                  type="tel"
                  value={newUser.phone_office}
                  onChange={(e) => setNewUser({ ...newUser, phone_office: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Mobile Number</label>
                <input
                  type="tel"
                  value={newUser.phone_mobile}
                  onChange={(e) => setNewUser({ ...newUser, phone_mobile: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Permissions</h4>

                <div className="space-y-3">
                  <div className="border border-gray-200 rounded-lg p-3">
                    <h5 className="text-xs font-semibold text-gray-800 mb-2">Organization Management</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_edit_organization_info}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_edit_organization_info: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can Edit Organization Info</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_manage_users}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_manage_users: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can Manage Users</span>
                      </label>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <h5 className="text-xs font-semibold text-gray-800 mb-2">Vehicle Management</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_add_vehicles}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_add_vehicles: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can Add Vehicles</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_edit_vehicles}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_edit_vehicles: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can Edit Vehicles</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_delete_vehicles}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_delete_vehicles: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can Delete Vehicles</span>
                      </label>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <h5 className="text-xs font-semibold text-gray-800 mb-2">Driver Management</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_add_drivers}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_add_drivers: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can Add Drivers</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_edit_drivers}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_edit_drivers: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can Edit Drivers</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_delete_drivers}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_delete_drivers: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can Delete Drivers</span>
                      </label>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <h5 className="text-xs font-semibold text-gray-800 mb-2">Fuel Transactions</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_view_fuel_transactions}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_view_fuel_transactions: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can View Fuel Transactions</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 italic">Note: Fuel transactions are created only by drivers via the mobile app and cannot be edited or deleted by anyone to maintain data integrity</p>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <h5 className="text-xs font-semibold text-gray-800 mb-2">Reports & Data</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_view_reports}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_view_reports: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can View Reports</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_create_reports}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_create_reports: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can Create Reports</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_view_custom_reports}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_view_custom_reports: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can View Custom Reports</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.can_view_financial_data}
                          onChange={(e) => {
                            setNewUser({ ...newUser, can_view_financial_data: e.target.checked });
                            setSelectedTemplate('custom');
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-xs text-gray-700">Can View Financial Data</span>
                      </label>
                    </div>
                  </div>

                  {managementMode && (
                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                      <h5 className="text-xs font-semibold text-blue-900 mb-1">Back Office Access</h5>
                      <p className="text-xs text-blue-700 mb-2">Controls what this user can access in the Back Office.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 cursor-pointer col-span-2">
                          <input type="checkbox" checked={newUser.can_access_back_office} onChange={(e) => setNewUser({ ...newUser, can_access_back_office: e.target.checked })} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs font-medium text-gray-800">Can Access Back Office</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newUser.can_view_org_info} onChange={(e) => setNewUser({ ...newUser, can_view_org_info: e.target.checked })} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs text-gray-700">View Management Org Info</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newUser.can_edit_org_info} onChange={(e) => setNewUser({ ...newUser, can_edit_org_info: e.target.checked })} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs text-gray-700">Edit Management Org Info</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newUser.can_view_client_settings} onChange={(e) => setNewUser({ ...newUser, can_view_client_settings: e.target.checked })} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs text-gray-700">View Client Financial Settings</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newUser.can_edit_client_settings} onChange={(e) => setNewUser({ ...newUser, can_edit_client_settings: e.target.checked })} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs text-gray-700">Edit Client Financial Settings</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newUser.can_view_invoice_management} onChange={(e) => setNewUser({ ...newUser, can_view_invoice_management: e.target.checked })} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs text-gray-700">View Invoice Management</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newUser.can_edit_invoice_management} onChange={(e) => setNewUser({ ...newUser, can_edit_invoice_management: e.target.checked })} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs text-gray-700">Edit Invoice Management</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newUser.can_view_fuel_price_update} onChange={(e) => setNewUser({ ...newUser, can_view_fuel_price_update: e.target.checked })} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs text-gray-700">View Fuel Price Update</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newUser.can_edit_fuel_price_update} onChange={(e) => setNewUser({ ...newUser, can_edit_fuel_price_update: e.target.checked })} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          <span className="text-xs text-gray-700">Perform Fuel Price Update</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div
          ref={(el) => {
            editFormRef.current = el;
            if (el) {
              el.scrollTop = 0;
            }
          }}
          key={editingUser.id}
          className="fixed inset-0 bg-white z-50 overflow-y-auto"
        >
          <div className="sticky top-0 z-10 bg-white border-b shadow-sm p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <button
                onClick={() => {
                  setEditingUser(null);
                  setNewPassword('');
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Back to Menu
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setNewPassword('');
                  }}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editingUser.first_name}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-0.5">Email cannot be changed</p>
              </div>
              {(isMainUser || isSecondaryMainUser || canManageUsers || isSuperAdmin) && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Leave blank to keep current password"
                  />
                  <p className="text-xs text-gray-500 mt-0.5">Minimum 6 characters (optional)</p>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  value={editingUser.first_name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  readOnly={false}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Surname *</label>
                <input
                  type="text"
                  value={editingUser.surname || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, surname: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  readOnly={false}
                  required
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <label className="block text-xs font-semibold text-gray-800 mb-1.5">User Title / Role *</label>
              <select
                value={editingUser.title || 'User'}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  if (newTitle === 'Secondary Main User') {
                    // Grant all permissions to Secondary Main User
                    setEditingUser({
                      ...editingUser,
                      title: newTitle,
                      can_add_vehicles: true,
                      can_edit_vehicles: true,
                      can_delete_vehicles: true,
                      can_add_drivers: true,
                      can_edit_drivers: true,
                      can_delete_drivers: true,
                      can_view_reports: true,
                      can_edit_organization_info: true,
                      can_view_fuel_transactions: true,
                      can_create_reports: true,
                      can_view_custom_reports: true,
                      can_manage_users: true,
                      can_view_financial_data: true,
                    });
                  } else {
                    setEditingUser({ ...editingUser, title: newTitle });
                  }
                }}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                required
              >
                <option value="Main User">Main User</option>
                <option value="Secondary Main User">Secondary Main User</option>
                <option value="Billing User">Billing User</option>
                <option value="Driver User">Driver User</option>
                <option value="Vehicle User">Vehicle User</option>
                <option value="User">User</option>
              </select>
              <p className="text-xs text-gray-600 mt-0.5">Select the role that best describes this user's responsibilities</p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Office Number</label>
                <input
                  type="tel"
                  value={editingUser.phone_office || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone_office: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  readOnly={false}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={editingUser.phone_mobile || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone_mobile: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  readOnly={false}
                />
              </div>
            </div>

            {editingUser.is_secondary_main_user && (
              <div className="bg-orange-50 border border-orange-200 rounded p-2">
                <h5 className="text-xs font-semibold text-orange-900 mb-1">Remove Secondary Main User Status</h5>
                <p className="text-xs text-orange-700 mb-2">
                  Remove Secondary Main User status from this user. You can then set custom permissions for them.
                </p>
                <button
                  onClick={() => {
                    setDemotingUserId(editingUser.id);
                    setShowDemoteDialog(true);
                  }}
                  className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-xs"
                >
                  Remove Secondary Main User Status
                </button>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-gray-800 mb-2">Permissions</h4>
              {editingUser.is_main_user || editingUser.is_secondary_main_user ? (
                <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                  <p className="text-xs text-green-800 font-medium">
                    All Permissions Granted ({editingUser.is_main_user ? 'Main User' : 'Secondary Main User'})
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    This user has full access to all features and settings.
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded p-2">
                  <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Vehicles</h5>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_add_vehicles}
                        onChange={(e) => setEditingUser({ ...editingUser, can_add_vehicles: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can Add Vehicles</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_edit_vehicles}
                        onChange={(e) => setEditingUser({ ...editingUser, can_edit_vehicles: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can Edit Vehicles</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_delete_vehicles}
                        onChange={(e) => setEditingUser({ ...editingUser, can_delete_vehicles: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can Delete Vehicles</span>
                    </label>
                  </div>
                </div>

                <div className="border border-gray-200 rounded p-2">
                  <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Drivers</h5>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_add_drivers}
                        onChange={(e) => setEditingUser({ ...editingUser, can_add_drivers: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can Add Drivers</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_edit_drivers}
                        onChange={(e) => setEditingUser({ ...editingUser, can_edit_drivers: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can Edit Drivers</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_delete_drivers}
                        onChange={(e) => setEditingUser({ ...editingUser, can_delete_drivers: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can Delete Drivers</span>
                    </label>
                  </div>
                </div>

                <div className="border border-gray-200 rounded p-2">
                  <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Fuel Transactions</h5>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_view_fuel_transactions}
                        onChange={(e) => setEditingUser({ ...editingUser, can_view_fuel_transactions: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can View Fuel Transactions</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 italic">Note: Fuel transactions are created only by drivers via the mobile app and cannot be edited or deleted by anyone to maintain data integrity</p>
                </div>

                <div className="border border-gray-200 rounded p-2">
                  <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Reports & Data</h5>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_view_reports}
                        onChange={(e) => setEditingUser({ ...editingUser, can_view_reports: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can View Reports</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_create_reports}
                        onChange={(e) => setEditingUser({ ...editingUser, can_create_reports: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can Create Reports</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_view_custom_reports}
                        onChange={(e) => setEditingUser({ ...editingUser, can_view_custom_reports: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can View Custom Reports</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_view_financial_data}
                        onChange={(e) => setEditingUser({ ...editingUser, can_view_financial_data: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can View Financial Data</span>
                    </label>
                  </div>
                </div>

                <div className="border border-gray-200 rounded p-2">
                  <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Administration</h5>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_edit_organization_info}
                        onChange={(e) => setEditingUser({ ...editingUser, can_edit_organization_info: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can Edit Organization Info</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.can_manage_users}
                        onChange={(e) => setEditingUser({ ...editingUser, can_manage_users: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Can Manage Users</span>
                    </label>
                  </div>
                </div>

                <div className="border border-gray-200 rounded p-2">
                  <h5 className="text-xs font-semibold text-gray-800 mb-1.5">Status</h5>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.is_active}
                        onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-700">Active User</span>
                    </label>
                  </div>
                </div>

                {managementMode && (
                  <div className="col-span-2 border border-blue-200 bg-blue-50 rounded p-2">
                    <h5 className="text-xs font-semibold text-blue-900 mb-1">Back Office Access</h5>
                    <p className="text-xs text-blue-700 mb-2">Controls what this user can access in the Back Office. Main User and Secondary Main User always have full access.</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer col-span-2">
                        <input
                          type="checkbox"
                          checked={editingUser.can_access_back_office}
                          onChange={(e) => setEditingUser({ ...editingUser, can_access_back_office: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs font-medium text-gray-800">Can Access Back Office</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.can_view_org_info}
                          onChange={(e) => setEditingUser({ ...editingUser, can_view_org_info: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-gray-700">View Management Org Info</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.can_edit_org_info}
                          onChange={(e) => setEditingUser({ ...editingUser, can_edit_org_info: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-gray-700">Edit Management Org Info</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.can_view_client_settings}
                          onChange={(e) => setEditingUser({ ...editingUser, can_view_client_settings: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-gray-700">View Client Financial Settings</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.can_edit_client_settings}
                          onChange={(e) => setEditingUser({ ...editingUser, can_edit_client_settings: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-gray-700">Edit Client Financial Settings</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.can_view_invoice_management}
                          onChange={(e) => setEditingUser({ ...editingUser, can_view_invoice_management: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-gray-700">View Invoice Management</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.can_edit_invoice_management}
                          onChange={(e) => setEditingUser({ ...editingUser, can_edit_invoice_management: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-gray-700">Edit Invoice Management</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.can_view_fuel_price_update}
                          onChange={(e) => setEditingUser({ ...editingUser, can_view_fuel_price_update: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-gray-700">View Fuel Price Update</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingUser.can_edit_fuel_price_update}
                          onChange={(e) => setEditingUser({ ...editingUser, can_edit_fuel_price_update: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-xs text-gray-700">Perform Fuel Price Update</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>

            {(() => {
              const showMainUserManagement = (editingUser.is_main_user || editingUser.is_secondary_main_user) && (isMainUser || isSecondaryMainUser || isSuperAdmin);
              console.log('Main User Management visibility:', {
                editingUser_is_main_user: editingUser.is_main_user,
                editingUser_is_secondary_main_user: editingUser.is_secondary_main_user,
                currentUser_isMainUser: isMainUser,
                currentUser_isSecondaryMainUser: isSecondaryMainUser,
                currentUser_isSuperAdmin: isSuperAdmin,
                showMainUserManagement
              });
              return showMainUserManagement;
            })() && (
              <div className="border-t pt-3 mt-3">
                <h4 className="text-xs font-semibold text-gray-800 mb-2">Main User Management</h4>
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded p-2">
                    <h5 className="text-xs font-semibold text-blue-900 mb-1">Transfer Main User Status</h5>
                    <p className="text-xs text-blue-700 mb-2">
                      Transfer main user status from {editingUser.id === currentOrgUserId ? 'yourself' : `${editingUser.first_name} ${editingUser.surname}`} to another user. This will give them full control of the organization.
                    </p>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleTransferMainUser(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select user to transfer to...</option>
                      {users
                        .filter(u => u.id !== editingUser.id && u.is_active)
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.first_name} {u.surname} ({u.email}) {u.is_secondary_main_user ? '- Secondary Main User' : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded p-2">
                    <h5 className="text-xs font-semibold text-purple-900 mb-1">Secondary Main User</h5>
                    <p className="text-xs text-purple-700 mb-2">
                      Nominate a secondary main user who can manage the organization when the main user is unavailable.
                    </p>
                    {users.some(u => u.is_secondary_main_user && u.is_active) ? (
                      <div className="space-y-1.5">
                        {users
                          .filter(u => u.is_secondary_main_user && u.is_active)
                          .map(u => (
                            <div key={u.id} className="flex items-center justify-between bg-white p-1.5 rounded border border-purple-200">
                              <span className="text-xs text-gray-700">{u.first_name} {u.surname}</span>
                              <button
                                onClick={() => handleToggleSecondaryMainUser(u.id, true)}
                                className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleToggleSecondaryMainUser(e.target.value, false);
                            e.target.value = '';
                          }
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="">Select user to nominate...</option>
                        {users
                          .filter(u => u.id !== editingUser.id && u.is_active && !u.is_main_user && !u.is_secondary_main_user)
                          .map(u => (
                            <option key={u.id} value={u.id}>
                              {u.first_name} {u.surname} ({u.email})
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  {users.some(u => u.is_secondary_main_user && u.is_active) && (
                    <div className="bg-orange-50 border border-orange-200 rounded p-2">
                      <h5 className="text-xs font-semibold text-orange-900 mb-1">Remove Main User Status</h5>
                      <p className="text-xs text-orange-700 mb-2">
                        Remove your main user status. This can only be done when a secondary main user exists.
                      </p>
                      <button
                        onClick={handleRemoveMainUser}
                        className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-xs"
                      >
                        Remove My Main User Status
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(!isSuperAdmin || managementMode || (isSuperAdmin && selectedOrgId)) && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Existing Users</h3>

          {users.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const hasBillingRow = users.some(u => u.title === 'Billing User');
              const mainUser = users.find(u => u.is_main_user);
              const showSyntheticBilling =
                currentOrgEntityType === 'Individual' && !hasBillingRow && !!mainUser;
              return (
                <>
                  {users.map((user) => (
              <div key={user.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="w-full px-4 py-3 flex items-center justify-between">
                  <button
                    onClick={() => setViewingUserId(viewingUserId === user.id ? null : user.id)}
                    className="flex items-center gap-3 flex-1 hover:bg-gray-50 transition-colors -mx-4 -my-3 px-4 py-3"
                  >
                    <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300 rounded">{user.title}</span>
                    <span className="text-sm font-medium text-gray-900">{user.first_name} {user.surname}</span>
                    {user.is_active ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Inactive</span>
                    )}
                    <span className="text-gray-400 ml-auto">{viewingUserId === user.id ? '▼' : '▶'}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditUser(user);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ml-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </button>
                </div>

                {viewingUserId === user.id && (
                  <div className="border-t border-gray-200 p-6">
                    {!user.is_main_user && (
                      <div className="flex items-center justify-end gap-2 mb-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(user.id);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm">Delete</span>
                        </button>
                      </div>
                    )}

                    <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="text"
                        value={(isMainUser || isSecondaryMainUser || canManageUsers || isSuperAdmin) ? (user.password || '••••••••') : '••••••••'}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        type="text"
                        value={user.first_name}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
                      <input
                        type="text"
                        value={user.surname}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Office Number</label>
                      <input
                        type="tel"
                        value={user.phone_office || ''}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                        placeholder="e.g., 021 123 4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        value={user.phone_mobile || ''}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                        placeholder="e.g., 082 123 4567"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setViewingPermissionsUserId(viewingPermissionsUserId === user.id ? null : user.id)}
                      className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {viewingPermissionsUserId === user.id ? 'Hide Permissions' : 'View Permissions'}
                    </button>
                  </div>

                  {viewingPermissionsUserId === user.id && (
                    <div className="pt-4">
                      {user.is_main_user ? (
                        <div className="text-sm text-green-600 font-medium text-center py-4">
                          All Permissions Granted (Main User)
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="border border-gray-200 rounded-lg p-3">
                            <h5 className="text-sm font-semibold text-gray-800 mb-2">Organization Management</h5>
                            <div className="grid md:grid-cols-2 gap-2">
                              <div className={`text-sm ${user.can_edit_organization_info ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_edit_organization_info ? '✓' : '✗'} Can Edit Organization Info
                              </div>
                              <div className={`text-sm ${user.can_manage_users ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_manage_users ? '✓' : '✗'} Can Manage Users
                              </div>
                            </div>
                          </div>

                          <div className="border border-gray-200 rounded-lg p-3">
                            <h5 className="text-sm font-semibold text-gray-800 mb-2">Vehicle Management</h5>
                            <div className="grid md:grid-cols-2 gap-2">
                              <div className={`text-sm ${user.can_add_vehicles ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_add_vehicles ? '✓' : '✗'} Can Add Vehicles
                              </div>
                              <div className={`text-sm ${user.can_edit_vehicles ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_edit_vehicles ? '✓' : '✗'} Can Edit Vehicles
                              </div>
                              <div className={`text-sm ${user.can_delete_vehicles ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_delete_vehicles ? '✓' : '✗'} Can Delete Vehicles
                              </div>
                            </div>
                          </div>

                          <div className="border border-gray-200 rounded-lg p-3">
                            <h5 className="text-sm font-semibold text-gray-800 mb-2">Driver Management</h5>
                            <div className="grid md:grid-cols-2 gap-2">
                              <div className={`text-sm ${user.can_add_drivers ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_add_drivers ? '✓' : '✗'} Can Add Drivers
                              </div>
                              <div className={`text-sm ${user.can_edit_drivers ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_edit_drivers ? '✓' : '✗'} Can Edit Drivers
                              </div>
                              <div className={`text-sm ${user.can_delete_drivers ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_delete_drivers ? '✓' : '✗'} Can Delete Drivers
                              </div>
                            </div>
                          </div>

                          <div className="border border-gray-200 rounded-lg p-3">
                            <h5 className="text-sm font-semibold text-gray-800 mb-2">Fuel Transactions</h5>
                            <div className="grid md:grid-cols-2 gap-2">
                              <div className={`text-sm ${user.can_view_fuel_transactions ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_view_fuel_transactions ? '✓' : '✗'} Can View Fuel Transactions
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 italic">Note: Fuel transactions are created only by drivers via the mobile app and cannot be edited or deleted by anyone to maintain data integrity</p>
                          </div>

                          <div className="border border-gray-200 rounded-lg p-3">
                            <h5 className="text-sm font-semibold text-gray-800 mb-2">Reports & Data</h5>
                            <div className="grid md:grid-cols-2 gap-2">
                              <div className={`text-sm ${user.can_view_reports ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_view_reports ? '✓' : '✗'} Can View Reports
                              </div>
                              <div className={`text-sm ${user.can_create_reports ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_create_reports ? '✓' : '✗'} Can Create Reports
                              </div>
                              <div className={`text-sm ${user.can_view_custom_reports ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_view_custom_reports ? '✓' : '✗'} Can View Custom Reports
                              </div>
                              <div className={`text-sm ${user.can_view_financial_data ? 'text-green-600' : 'text-gray-400'}`}>
                                {user.can_view_financial_data ? '✓' : '✗'} Can View Financial Data
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
            ))}
                  {showSyntheticBilling && mainUser && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                      <div className="w-full px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300 rounded">Billing User</span>
                          <span className="text-sm font-medium text-gray-900">{mainUser.first_name} {mainUser.surname}</span>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Same as Main User</span>
                          <span className="text-xs text-gray-500">{mainUser.email}</span>
                        </div>
                        <button
                          onClick={() => handleEditUser(mainUser)}
                          className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ml-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="text-sm">Edit</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
        </div>
      )}

      {showDemoteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Remove Secondary Main User Status</h3>
              <button
                onClick={() => {
                  setShowDemoteDialog(false);
                  setDemotingUserId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Please specify the new role and permissions for this user.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Title <span className="text-red-500">*</span>
                </label>
                <select
                  value={demoteForm.title}
                  onChange={(e) => setDemoteForm({ ...demoteForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="User">User</option>
                  <option value="Secondary Main User">Secondary Main User</option>
                  <option value="Billing User">Billing User</option>
                  <option value="Vehicle User">Vehicle User</option>
                  <option value="Driver User">Driver User</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_add_vehicles}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_add_vehicles: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Add Vehicles</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_edit_vehicles}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_edit_vehicles: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Edit Vehicles</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_delete_vehicles}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_delete_vehicles: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Delete Vehicles</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_add_drivers}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_add_drivers: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Add Drivers</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_edit_drivers}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_edit_drivers: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Edit Drivers</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_delete_drivers}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_delete_drivers: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Delete Drivers</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_view_reports}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_view_reports: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">View Reports</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_create_reports}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_create_reports: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Create Reports</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_view_custom_reports}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_view_custom_reports: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">View Custom Reports</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_view_fuel_transactions}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_view_fuel_transactions: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">View Fuel Transactions</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_edit_organization_info}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_edit_organization_info: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Edit Organization Info</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_manage_users}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_manage_users: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Manage Users</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={demoteForm.can_view_financial_data}
                      onChange={(e) => setDemoteForm({ ...demoteForm, can_view_financial_data: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">View Financial Data</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDemoteDialog(false);
                  setDemotingUserId(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDemoteSecondaryMainUser}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Remove Secondary Main User Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
