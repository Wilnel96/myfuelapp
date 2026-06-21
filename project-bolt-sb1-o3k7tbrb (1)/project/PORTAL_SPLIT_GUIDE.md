# MyFuel Portal Split Guide

## Overview

The FleetFuel Management System has been successfully split into two distinct client portals while maintaining a unified database and driver mobile application. This separation allows the system to serve two different markets with tailored user experiences.

## Two Portal Systems

### 1. MyFuel Card (Card-Based Payments)
**Target Market:** Individuals and fleets who want to use credit/debit cards for fuel purchases

**Key Features:**
- Card-based payment system
- Real-time transaction tracking
- Payment card management with PIN protection
- Spending controls and limits
- Individual fuel invoices for card transactions

**Color Theme:** Blue

**Access Flow:**
1. User selects "Client Portal" from main login screen
2. User chooses "MyFuel Card" portal
3. User logs in with email and password
4. Dashboard shows card-specific options

### 2. MyFuel Accounts (Local Garage Accounts)
**Target Market:** Fleet operators and garage local account holders who want enhanced security through local garage accounts

**Key Features:**
- Local garage account management
- Account spending limits per garage
- Monthly account statements
- Garage-specific payment terms
- Enhanced security for both garage and customer

**Color Theme:** Amber/Orange

**Access Flow:**
1. User selects "Client Portal" from main login screen
2. User chooses "MyFuel Accounts" portal
3. User logs in with email and password
4. Dashboard shows account-specific options

## Unified Components

### Shared Across Both Portals
- **Driver Mobile App** - Same for all drivers regardless of organization's payment method
- **Vehicle Management** - Identical functionality
- **Driver Management** - Identical functionality
- **Reports** - Same reporting capabilities
- **Invoices** - Both fee and fuel invoices accessible
- **Back Office** - Organization settings and configurations
- **Garage Network** - All garages available to both systems

### Portal-Specific Differences

#### MyFuel Card Portal
- **Garages View:** Browse and search garage directory
- **Back Office:** Includes payment card management section
- **Focus:** Card payment settings, PIN management, card spending limits

#### MyFuel Accounts Portal
- **Garages View:** Manage local accounts with specific garages
- **Back Office:** Includes local account management
- **Focus:** Account limits, garage relationships, monthly settlements

## Technical Implementation

### New Components Created

1. **ClientPortalSelection.tsx**
   - Portal selection screen after choosing "Client Portal"
   - Presents both MyFuel Card and MyFuel Accounts options
   - Visual distinction with color-coded cards

2. **ClientCardDashboard.tsx**
   - Dashboard for card-based payment portal
   - Blue theme with card icons
   - Card-specific menu descriptions

3. **ClientAccountDashboard.tsx**
   - Dashboard for local account portal
   - Amber theme with building icons
   - Account-specific menu descriptions

### Modified Components

1. **App.tsx**
   - Added `clientPortalType` state to track which portal user selected
   - Added `showPortalSelection` state for portal selection flow
   - Conditional rendering based on portal type
   - Garage view switches between directory and accounts based on portal

2. **Routing Logic**
   - Portal selection appears after user chooses "Client Portal"
   - Authentication happens after portal selection
   - Portal type maintained throughout session
   - Sign out resets portal selection

## User Experience Flow

### For Card Payment Users
```
Main Login Screen
    ↓
Select "Client Portal"
    ↓
Choose "MyFuel Card"
    ↓
Login with Email/Password
    ↓
MyFuel Card Dashboard (Blue Theme)
    ↓
Access Vehicles, Drivers, Garage Directory, Payment Cards, Reports, Invoices
```

### For Local Account Users
```
Main Login Screen
    ↓
Select "Client Portal"
    ↓
Choose "MyFuel Accounts"
    ↓
Login with Email/Password
    ↓
MyFuel Accounts Dashboard (Amber Theme)
    ↓
Access Vehicles, Drivers, Garage Accounts, Reports, Invoices
```

### For Drivers (Unchanged)
```
Main Login Screen
    ↓
Select "Driver Login"
    ↓
Login with First Name & Date of Birth
    ↓
Driver Mobile App
    ↓
Access assigned vehicles, fuel purchases, trips
```

## Database Considerations

### Unchanged
- Single unified database schema
- All organizations stored in same tables
- `payment_option` field continues to track payment method:
  - 'Card Payment'
  - 'Local Account'
  - 'EFT Payment' (for direct transfers)

### Benefits of Unified Database
- All garages available to both systems
- Shared reporting and analytics
- Consolidated management company view
- Easy switching between payment methods if needed
- Single source of truth for all transactions

## Management Company View

The Super Admin (Management Company) portal remains unchanged:
- Can view and manage ALL organizations regardless of payment method
- Full access to all garages, vehicles, drivers
- Consolidated reporting across all portals
- Invoice management for all organizations
- System-wide settings and configurations

## Benefits of Split Portal Approach

1. **Market Clarity**
   - Clear differentiation between two service offerings
   - Tailored messaging for each market segment
   - Reduced confusion for end users

2. **User Experience**
   - Focused interfaces for specific use cases
   - Only relevant options shown to each user type
   - Simplified navigation within each portal

3. **Marketing**
   - Two distinct product brands (MyFuel Card vs MyFuel Accounts)
   - Easier to explain value proposition to each market
   - Potential for different pricing strategies

4. **Future Flexibility**
   - Easy to add portal-specific features
   - Can evolve each portal independently
   - Maintains ability to add more portal types

5. **Operational Efficiency**
   - Drivers don't need to know which portal their org uses
   - Garages accessible to both systems
   - Single management interface for operations team

## Migration Path

For existing users:
- No database migration required
- Users will see portal selection on next login
- Can choose appropriate portal based on their organization's payment method
- All existing data remains accessible

## Future Enhancements

Potential improvements:
1. Auto-detect payment method and skip portal selection
2. Allow users to access both portals if organization has both payment methods
3. Add third portal for EFT-only organizations
4. Portal-specific onboarding flows
5. Customized help documentation per portal
