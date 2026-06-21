# Garage Security Fixes

## Overview
This document details the security vulnerabilities that were identified and fixed in the garage authentication and authorization system.

## Security Vulnerabilities Found

### 1. Garage Local Accounts - Unauthorized Access
**Problem:**
- ANY garage could view and modify ANY other garage's local client accounts
- The RLS policy used `USING (true)` which allowed access to all rows
- No validation of which garage owned the account being modified
- Garage A could activate/deactivate clients for Garage B

**Impact:**
- Complete breach of garage isolation
- Potential for malicious garages to sabotage competitors
- Privacy violation (garages could see other garages' client lists)

**Fix:**
- Created secure Edge Function: `garage-local-accounts`
- Edge Function validates garage credentials (email/password) before any operation
- Edge Function verifies ownership: garage can only modify their own accounts
- Removed all anonymous RLS policies for `organization_garage_accounts`
- All garage operations now go through the Edge Function which uses service role

### 2. Garage Information - Unauthorized Updates
**Problem:**
- The `garages_update_anonymous` RLS policy allowed ANY anonymous user to update ANY active garage
- No validation of which garage was making the update
- Garage A could modify Garage B's fuel prices, contact information, etc.

**Impact:**
- Garages could manipulate competitors' fuel prices
- Could change contact information to hijack customer communications
- Could modify bank details for payments

**Fix:**
- Created secure Edge Function: `garage-update`
- Edge Function validates garage credentials before updates
- Edge Function enforces: garage can only update their own data
- Removed the `garages_update_anonymous` RLS policy
- All garage self-updates now go through the Edge Function

## Architecture Changes

### Before (Insecure)
```
Garage Frontend → Anonymous Supabase Connection → Direct Database Access
RLS: USING (true) - allowed all access
```

### After (Secure)
```
Garage Frontend → Edge Function (validates credentials) → Service Role → Database
RLS: Blocks all anonymous access, forces use of Edge Function
```

## Edge Functions Created

### 1. `garage-local-accounts`
**Purpose:** Secure CRUD operations for garage local client accounts

**Operations:**
- `list`: Get all local accounts for the authenticated garage
- `create`: Add a new local client account
- `update`: Modify an existing local account (with ownership verification)

**Security:**
- Validates garage email/password on every request
- Verifies garage ownership before any modification
- Uses service role key to bypass RLS
- Returns 401 for invalid credentials
- Returns 403 if trying to modify another garage's accounts

### 2. `garage-update`
**Purpose:** Secure garage self-updates

**Operations:**
- Update garage fuel types, prices, contact persons, and other offerings

**Security:**
- Validates garage email/password
- Enforces garage can only update their own data
- Returns 401 for invalid credentials
- Returns 403 if trying to update another garage

## Database Changes

### RLS Policies Removed
**organization_garage_accounts:**
- `Anonymous users can view garage accounts`
- `Garages can insert local client accounts`
- `Garages can update local client accounts`
- `Drivers can view active garage accounts for validation`

**garages:**
- `garages_update_anonymous`

### RLS Policies Kept
**organization_garage_accounts:**
- `Organization users can view their garage accounts` (authenticated)
- `Organization users can insert their garage accounts` (authenticated)
- `Organization users can update their garage accounts` (authenticated)
- `Super admin full access to org garage accounts` (authenticated)

**garages:**
- `Anonymous users can view garages` (SELECT only - needed for drivers)
- `garages_select_by_org` (authenticated admins)
- `garages_insert_policy` (authenticated admins)
- `garages_update_policy` (authenticated admins)
- `Service role can insert garages` (service role)

## Frontend Changes

### Component Updates
1. **GarageAuth.tsx**
   - Now passes email and password to the parent component
   - Changed signature: `onLogin(id, name, email, password)`

2. **App.tsx**
   - Stores garage credentials in state
   - Passes credentials to GaragePortal

3. **GaragePortal.tsx**
   - Receives and stores garage credentials
   - Uses Edge Function for updates instead of direct database access
   - Passes credentials to GarageLocalAccounts

4. **GarageLocalAccounts.tsx**
   - Receives garage credentials as props
   - All operations (list, create, update) now use the Edge Function
   - Removed direct Supabase queries

## Security Model

### Garage Authentication Flow
1. Garage logs in with email/password
2. Credentials validated against `garages.contact_persons`
3. Credentials stored in frontend state (session-based, not persisted)
4. Every API call to Edge Functions includes credentials
5. Edge Functions re-validate credentials on every request
6. Edge Functions enforce ownership and permissions

### Why This Approach?
- Garages don't have traditional user accounts (no `auth.users` entry)
- Garages authenticate via contact person credentials in `garages.contact_persons`
- Edge Functions bridge the gap between credential validation and secure operations
- Service role key allows Edge Functions to perform operations after validation
- RLS blocks direct anonymous access, forcing use of secure Edge Functions

## Testing Recommendations

1. **Test Garage Isolation:**
   - Log in as Garage A
   - Attempt to view/modify accounts - should only see Garage A's accounts
   - Log in as Garage B
   - Verify you only see Garage B's accounts

2. **Test Direct Database Access:**
   - Attempt to query `organization_garage_accounts` as anonymous user
   - Should be blocked by RLS

3. **Test Invalid Credentials:**
   - Use incorrect email/password in API calls
   - Should receive 401 Unauthorized

4. **Test Cross-Garage Modification:**
   - Try to modify another garage's account via API
   - Should receive 403 Forbidden

## Migration Files Created

1. `fix_garage_local_accounts_update_access.sql` - Initial fix attempt (replaced by next migration)
2. `restrict_garage_accounts_rls_policies.sql` - Locked down organization_garage_accounts policies
3. `restrict_garages_rls_policies.sql` - Locked down garages policies

## Summary

These changes transform the garage authentication system from a fundamentally insecure model (any garage can modify any data) to a properly secured model where:
- Garages can only view and modify their own data
- All operations are authenticated and authorized
- RLS enforces security at the database level
- Edge Functions provide secure business logic layer
- Credentials are validated on every request

This is a **critical security fix** that closes major vulnerabilities in the garage portal system.
