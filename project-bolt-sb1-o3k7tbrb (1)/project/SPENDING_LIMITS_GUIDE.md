# Spending Limits Business Rules

## Spending Limit Hierarchy

The system implements a **garage-first spending limit hierarchy** that prioritizes garage credit risk management.

### Priority Order

1. **Garage-Specific Monthly Limit** (Highest Priority)
   - Set by the garage in their portal under "Local Client Accounts"
   - Applies when the garage extends credit to the client
   - Garage takes the credit risk
   - **Overrides all organization-level limits**
   - Tracked per garage, per organization

2. **Organization Monthly Limit** (Fallback)
   - Set by system portal during client takeon
   - Applies when garage has NOT set a specific limit
   - Used for EFT payment scenarios (management organization pays garages)
   - Tracked across all garages

3. **Organization Daily Limit** (Fallback)
   - Set by system portal during client takeon
   - Only used if no garage limit exists
   - Tracked across all garages

## Business Logic

### When Garage Sets a Limit
- The garage limit becomes the **only** limit enforced for that specific garage
- Organization limits are completely ignored for that garage
- This allows garages to manage their own credit risk
- Different garages can set different limits for the same client

### When No Garage Limit Exists
- System falls back to organization monthly/daily limits
- This scenario typically applies to EFT payment arrangements
- Management organization assumes the payment responsibility

## Example Scenarios

### Scenario 1: Mixed Limits
**Test Transport Solutions:**
- Organization Monthly Limit: R500,000
- Organization Daily Limit: R50,000

**At Robertson Shell:**
- Garage Limit: R15,000/month
- **Active Limit: R15,000/month** (garage takes credit risk)

**At Expressmark:**
- Garage Limit: R1,000/month
- **Active Limit: R1,000/month** (garage takes credit risk)

**At Route 62:**
- No Garage Limit Set
- **Active Limit: R500,000/month** (falls back to organization limit)

### Scenario 2: EFT Only
If no garages set specific limits:
- All garages use organization monthly/daily limits
- Management organization handles all payments via EFT
- Garages take no credit risk

## Implementation Details

### Database Schema
- `organizations.monthly_spending_limit` - Organization-level monthly limit
- `organizations.daily_spending_limit` - Organization-level daily limit
- `organization_garage_accounts.monthly_spend_limit` - Garage-specific monthly limit

### Spending Calculation
When garage limit exists:
- Only counts transactions **at that specific garage** for the current month

When organization limit is used:
- Counts transactions **at all garages** for the current period (month or day)

### Portal Access
- **Garage Portal**: Can set/update their specific monthly limits
- **Client Portal**: Can view both garage-specific and organization limits
- **System Portal**: Can set organization-level limits during takeon

## Benefits

1. **Garage Autonomy**: Garages control their credit exposure
2. **Flexible Risk Management**: Different garages can have different risk appetites
3. **Clear Accountability**: Who takes credit risk is explicit in the limit structure
4. **EFT Fallback**: System still works when garages don't extend credit
