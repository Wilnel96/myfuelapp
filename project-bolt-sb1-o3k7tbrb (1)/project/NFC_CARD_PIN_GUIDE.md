# NFC Payment Card PIN System

## Overview

The NFC payment system displays the organization's card PIN to drivers during payment transactions. When a driver makes an NFC payment, their phone shows the card's PIN in large, easy-to-read format. The driver then enters this PIN on the garage's physical card reader to authorize the transaction.

## How It Works

### Card Registration Process

1. **Organization Setup**: Main User or Secondary Main User accesses Organization Payment Card settings
2. **Card Details Entry**: User enters:
   - Card number
   - Cardholder name
   - Expiry date (month/year)
   - CVV
   - **Card PIN** (4-6 digits)
   - Card type (debit/credit)
   - Optional card nickname

3. **Encryption**: All card details including the PIN are encrypted using AES-256-GCM encryption
4. **Secure Storage**: Encrypted data is stored in the `organization_payment_cards` table

### Payment Transaction Flow

#### Driver's Mobile App

1. **Payment Initiation**:
   - Driver opens fuel purchase screen
   - Enters driver PIN to authenticate
   - Initiates NFC payment

2. **Card Data Retrieval**:
   - System retrieves encrypted card data from database
   - Decrypts card details including PIN using master encryption key
   - Prepares NFC payload with card information

3. **PIN Display**:
   - Card PIN is displayed prominently in **60px font**
   - Shown on a blue gradient card background
   - Clear instruction: "Enter this PIN on the card reader"
   - Card brand and last 4 digits shown for reference

4. **NFC Transmission**:
   - Card details transmitted to garage's card reader via NFC
   - Driver sees their card PIN on screen
   - System waits for PIN verification

5. **Driver Action**:
   - Driver enters the displayed PIN on the garage's physical card reader
   - PIN is verified by the card reader/payment processor
   - Transaction is authorized

6. **Completion**:
   - Payment processes successfully
   - Driver receives confirmation
   - Fuel transaction is linked to payment

#### Garage Side

The garage's card reader:
1. Receives card details via NFC
2. Prompts for PIN entry
3. Driver enters PIN from their phone display
4. Card reader verifies PIN with card issuer
5. Authorizes or declines transaction

## Technical Implementation

### Database Schema

#### organization_payment_cards Table

New columns for PIN storage:
```sql
pin_encrypted          text    -- Encrypted card PIN
iv_pin                 text    -- Initialization vector for PIN encryption
```

Existing columns:
```sql
card_number_encrypted       text
card_holder_name_encrypted  text
expiry_month_encrypted      text
expiry_year_encrypted       text
cvv_encrypted               text
encryption_key_id           uuid
iv_card_number              text
iv_holder_name              text
iv_expiry_month             text
iv_expiry_year              text
iv_cvv                      text
```

### Edge Functions

#### encrypt-card-data

**Purpose**: Encrypts and stores payment card details including PIN

**Request**:
```typescript
{
  organizationId: string;
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardPin: string;        // NEW: Card PIN
  cardType: 'debit' | 'credit';
  cardBrand: string;
  cardNickname?: string;
}
```

**Process**:
1. Validates user permissions (Main User or Secondary Main User)
2. Validates card number using Luhn algorithm
3. Validates PIN (4-6 digits)
4. Encrypts each field separately with unique IVs
5. Stores encrypted data in database

#### prepare-nfc-payment

**Purpose**: Prepares payment data for NFC transmission and retrieves card PIN

**Request**:
```typescript
{
  driverId: string;
  pin: string;             // Driver's authentication PIN
  amount: number;
  organizationId: string;
  vehicleId?: string;
  fuelTransactionId?: string;
}
```

**Response**:
```typescript
{
  success: true;
  transactionId: string;
  payload: string;         // Encrypted NFC payload
  paymentType: 'card';
  cardBrand: string;
  lastFourDigits: string;
  cardPin: string;         // NEW: Decrypted card PIN for display
  amount: number;
}
```

**Process**:
1. Verifies driver PIN
2. Checks spending limits
3. Retrieves organization's payment card
4. Decrypts all card fields including PIN
5. Creates NFC payment transaction record
6. Returns card PIN in response for display to driver

### Frontend Components

#### OrganizationPaymentCard.tsx

