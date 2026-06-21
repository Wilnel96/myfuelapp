# High Concurrency System Optimizations

## Overview
This document outlines the optimizations implemented to handle **50,000 drivers per day** using the mobile app concurrently, with a focus on data integrity, system controls, and robustness.

## Critical System Requirements
1. Handle high concurrent load (50,000+ drivers/day)
2. Maintain data integrity under all conditions
3. Enforce all business rules and controls at database level
4. Prevent race conditions and duplicate transactions
5. Ensure spending limits are strictly enforced
6. Fast response times for fuel purchase transactions

---

## 1. Database-Level Integrity Controls

### 1.1 Check Constraints
All critical business rules are enforced at the database level and cannot be bypassed:

```sql
-- Fuel Transaction Constraints
- Liters: 0 < liters ≤ 10,000
- Price per liter: 0 < price ≤ R1,000
- Total amount: 0 < amount ≤ R10,000,000
- Odometer reading: 0 ≤ odometer ≤ 10,000,000
- Commission rate: 0 ≤ rate ≤ 1 (0%-100%)
- Oil quantities: 0 ≤ quantity ≤ 1,000
- Oil prices: 0 ≤ price ≤ R10,000

-- Vehicle Constraints
- Tank capacity: 0 < capacity ≤ 1,000 liters
- Odometer readings: 0 ≤ odometer ≤ 10,000,000
- Service intervals: 0 < interval ≤ 100,000 km

-- Organization/Driver Constraints
- Daily spending limits: 0 < limit ≤ R10,000,000
- Monthly spending limits: 0 < limit ≤ R100,000,000
- Garage account limits: 0 < limit ≤ R100,000,000
```

### 1.2 NOT NULL Constraints
Critical fields cannot be null:
- `organization_id`, `vehicle_id`, `garage_id` (all fuel transactions)
- `liters`, `price_per_liter`, `total_amount` (all fuel transactions)
- `odometer_reading`, `fuel_type`, `transaction_date` (all fuel transactions)

---

## 2. Spending Limit Enforcement

### 2.1 Database Functions
Three database functions enforce spending limits at the database level:

#### `check_organization_spending_limit(organization_id, amount)`
- Checks daily and monthly spending limits for the organization
- Calculates current spending in real-time
- Returns: allowed/rejected with detailed spending information

#### `check_driver_spending_limit(driver_id, amount)`
- Checks individual driver daily/monthly limits (if configured)
- Calculates driver's current spending
- Returns: allowed/rejected with spending details

#### `check_garage_account_limit(organization_id, garage_id, amount)`
- Checks monthly spending at specific garage (for Local Account payment)
- Verifies account is active
- Returns: allowed/rejected with account status

### 2.2 Enforcement Flow
```
1. Driver submits fuel transaction
2. Edge function acquires advisory lock
3. Check organization spending limits ✓
4. Check driver spending limits ✓
5. Check garage account limits ✓
6. If all pass → Insert transaction
7. If any fail → Reject with detailed error
```

---

## 3. Concurrency Control

### 3.1 Advisory Locks
**Function:** `acquire_transaction_lock(driver_id, vehicle_id)`

- Creates unique lock key from driver + vehicle combination
- Uses PostgreSQL advisory locks (transaction-scoped)
- Prevents duplicate transactions from same driver/vehicle
- Non-blocking: returns immediately if lock unavailable
- Automatic release when transaction completes

**How it works:**
```sql
-- Example: Driver A tries to refuel Vehicle X
-- Lock key = hash(driver_A) + hash(vehicle_X)
-- If lock acquired: proceed with transaction
-- If lock NOT acquired: reject with 429 status
```

### 3.2 Transaction Isolation
- Each fuel purchase runs in its own database transaction
- Advisory locks prevent concurrent processing
- Spending limit checks read committed data
- Invoice generation happens after transaction commit

---

## 4. Performance Optimizations

### 4.1 Composite Indexes
Optimized indexes for high-frequency queries:

```sql
-- Spending Calculation Indexes
idx_fuel_trans_org_date_totals (organization_id, transaction_date, total_amount, oil_total_amount)
idx_fuel_trans_driver_date_totals (driver_id, transaction_date, total_amount, oil_total_amount)
idx_fuel_trans_garage_org_date_totals (garage_id, organization_id, transaction_date, ...)

-- Session Lookup Index
idx_driver_sessions_token_expires (token, expires_at) WHERE expires_at > NOW()

-- Transaction Detection
idx_fuel_transactions_vehicle_timestamp (vehicle_id, created_at DESC)
```

### 4.2 Query Optimization
- All spending limit checks use indexed columns
- Date range queries optimized with composite indexes
- Driver session lookups use covered index
- Partial indexes for active records only

### 4.3 Connection Pooling
Supabase automatically handles connection pooling:
- PgBouncer manages database connections
- Transaction pooling for API calls
- Session pooling for long-running queries
- Automatic scaling based on load

---

## 5. Edge Function Optimizations

### 5.1 Request Processing Flow
```
1. Authenticate driver token (1 query)
2. Validate driver status (included in step 1)
3. Acquire advisory lock (1 RPC call)
4. Check organization spending (1 RPC call)
5. Check driver spending (1 RPC call)
6. Check garage account (1 RPC call)
7. Validate vehicle (1 query)
8. Check vehicle drawn status (1 RPC call)
9. Insert fuel transaction (1 insert)
10. Create vehicle exceptions if needed (0-3 inserts)
11. Generate invoice (async call)

Total: ~8-10 database operations per transaction
```

