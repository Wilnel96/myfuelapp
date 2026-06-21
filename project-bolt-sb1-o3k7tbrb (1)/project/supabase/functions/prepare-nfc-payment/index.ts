import { createClient } from 'npm:@supabase/supabase-js@2.83.0';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PreparePaymentRequest {
  driverId: string;
  pin: string;
  amount: number;
  organizationId: string;
  vehicleId?: string;
  fuelTransactionId?: string;
  deviceInfo?: any;
  location?: { lat: number; lng: number };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const masterEncryptionKey = Deno.env.get('MASTER_ENCRYPTION_KEY');

    if (!masterEncryptionKey) {
      return new Response(
        JSON.stringify({
          error: 'Payment encryption is not configured on the server. Please contact your system administrator.',
          errorCode: 'ENCRYPTION_KEY_NOT_CONFIGURED'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestData: PreparePaymentRequest = await req.json();
    const { driverId, pin, amount, organizationId, vehicleId, fuelTransactionId, deviceInfo, location } = requestData;

    // Validate required fields
    if (!driverId || !pin || !amount || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get driver payment settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from('driver_payment_settings')
      .select('*')
      .eq('driver_id', driverId)
      .maybeSingle();

    if (settingsError || !paymentSettings) {
      return new Response(
        JSON.stringify({ error: 'Payment settings not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if payment is enabled
    if (!paymentSettings.payment_enabled) {
      return new Response(
        JSON.stringify({ error: 'Payment disabled for this driver' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if PIN is set
    if (!paymentSettings.is_pin_active || !paymentSettings.pin_hash) {
      return new Response(
        JSON.stringify({ error: 'PIN not set up' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if account is locked
    if (paymentSettings.locked_until && new Date(paymentSettings.locked_until) > new Date()) {
      const minutesRemaining = Math.ceil((new Date(paymentSettings.locked_until).getTime() - Date.now()) / 60000);
      return new Response(
        JSON.stringify({ 
          error: `Account locked. Try again in ${minutesRemaining} minutes`,
          locked: true,
          lockedUntil: paymentSettings.locked_until,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify PIN
    const pinValid = await bcrypt.compare(pin, paymentSettings.pin_hash);

    if (!pinValid) {
      const newFailedAttempts = paymentSettings.failed_pin_attempts + 1;
      const updateData: any = { failed_pin_attempts: newFailedAttempts };

      // Lock account after 3 failed attempts
      if (newFailedAttempts >= 3) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);
        updateData.locked_until = lockUntil.toISOString();
      }

      await supabase
        .from('driver_payment_settings')
        .update(updateData)
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({ 
          error: 'Invalid PIN',
          attemptsRemaining: 3 - newFailedAttempts,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PIN is valid - reset failed attempts
    await supabase
      .from('driver_payment_settings')
      .update({ failed_pin_attempts: 0, locked_until: null })
      .eq('driver_id', driverId);

    // Check spending limits
    const { data: spendingData } = await supabase
      .rpc('get_driver_current_spending', { p_driver_id: driverId })
      .maybeSingle();

    if (spendingData) {
      const dailyRemaining = spendingData.daily_limit - spendingData.daily_spent;
      const monthlyRemaining = spendingData.monthly_limit - spendingData.monthly_spent;

      if (amount > dailyRemaining) {
        return new Response(
          JSON.stringify({ 
            error: `Daily spending limit exceeded. Remaining: R${dailyRemaining.toFixed(2)}`,
            limitExceeded: 'daily',
            remaining: dailyRemaining,
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (amount > monthlyRemaining) {
        return new Response(
          JSON.stringify({ 
            error: `Monthly spending limit exceeded. Remaining: R${monthlyRemaining.toFixed(2)}`,
            limitExceeded: 'monthly',
            remaining: monthlyRemaining,
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get organization's payment option
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('payment_option')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError || !organization) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentOption = organization.payment_option;
    let nfcPayload: string;
    let displayInfo: any = {};

    if (paymentOption === 'Local Account') {
      // Handle Local Account payment
      if (!vehicleId) {
        return new Response(
          JSON.stringify({ error: 'Vehicle ID required for Local Account payment' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get vehicle number
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('vehicle_number, registration_number')
        .eq('id', vehicleId)
        .maybeSingle();

      if (vehicleError || !vehicle) {
        return new Response(
          JSON.stringify({ error: 'Vehicle not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const vehicleNumber = vehicle.vehicle_number || vehicle.registration_number;

      // Create NFC payment transaction record (without card reference)
      const { data: nfcTransaction, error: nfcError } = await supabase
        .from('nfc_payment_transactions')
        .insert({
          driver_id: driverId,
          organization_card_id: null,
          amount,
          payment_status: 'pin_verified',
          pin_entered_at: new Date().toISOString(),
          pin_verified_at: new Date().toISOString(),
          device_info: deviceInfo || null,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
        })
        .select()
        .single();

      if (nfcError || !nfcTransaction) {
        throw new Error('Failed to create NFC payment transaction');
      }

      // Link to fuel transaction if provided
      if (fuelTransactionId) {
        await supabase.rpc('link_nfc_payment_to_fuel_transaction', {
          p_nfc_payment_id: nfcTransaction.id,
          p_fuel_transaction_id: fuelTransactionId,
        });
      }

      // Prepare NFC payload with vehicle number only
      // Garage-specific account number is shown on screen, not transmitted via NFC
      nfcPayload = await encryptNFCPayload({
        paymentType: 'local_account',
        vehicleNumber,
        registrationNumber: vehicle.registration_number,
        amount,
        transactionId: nfcTransaction.id,
      });

      // Update NFC transaction status
      await supabase
        .from('nfc_payment_transactions')
        .update({
          payment_status: 'nfc_ready',
          nfc_activated_at: new Date().toISOString(),
        })
        .eq('id', nfcTransaction.id);

      displayInfo = {
        success: true,
        transactionId: nfcTransaction.id,
        payload: nfcPayload,
        paymentType: 'local_account',
        accountInfo: `Vehicle: ${vehicleNumber}`,
        amount,
      };
    } else {
      // Handle Card Payment
      const { data: paymentCard, error: cardError } = await supabase
        .from('organization_payment_cards')
        .select('*, encryption_keys(*)')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle();

      if (cardError || !paymentCard) {
        return new Response(
          JSON.stringify({ error: 'No active payment card found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Decrypt card data
      const dataKey = await decryptKey(masterEncryptionKey, paymentCard.encryption_keys.key_encrypted);
      const cardNumber = await decryptField(dataKey, paymentCard.card_number_encrypted, paymentCard.iv_card_number);
      const cardHolderName = await decryptField(dataKey, paymentCard.card_holder_name_encrypted, paymentCard.iv_holder_name);
      const expiryMonth = await decryptField(dataKey, paymentCard.expiry_month_encrypted, paymentCard.iv_expiry_month);
      const expiryYear = await decryptField(dataKey, paymentCard.expiry_year_encrypted, paymentCard.iv_expiry_year);
      const cvv = await decryptField(dataKey, paymentCard.cvv_encrypted, paymentCard.iv_cvv);
      const cardPin = await decryptField(dataKey, paymentCard.pin_encrypted, paymentCard.iv_pin);

      // Create NFC payment transaction record
      const { data: nfcTransaction, error: nfcError } = await supabase
        .from('nfc_payment_transactions')
        .insert({
          driver_id: driverId,
          organization_card_id: paymentCard.id,
          amount,
          payment_status: 'pin_verified',
          pin_entered_at: new Date().toISOString(),
          pin_verified_at: new Date().toISOString(),
          device_info: deviceInfo || null,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
        })
        .select()
        .single();

      if (nfcError || !nfcTransaction) {
        throw new Error('Failed to create NFC payment transaction');
      }

      // Link to fuel transaction if provided
      if (fuelTransactionId) {
        await supabase.rpc('link_nfc_payment_to_fuel_transaction', {
          p_nfc_payment_id: nfcTransaction.id,
          p_fuel_transaction_id: fuelTransactionId,
        });
      }

      // Prepare encrypted NFC payload (re-encrypt for transmission)
      nfcPayload = await encryptNFCPayload({
        paymentType: 'card',
        cardNumber,
        cardHolderName,
        expiryMonth,
        expiryYear,
        cvv,
        amount,
        transactionId: nfcTransaction.id,
      });

      // Update NFC transaction status
      await supabase
        .from('nfc_payment_transactions')
        .update({
          payment_status: 'nfc_ready',
          nfc_activated_at: new Date().toISOString(),
        })
        .eq('id', nfcTransaction.id);

      displayInfo = {
        success: true,
        transactionId: nfcTransaction.id,
        payload: nfcPayload,
        paymentType: 'card',
        cardBrand: paymentCard.card_brand,
        lastFourDigits: paymentCard.last_four_digits,
        cardPin: cardPin,
        amount,
      };
    }

    return new Response(
      JSON.stringify(displayInfo),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Payment preparation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Decrypt a key using master key
async function decryptKey(masterKey: string, encryptedData: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey.padEnd(32, '0').slice(0, 32)),
    'AES-GCM',
    false,
    ['decrypt']
  );

  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encrypted
  );

  return decoder.decode(decrypted);
}

// Decrypt a field
async function decryptField(key: string, encryptedData: string, ivString: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    'AES-GCM',
    false,
    ['decrypt']
  );

  const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivString), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encrypted
  );

  return decoder.decode(decrypted);
}

// Encrypt NFC payload for transmission to mobile app
async function encryptNFCPayload(payload: any): Promise<string> {
  const encoder = new TextEncoder();
  const payloadString = JSON.stringify(payload);
  
  // Generate a temporary session key for this transaction
  const sessionKey = crypto.randomUUID();
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionKey.padEnd(32, '0').slice(0, 32)),
    'AES-GCM',
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encoder.encode(payloadString)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return both the encrypted payload and the session key
  // In production, you'd want to transmit the key securely (e.g., via separate channel)
  return JSON.stringify({
    data: btoa(String.fromCharCode(...combined)),
    key: sessionKey,
  });
}