**Card Registration Form**:
```typescript
<div>
  <label>Card PIN *</label>
  <input
    type={showPin ? 'text' : 'password'}
    value={formData.cardPin}
    onChange={(e) => {
      const value = e.target.value.replace(/\D/g, '');
      if (value.length <= 6) {
        setFormData({ ...formData, cardPin: value });
      }
    }}
    placeholder="Enter 4-6 digit PIN"
    required
    minLength={4}
    maxLength={6}
  />
  <p>This PIN will be displayed to drivers when they make NFC payments</p>
</div>
```

#### NFCPayment.tsx

**PIN Display UI**:
```tsx
{status === 'awaiting_pin' && (
  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8">
    <p>Enter this PIN on the card reader</p>
    <div className="text-6xl font-bold tracking-wider font-mono">
      {authorizationPIN || '----'}
    </div>
    <p>Your card PIN for R{amount.toFixed(2)} payment</p>
  </div>
)}
```

**State Management**:
```typescript
const [authorizationPIN, setAuthorizationPIN] = useState('');

// Set PIN from API response
setAuthorizationPIN(result.cardPin || '');
```

## Security Considerations

### Encryption

- **Algorithm**: AES-256-GCM (military-grade encryption)
- **Unique IVs**: Each field uses a unique initialization vector
- **Key Management**: Master encryption key stored in Supabase secrets
- **Data Keys**: Separate encryption keys for different key versions

### Access Control

- **Card Registration**: Only Main Users and Secondary Main Users
- **PIN Retrieval**: Only during active, authenticated payment transactions
- **Display**: PIN only shown to authenticated driver on their device
- **No Persistence**: PIN not stored in browser or local storage

### Best Practices

1. **Master Key**: Store `MASTER_ENCRYPTION_KEY` in Supabase Edge Function secrets
2. **Key Rotation**: Support for key versioning and rotation
3. **Audit Trail**: All card operations logged with user ID and timestamp
4. **Failed Attempts**: Driver PIN attempts tracked and locked after 3 failures
5. **Transaction Timeout**: NFC transactions expire after 60 seconds

## User Experience

### For Organizations

1. Navigate to Organization Settings → Payment Card
2. Enter all card details including PIN
3. System validates and encrypts data
4. Confirmation shown upon successful registration
5. Card PIN never displayed again after registration

### For Drivers

1. Initiate fuel purchase
2. Enter driver authentication PIN
3. Select NFC payment option
4. Card PIN displayed in large, clear format
5. Enter PIN on garage's card reader
6. Payment processes automatically
7. Receive transaction confirmation

### PIN Display Features

- **Large Text**: 60px font size for easy reading
- **Monospace Font**: Clear digit separation
- **High Contrast**: White text on blue gradient background
- **Context**: Shows card brand and amount
- **Instructions**: Clear guidance on what to do
- **Security Warning**: Reminder not to share PIN

## Error Handling

### Card Registration Errors

- **Invalid Card Number**: Luhn algorithm validation fails
- **Invalid PIN**: Must be 4-6 digits
- **Permission Denied**: User not Main User or Secondary Main User
- **Encryption Not Configured**: Master key not set

### Payment Transaction Errors

- **No Card Found**: Organization has no active payment card
- **Decryption Failed**: Issue retrieving card data
- **Spending Limit Exceeded**: Driver over daily/monthly limit
- **Account Locked**: Too many failed PIN attempts

## Testing

### Manual Test Steps

1. **Card Registration**:
   - Log in as Main User
   - Navigate to Payment Card settings
   - Enter valid card details with PIN "1234"
   - Verify successful registration
   - Confirm PIN is not displayed

2. **Payment Transaction**:
   - Log in as driver
   - Initiate fuel purchase
   - Start NFC payment
   - Verify PIN "1234" displays prominently
   - Confirm card brand and last 4 digits shown
   - Check instructions are clear

3. **PIN Entry Simulation**:
   - Note the displayed PIN
   - Enter PIN on card reader
   - Verify transaction completes
   - Check payment record created

## Future Enhancements

1. **PIN Masking Option**: Allow organizations to enable/disable PIN display
2. **Alternative Input**: Support for NFC-enabled card readers without manual PIN
3. **Biometric Backup**: Use fingerprint as alternative to PIN entry
4. **PIN Change Workflow**: Allow organizations to update stored PIN
5. **Multiple Cards**: Support multiple payment cards per organization
6. **Card Expiry Alerts**: Notify when card approaching expiry date

## Support Information

For issues with:
- **Encryption Configuration**: Check `MASTER_ENCRYPTION_KEY` in Supabase secrets
- **PIN Not Displaying**: Verify card registration includes PIN field
- **Access Denied**: Confirm user has Main User or Secondary Main User role
- **Payment Failures**: Check driver spending limits and PIN attempts
