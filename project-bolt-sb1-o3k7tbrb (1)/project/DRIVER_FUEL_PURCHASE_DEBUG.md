# Driver Fuel Purchase Transaction - Debug Guide

## Issue: Transaction Logs Out Driver Instead of Proceeding to PIN Entry

### What Should Happen

When a driver completes a fuel purchase:

1. **EFT Payment Organizations:**
   - Click "Complete Fuel Purchase" → Transaction recorded → Success screen

2. **Local Account Organizations:**
   - Click "Complete Fuel Purchase" → Transaction recorded → PIN Entry screen → Scan to Till screen → Success

### Common Issues & Solutions

#### Issue 1: Driver Session Expired

**Symptoms:**
- Button turns green then logs out
- Message: "Your session has expired. Redirecting to login..."
- Transaction NOT recorded

**Solution:**
- Driver needs to log in again
- Sessions expire after 8 hours of inactivity
- Each transaction extends the session by 8 hours

**Debug Steps:**
1. Open browser console (F12)
2. Look for: `[FuelPurchase] Session expired, logging out driver`
3. Check localStorage for `driverToken`

#### Issue 2: Vehicle Not Drawn

**Symptoms:**
- Error: "You must draw this vehicle before you can refuel it"
- Transaction fails

**Solution:**
- Ensure vehicle is properly drawn before attempting fuel purchase
- Admin should verify vehicle_transactions table has an active draw record

#### Issue 3: Garage Account Not Set Up (Local Account Organizations)

**Symptoms:**
- Error: "Your organization does not have an account with this garage"
- Transaction fails

**Solution:**
- Admin must set up garage account in "Organization Info" → "Garage Accounts"
- Each garage must have an active account with an account number

#### Issue 4: Tank Capacity Exceeded

**Symptoms:**
- Error: "Refuel amount (XXL) exceeds vehicle tank capacity (YYL + 2L buffer = ZZL)"
- Transaction fails

**Solution:**
- Driver entered too many liters
- System allows tank capacity + 2L buffer
- Reduce liters to within the limit

#### Issue 5: Spending Limit Reached

**Symptoms:**
- Error: "Daily/Monthly spending limit has been reached"
- Transaction blocked before submission

**Solution:**
- Organization's daily or monthly limit is exhausted
- Admin must increase limit or wait for reset
- Daily limits reset at midnight
- Monthly limits reset on 1st of each month

## Debug Checklist

When a fuel purchase fails, check browser console for these logs:

```
[FuelPurchase] Starting transaction submission...
[FuelPurchase] Calling edge function to create transaction...
[FuelPurchase] Response status: XXX
[FuelPurchase] Response data: {...}
```

### Response Status Codes

- **200**: Success - transaction recorded
- **401**: Unauthorized - session expired or invalid
- **403**: Forbidden - permission issue (vehicle not drawn, account inactive, etc.)
- **404**: Not Found - vehicle or driver not found
- **500**: Server Error - database or system issue

### Response Error Messages

**Session Issues:**
- "Driver token required" → No token in localStorage
- "Invalid or expired session" → Session not found in database
- "Session expired" → Session past expiration time

**Authorization Issues:**
- "Driver account is not active" → Driver status is not 'active'
- "Vehicle does not belong to driver's organization" → Cross-organization access attempt
- "You must draw this vehicle before you can refuel it" → Vehicle not drawn

**Business Rule Issues:**
- "Refuel amount ... exceeds vehicle tank capacity" → Liters too high
- "Your organization does not have an account with this garage" → No garage account set up
- "Your organization's account with this garage is currently inactive" → Garage account disabled

## Testing the Fix

### Test 1: Normal EFT Flow
1. Log in as driver (WILLEM, 1956-08-22)
2. Select garage
3. Confirm location
4. Enter fuel details
5. Click "Complete Fuel Purchase"
6. Should see success screen (NOT logout)

### Test 2: Local Account Flow
1. Log in as driver from organization with Local Account payment
2. Select garage (must have account set up)
3. Confirm location
4. Enter fuel details
5. Click "Complete Fuel Purchase"
6. Should see PIN entry screen (NOT logout)
7. Enter PIN
8. Should see "Scan to Till" screen
9. Click "Authorized"
10. Should see success screen

### Test 3: Session Expiration (Intentional)
1. Log in as driver
2. Wait for session to expire (or manually delete from database)
3. Try to complete fuel purchase
4. Should see "Session expired" error and logout (EXPECTED)

## Recent Changes (2024-12-31)

### Fixed Issues

1. **Overly Aggressive Error Handling**
   - Previous code logged out driver on ANY error containing "expired" or "session"
   - Now only logs out on specific session expiration errors
   - Other errors display properly without logout

2. **Improved Error Logging**
   - Added comprehensive console logging for debugging
   - Track transaction flow from start to finish
   - Log all response statuses and error messages

3. **Better Error Messages**
   - Specific error messages for each failure type
   - Clear instructions on how to resolve
   - No more generic "Failed to create transaction"

### Files Modified

- `/src/components/DriverMobileFuelPurchase.tsx`
  - Lines 640-672: Fixed session error detection
  - Lines 575-716: Added comprehensive logging
  - Lines 703-715: Better success/error flow

## Database Verification

To verify a transaction was recorded:

```sql
-- Check recent fuel transactions
SELECT
  id,
  vehicle_id,
  driver_id,
  garage_id,
  liters,
  total_amount,
  authorized_at,
  created_at
FROM fuel_transactions
ORDER BY created_at DESC
LIMIT 10;

-- Check driver session status
SELECT
  driver_id,
  token,
  expires_at,
  created_at
FROM driver_sessions
WHERE driver_id = 'DRIVER_ID_HERE'
ORDER BY created_at DESC
LIMIT 1;

-- Check if vehicle is drawn
SELECT
  vt.id,
  vt.vehicle_id,
  vt.driver_id,
  vt.transaction_type,
  vt.created_at
FROM vehicle_transactions vt
WHERE vt.driver_id = 'DRIVER_ID_HERE'
  AND vt.transaction_type = 'draw'
ORDER BY vt.created_at DESC
LIMIT 5;
```

## Support Contact

If issue persists after following this guide:
1. Open browser console (F12)
2. Screenshot the console logs starting with `[FuelPurchase]`
3. Note the exact error message displayed
4. Provide this information to system administrator
