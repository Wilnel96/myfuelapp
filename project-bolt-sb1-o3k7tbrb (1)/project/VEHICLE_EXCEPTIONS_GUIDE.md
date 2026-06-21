# Vehicle Exception Report Guide

## Overview
The Vehicle Exception Report tracks anomalies and suspicious patterns in vehicle usage. Exceptions are automatically created when certain conditions are met during vehicle draw, return, or fuel purchase operations.

## Exception Types

### 1. Odometer Mismatch (`odometer_mismatch`)
**When Created:** During vehicle draw
**Trigger Condition:** When the entered odometer reading differs by more than 5 km from the last recorded return odometer
**User Action Required:** Driver must confirm the odometer reading and click "Confirm & Log Exception"
**Example:** Last return was at 5,450 km, but driver enters 5,550 km when drawing (100 km difference)

### 2. Excessive KM in Short Time (`excessive_km_short_time`)
**When Created:** During vehicle return
**Trigger Condition:** Vehicle driven more than 500 km in less than 1 hour
**Automatic:** Yes, no user confirmation needed
**Example:** Draw at 10,000 km, return at 10,700 km after 45 minutes

### 3. Minimal KM in Long Time (`minimal_km_long_time`)
**When Created:** During vehicle return
**Trigger Condition:** Vehicle driven less than 5 km over more than 8 hours
**Automatic:** Yes, no user confirmation needed
**Example:** Draw at 5,000 km, return at 5,003 km after 10 hours

### 4. No KM Driven (`no_km_driven`)
**When Created:** During vehicle return
**Trigger Condition:** Odometer unchanged (0 km driven) for more than 1 hour
**Automatic:** Yes, no user confirmation needed
**Example:** Draw at 8,500 km, return at 8,500 km after 3 hours

### 5. Excessive KM Extended Period (`excessive_km_extended_period`)
**When Created:** During vehicle return
**Trigger Condition:** Vehicle driven more than 1,000 km over more than 24 hours
**Automatic:** Yes, no user confirmation needed
**Example:** Draw at 3,000 km, return at 4,500 km after 2 days

### 6. Garage Location Mismatch (`garage_location_mismatch`)
**When Created:** During fuel purchase
**Trigger Condition:** Driver refuels at a garage in a different city than the organization's base city
**Automatic:** Yes, created by the backend system
**Example:** Organization based in Robertson, but driver refuels at garage in Ashton

### 7. GPS Location Mismatch (`gps_location_mismatch`)
**When Created:** During fuel purchase
**Trigger Condition:** Driver's GPS location is more than 0.5 km (500 meters) away from the selected garage's coordinates
**Automatic:** Yes, created automatically by the backend system
**Example:** Driver selects a garage but their GPS shows they are 2.5 km away
**Display Format:** Distance is shown in kilometers (e.g., "2.50 km" instead of "2500m")

## Viewing Exceptions

1. Navigate to **Reports Dashboard**
2. Select **Vehicle Exception Report**
3. Choose date range
4. Click **Generate Report**
5. View all exceptions with:
   - Exception type
   - Description
   - Expected vs Actual values
   - Resolution status

## Resolving Exceptions

Each exception can be resolved by:
1. Clicking "Resolve" on the exception card
2. Entering resolution notes
3. Clicking "Mark as Resolved"

Resolution notes should explain:
- Why the exception occurred
- What action was taken
- Whether any disciplinary action is needed

## Testing Exception Creation

To verify exceptions are being created:

### Test Odometer Mismatch:
1. Draw a vehicle (e.g., at 10,000 km)
2. Return the vehicle (e.g., at 10,100 km)
3. Draw the same vehicle again
4. Enter odometer reading with >5 km difference (e.g., 10,250 km instead of 10,100 km)
5. Confirm the mismatch warning
6. Check Vehicle Exception Report

### Test Return Exceptions:
1. Draw a vehicle and note the odometer (e.g., 5,000 km)
2. Wait at least 1 hour without moving the vehicle
3. Return the vehicle with the same odometer (5,000 km)
4. Check Vehicle Exception Report for "No KM Driven" exception

## Historical Data Note

**Important:** Exceptions are only created for NEW transactions after the system fixes were applied (December 28, 2024). Historical transactions that should have created exceptions will NOT appear in the report.

If you need to review historical anomalies:
1. Run custom queries on the `vehicle_transactions` table
2. Look for patterns manually in the Vehicle Reports
3. Contact support for historical data analysis

## Database Security

All exceptions are protected by Row Level Security (RLS):
- Drivers can only view their own exceptions
- Organization users can view all exceptions for their organization
- Super admins can view all exceptions across all organizations
- Anonymous users (driver PIN auth) can create exceptions but cannot read them
