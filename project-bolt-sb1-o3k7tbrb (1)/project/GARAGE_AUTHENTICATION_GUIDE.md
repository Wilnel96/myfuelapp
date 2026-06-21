# Garage Authentication Security Upgrade

## Overview

The garage authentication system has been upgraded from an insecure anonymous authentication method to a secure Supabase-based authentication system. This upgrade protects high-value local accounts by ensuring all garage access is properly authenticated and auditable.

## What Changed

### Before (Insecure)
- Garages logged in anonymously using email/password stored in plain text in the `contact_persons` JSONB field
- No proper authentication mechanism
- No audit trail of who accessed what
- Passwords visible in database
- Anonymous users had broad access

### After (Secure)
- Garages log in using Supabase authentication (email/password)
- Passwords securely hashed by Supabase
- Each garage contact person has their own authenticated user account
- Full audit trail through auth.users table
- Proper Row Level Security (RLS) policies restrict access
- Users linked to garages through `organization_users` table

## New System Architecture

### Database Structure

1. **Garages Table**
   - Each garage now has an `organization_id` linking it to an organization
   - Contact persons stored without passwords (passwords managed by Supabase)

2. **Organizations Table**
   - Created automatically when garage signs up
   - Links garage to its users

3. **Organization Users Table**
   - Links authenticated users to their garage organization
   - Role: `garage_user`
   - Permissions: Full access to manage their garage

4. **Profiles Table**
   - Contains user metadata
   - Role set to `garage_user` for garage users

### Authentication Flow

#### Garage Signup
1. Garage fills out registration form (3 steps: garage info, contact person, banking)
2. System calls `public_garage_signup()` function which:
   - Creates organization for the garage
   - Creates garage record with `pending` status
   - Returns organization_id and contact details
3. Frontend creates Supabase auth user with email/password
4. System calls `link_garage_user_to_organization()` to:
   - Create `organization_users` record linking user to garage
   - Create `profiles` record for the user
5. Admin must approve garage (change status from `pending` to `active`)

#### Garage Login
1. User enters email and password
2. System authenticates using `supabase.auth.signInWithPassword()`
3. Supabase verifies credentials and returns user session
4. System queries `organization_users` to find user's garage
5. Checks garage status is `active`
6. If approved, user gains access to Garage Portal

### Row Level Security (RLS) Policies

All database tables now have proper RLS policies for garage users:

1. **Garages** - Can view and update their own garage
2. **Garage Statements** - Can view statements for their garage
3. **Garage Client Payments** - Can insert and view payments for their garage
4. **Fuel Transaction Invoices** - Can view invoices for transactions at their garage
5. **Organization Garage Accounts** - Can view and update local accounts at their garage
6. **Organizations** - Can view client organizations with accounts at their garage
7. **Organization Users** - Can view client organization users

All policies verify:
- User is authenticated
- User has `garage_user` role
- User is linked to the garage through `organization_users`
- User is active

## Security Benefits

1. **Password Security**
   - Passwords hashed using bcrypt (Supabase default)
   - Never stored in plain text
   - Never exposed in queries or logs

2. **Access Control**
   - Each garage user can only access their own garage data
   - Cannot access other garages' data
   - Cannot access client organization data except through their garage

3. **Audit Trail**
   - All logins tracked in `auth.users` table
   - Can see last_sign_in_at, created_at, etc.
   - Can track who made what changes

4. **Account Protection**
   - Local accounts (high-value) protected by authentication
   - Only authenticated garage users can capture payments
   - All payment actions attributable to specific users

## Migration Path for Existing Garages

Existing garages with passwords in `contact_persons` need to be migrated:

### Option 1: Force Password Reset
1. Clear the `password` field from `contact_persons`
2. Send password reset email to garage contacts
3. They create new authenticated accounts

### Option 2: Admin-Assisted Migration
1. Admin creates authenticated user for each garage contact
2. Sends temporary password to garage
3. Garage logs in and changes password

### Option 3: Self-Service Migration
1. Create migration function that:
   - Reads email from `contact_persons`
   - Creates auth user with temporary password
   - Emails temporary password to garage
   - Removes password from `contact_persons`

## Implementation Files

### Database Migrations
- `add_garage_authenticated_users.sql` - Core authentication functions
- `update_garage_signup_with_authentication.sql` - Updated signup process
- `add_garage_user_rls_policies_v2.sql` - RLS policies for garage users

### Frontend Components
- `src/components/GarageSignup.tsx` - Creates authenticated users on signup
- `src/components/GarageAuth.tsx` - Uses Supabase authentication for login

### Backend Functions
- `public_garage_signup()` - Creates garage and organization
- `link_garage_user_to_organization()` - Links auth user to garage
- `create_garage_user()` - Helper function for creating garage users

## Testing the New System

### Test New Garage Signup
1. Go to Garage Portal
2. Click "Sign Up"
3. Fill out all 3 steps
4. Submit registration
5. Check database:
   - Garage created with `pending` status
   - Organization created
   - Auth user created in `auth.users`
   - Organization user created
   - Profile created

### Test Garage Login
1. Admin approves garage (set status to `active`)
2. Go to Garage Portal login
3. Enter email and password from signup
4. Should successfully log in and see garage dashboard
5. Verify can capture payments, view statements, etc.

### Verify Security
1. Try to access another garage's data (should be blocked by RLS)
2. Try to login with wrong password (should fail)
3. Check that passwords are not visible in database
4. Verify audit trail in `auth.users` table

## Important Notes

1. **Email Confirmation**: Currently disabled. If you enable it, users must verify email before logging in.

2. **Password Requirements**: Supabase default is 6 characters minimum. Consider increasing for production.

3. **Garage Approval**: New garages start with `pending` status. Admin must approve (set to `active`) before they can log in.

4. **Local Accounts**: High-value local accounts are now properly protected. Only authenticated garage users can:
   - View local accounts at their garage
   - Update account limits
   - Capture payments against accounts

5. **Backward Compatibility**: The old anonymous authentication is REMOVED. All garages must use authenticated login.

## Next Steps

1. Migrate existing garages to authenticated users
2. Remove plain text passwords from existing `contact_persons` records
3. Consider implementing:
   - Password reset flow
   - Multi-factor authentication (MFA)
   - Session timeout policies
   - IP whitelisting for garages
   - Email notifications for login attempts