### 5.2 Error Handling
- All errors return appropriate HTTP status codes
- Detailed error messages for spending limit failures
- Session expiration handled gracefully
- Duplicate transaction attempts rejected immediately

---

## 6. Data Integrity Measures

### 6.1 Vehicle Draw Control
- Driver MUST draw vehicle before refueling
- Enforced via `check_vehicle_drawn_by_driver()` function
- Prevents unauthorized fuel purchases
- Tracked via `vehicle_transactions` table

### 6.2 Tank Capacity Validation
- Maximum refuel = tank_capacity + 2 liters buffer
- Hard rejection if exceeded
- Warning generated if approaching capacity
- Exception logged for audit trail

### 6.3 Odometer Validation
- Must be positive integer
- Must be ≥ previous reading (not enforced on existing data)
- Tracked for fuel efficiency calculations
- Used for service interval tracking

### 6.4 Location Verification
- GPS location captured for all transactions
- Mock location detection heuristics
- Distance validation from garage coordinates
- Exceptions logged for suspicious locations

---

## 7. Scalability Architecture

### 7.1 Database Capacity
**Current Schema:**
- 200,000 clients
- 500,000 vehicles
- 300,000 drivers
- 50,000 concurrent daily transactions

**Optimizations:**
- Indexed foreign keys
- Partitioning-ready design
- Efficient spending calculations
- Minimal table scans

### 7.2 Edge Function Performance
- Stateless design (scales horizontally)
- Minimal memory footprint
- Fast response times (<500ms typical)
- Auto-scaling based on demand
- Global CDN distribution

### 7.3 Rate Limiting
**Built-in Supabase Limits:**
- API rate limiting per IP
- Connection pooling limits
- Request size limits
- Automatic throttling under load

**Application-Level Controls:**
- Advisory locks prevent duplicate submissions
- Session-based authentication
- 8-hour session timeout
- Automatic session renewal

---

## 8. Monitoring & Observability

### 8.1 Exception Tracking
All anomalies logged to `vehicle_exceptions` table:
- Tank capacity warnings
- Mock location detection
- Garage location mismatches
- Unusual fuel consumption

### 8.2 Performance Metrics
Monitor these key metrics:
- Average transaction processing time
- Spending limit check duration
- Database connection pool usage
- Edge function invocation count
- Error rates by type

### 8.3 Audit Trail
Complete audit trail maintained:
- All fuel transactions logged
- Driver sessions tracked
- Vehicle draw/return history
- Spending limit rejections (in logs)
- Location data for all transactions

---

## 9. Security Measures

### 9.1 Authentication
- Driver token-based authentication
- Session expiration (8 hours)
- Automatic session renewal
- Token validation on every request

### 9.2 Authorization
- Driver must belong to organization
- Vehicle must belong to same organization
- Driver must have drawn vehicle
- Status checks (driver active, vehicle active)

### 9.3 Data Protection
- Row Level Security (RLS) on all tables
- Service role key for edge functions
- Input validation on all fields
- SQL injection prevention

---

## 10. Testing Recommendations

### 10.1 Load Testing
Test scenarios:
1. 1,000 concurrent fuel purchases
2. 50,000 transactions in 24 hours
3. Spending limit edge cases
4. Concurrent transaction attempts (same driver/vehicle)
5. Database connection pool exhaustion

### 10.2 Integrity Testing
Verify:
1. No duplicate transactions possible
2. Spending limits enforced correctly
3. All business rules validated
4. Exception logging works
5. Invoice generation reliable

### 10.3 Failover Testing
Test:
1. Database connection failures
2. Edge function timeouts
3. Invoice generation failures
4. Network interruptions
5. Session expiration handling

---

## 11. Deployment Checklist

Before deploying to production:

- [ ] Run all database migrations
- [ ] Verify all indexes created
- [ ] Test spending limit functions
- [ ] Deploy updated edge function
- [ ] Verify advisory locks working
- [ ] Load test with realistic data
- [ ] Monitor for 24 hours
- [ ] Set up alerting
- [ ] Document emergency procedures
- [ ] Train support team

---

## 12. Known Limitations

1. **Historical Data:** Existing transactions may violate new constraints (grandfathered)
2. **Odometer Sequence:** Not enforced on existing data to allow corrections
3. **Spending Calculations:** Based on `transaction_date`, not `created_at`
4. **Advisory Locks:** Timeout after transaction completion (no manual release needed)

---

## 13. Performance Benchmarks

Expected performance:
- Driver authentication: <50ms
- Spending limit checks: <100ms per check
- Vehicle validation: <50ms
- Transaction insert: <100ms
- Total processing time: <500ms average

Under load (10,000+ concurrent):
- May increase to 1-2 seconds
- Advisory locks prevent system overload
- Automatic queueing via connection pool
- Graceful degradation under extreme load

---

## Contact & Support

For issues or questions:
1. Check edge function logs
2. Review vehicle_exceptions table
3. Verify spending limit calculations
4. Check database indexes
5. Monitor connection pool usage

This system is designed to be robust, scalable, and maintain data integrity under all conditions.