import { supabase } from './supabase';
import { cache } from './cache';

interface CachedQueryOptions {
  ttl?: number;
  forceRefresh?: boolean;
}

export async function getCachedOrganizations(userId: string, options: CachedQueryOptions = {}) {
  const cacheKey = `organizations:${userId}`;

  if (!options.forceRefresh && cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(is_management_org, organization_type)')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return null;

  let organizations = [];

  // Check if user is in a management organization
  const isManagementUser = profile.organizations &&
    typeof profile.organizations === 'object' &&
    'is_management_org' in profile.organizations &&
    (profile.organizations as any).is_management_org === true;

  if (isManagementUser) {
    // Management users see ALL client organizations (no parent_org_id link needed)
    const { data } = await supabase
      .from('organizations')
      .select('id, name, is_management_org, organization_type')
      .eq('organization_type', 'client')
      .order('name');

    organizations = data || [];
  } else {
    // Client users only see their own organization
    const { data: ownOrg } = await supabase
      .from('organizations')
      .select('id, name, is_management_org, organization_type')
      .eq('id', profile.organization_id)
      .maybeSingle();

    organizations = ownOrg ? [ownOrg] : [];
  }

  cache.set(cacheKey, organizations, options.ttl || 10 * 60 * 1000);
  return organizations;
}

export async function getCachedGarages(options: CachedQueryOptions = {}) {
  const cacheKey = 'garages:active';

  if (!options.forceRefresh && cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const { data } = await supabase
    .from('garages')
    .select('*')
    .order('name');

  cache.set(cacheKey, data || [], options.ttl || 15 * 60 * 1000);
  return data || [];
}

export async function getCachedVehicle(vehicleId: string, options: CachedQueryOptions = {}) {
  const cacheKey = `vehicle:${vehicleId}`;

  if (!options.forceRefresh && cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const { data } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .maybeSingle();

  if (data) {
    cache.set(cacheKey, data, options.ttl || 5 * 60 * 1000);
  }

  return data;
}

export async function getCachedDriver(driverId: string, options: CachedQueryOptions = {}) {
  const cacheKey = `driver:${driverId}`;

  if (!options.forceRefresh && cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const { data } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .maybeSingle();

  if (data) {
    cache.set(cacheKey, data, options.ttl || 5 * 60 * 1000);
  }

  return data;
}

export function invalidateVehicleCache(vehicleId?: string) {
  if (vehicleId) {
    cache.invalidate(`vehicle:${vehicleId}`);
  }
  cache.invalidatePattern('^vehicles:');
}

export function invalidateDriverCache(driverId?: string) {
  if (driverId) {
    cache.invalidate(`driver:${driverId}`);
  }
  cache.invalidatePattern('^drivers:');
}

export function invalidateOrganizationCache(userId?: string) {
  if (userId) {
    cache.invalidate(`organizations:${userId}`);
  }
  cache.invalidatePattern('^organizations:');
}

export function invalidateGarageCache() {
  cache.invalidatePattern('^garages:');
}
