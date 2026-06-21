# Client Self-Signup Guide

## Overview

The FleetFuel system now supports self-service signup for new client organizations. This allows businesses to create their own accounts without requiring manual setup by the management company.

## How It Works

### User Journey

1. **Select Client Portal** - User clicks "Client Portal" on the main login screen
2. **Choose Portal Type** - User selects either:
   - **MyFuel Card** - For card-based payments
   - **MyFuel Accounts** - For local garage accounts
3. **Login or Signup** - User sees login screen with "Create New Organization" button
4. **Organization Information** - User completes a 2-step signup process:
   - Step 1: Organization details
   - Step 2: User account creation
5. **Account Created** - User is automatically logged in and can start using the system

## Signup Form Fields

### Step 1: Organization Information

**Required Fields:**
- Organization Name
- Organization Email

**Optional Fields:**
- Registration Number
- VAT Number
- Phone Number
- Address Line 1
- Address Line 2
- City
- Province
- Postal Code

### Step 2: User Account

**Required Fields:**
- First Name
- Last Name
- Email Address
- Password (minimum 8 characters)
- Confirm Password

**Optional Fields:**
- Mobile Phone

## What Happens During Signup

### 1. User Account Creation
- A new authentication account is created in Supabase Auth
- User metadata includes first name and last name
- Password must be at least 8 characters

### 2. Organization Creation
- A new organization is created with:
  - `is_management_org: false`
  - `organization_type: 'client'`
  - `payment_option: 'Card Payment'` or `'Local Account'` based on portal type
  - All provided organization details

### 3. Profile Setup
- User's profile is updated with:
  - `organization_id` linked to new organization
  - `role: 'admin'`

### 4. Organization User Record
- An organization_users record is created with:
  - Main User status (`is_main_user: true`)
  - Full permissions enabled:
    - Can manage vehicles
    - Can manage drivers
    - Can view reports
    - Can manage fuel cards
    - Can approve transactions
    - Can manage garages
    - Can view invoices
    - Can manage users

## Security Implementation

### Database RLS Policies

**Organizations Table:**
```sql
-- Users can create client organizations during signup
WITH CHECK (
  is_management_org = false
  AND organization_type = 'client'
)
```

**Profiles Table:**
```sql
-- Users can update their own profile
USING (id = auth.uid())
WITH CHECK (id = auth.uid())
```

**Organization Users Table:**
```sql
-- Users can add themselves during signup
WITH CHECK (user_id = auth.uid())
```

### Key Security Features

1. **Self-signup restricted to client organizations only**
   - Users cannot create management organizations
   - Organization type must be 'client'

2. **Users can only modify their own data**
   - Profile updates restricted to authenticated user's own record
   - Cannot modify other users' profiles

3. **Main user automatically granted**
   - First user becomes Main User with full permissions
   - Can later add additional users through the system

4. **Email verification optional**
   - Email confirmation is disabled by default
   - Can be enabled in Supabase Auth settings if needed

## Benefits

### For Clients

1. **Instant Access**
   - No waiting for admin approval
   - Start using the system immediately
   - Full control from day one

2. **Self-Service**
   - Complete setup at their own pace
   - No need to coordinate with management company
   - Can start adding vehicles and drivers right away

3. **Accurate Information**
   - Clients enter their own details
   - Reduces data entry errors
   - Ensures information is current

### For Management Company

1. **Reduced Admin Work**
   - No manual organization creation
   - No user account setup required
   - Less support overhead

2. **Faster Onboarding**
   - Clients can start immediately
   - No bottleneck waiting for admin setup
   - Scales better with growth

3. **Data Quality**
   - Clients responsible for their own data
   - More accurate contact information
   - Better engagement from start

## Post-Signup Experience

### For MyFuel Card Users

After signup, users can:
- Add vehicles to their fleet
- Add drivers and assign cards
- Browse garage directory
- Set up payment cards with PINs
- View real-time transactions
- Access reports and invoices

### For MyFuel Accounts Users

After signup, users can:
- Add vehicles to their fleet
- Add drivers
- Request local accounts with specific garages
- Set account spending limits
- View transactions by garage
- Access reports and invoices

## Portal Type Determination

The portal type selected during signup determines:

1. **Payment Option**
   - MyFuel Card → `'Card Payment'`
   - MyFuel Accounts → `'Local Account'`

2. **Dashboard Experience**
   - Card users see card-specific features
   - Account users see garage account management

3. **Garage Interaction**
   - Card users browse all garages
   - Account users manage specific garage relationships

## Validation Rules

### Organization Fields
- Name: Required, free text
- Email: Required, must be valid email format
- Registration Number: Optional, free text
- VAT Number: Optional, free text
- Province: Optional, must be valid South African province

### User Fields
- Email: Required, must be valid email format, unique in system
- Password: Required, minimum 8 characters
- Passwords must match
- First Name & Last Name: Required

## Error Handling

Common signup errors and solutions:

1. **"Email already exists"**
   - Email is already registered in the system
   - User should use login instead
   - Can reset password if forgotten

2. **"Passwords do not match"**
   - Confirm password must exactly match password
   - Re-enter both fields carefully

3. **"Password must be at least 8 characters"**
   - Choose a longer password
   - Mix letters, numbers, and symbols for security

4. **"Failed to create organization"**
   - Database error occurred
   - Check all required fields are filled
   - Try again or contact support

## Integration with Existing System

### Database Structure
- Uses existing tables (organizations, profiles, organization_users)
- No new tables created
- Fully compatible with admin-created organizations

### Super Admin Access
- Management company retains full visibility
- Can view all self-registered organizations
- Can modify or delete if needed
- Same reporting and analytics

### Migration Path
- Existing organizations unaffected
- Can have mix of admin-created and self-registered organizations
- All organizations have same capabilities

## Future Enhancements

Potential improvements:
1. Email verification before full access
2. Organization approval workflow (optional)
3. Payment setup during signup
4. Initial vehicle/driver import
5. Welcome emails and onboarding flows
6. Trial periods or demo accounts
7. Referral codes or partner links
8. Multi-step validation process
