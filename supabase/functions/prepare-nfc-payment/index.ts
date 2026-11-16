import { createClient } from 'npm:@supabase/supabase-js@2.83.0';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PreparePaymentRequest {
  mode?: 'prepare' | 'authorization-pin' | 'verify-otp';
  transactionId?: string;
  pin: string;
  otp?: string;
  amount: number;
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

    // The caller must present a valid driver session. Both the driver and the
    // organization are derived from it, never from the request body, so a
    // caller cannot ask for somebody else's card.
    const driverToken = req.headers.get('X-Driver-Token');
    if (!driverToken) {
      return new Response(
        JSON.stringify({ error: 'Driver session required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: session } = await supabase
      .from('driver_sessions')
      .select('driver_id, expires_at')
      .eq('token', driverToken)
      .maybeSingle();

    if (!session || new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const driverId = session.driver_id;

    const { data: sessionDriver } = await supabase
      .from('drivers')
      .select('id, organization_id, status')
      .eq('id', driverId)
      .maybeSingle();

    if (!sessionDriver || sessionDriver.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Driver account is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = sessionDriver.organization_id;

    const requestData: PreparePaymentRequest = await req.json();
    const { mode, transactionId, pin, amount, vehicleId, fuelTransactionId, deviceInfo, location } = requestData;

    // Second step of a card payment: confirm the OTP that was sent to the
    // driver's WhatsApp number. Only after a correct OTP may the NFC payload
    // be armed and the card PIN requested.
    if (mode === 'verify-otp') {
      if (!transactionId || !otp) {
        return new Response(
          JSON.stringify({ error: 'Transaction and verification code required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: txn } = await supabase
        .from('nfc_payment_transactions')
        .select('id, driver_id, payment_status, whatsapp_otp_hash, otp_attempts, nfc_activated_at')
        .eq('id', transactionId)
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!txn || txn.payment_status !== 'awaiting_otp') {
        return new Response(
          JSON.stringify({ error: 'Payment is not waiting for verification' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!txn.whatsapp_otp_hash) {
        return new Response(
          JSON.stringify({ error: 'No verification code was sent. Please restart the payment.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (txn.otp_attempts >= 5) {
        await supabase
          .from('nfc_payment_transactions')
          .update({ payment_status: 'failed', failure_code: 'otp_attempts_exceeded' })
          .eq('id', txn.id);
        return new Response(
          JSON.stringify({ error: 'Too many incorrect codes. Please start the payment again.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const otpValid = await bcrypt.compare(otp, txn.whatsapp_otp_hash);
      if (!otpValid) {
        await supabase
          .from('nfc_payment_transactions')
          .update({ otp_attempts: (txn.otp_attempts || 0) + 1 })
          .eq('id', txn.id);
        return new Response(
          JSON.stringify({ error: 'Incorrect code. Please try again.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('nfc_payment_transactions')
        .update({ otp_verified_at: new Date().toISOString(), payment_status: 'pin_verified' })
        .eq('id', txn.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Third step: hand over the card's authorisation PIN only for a transaction
    // that belongs to this driver, whose OTP has been verified, and which is
    // waiting at the pump. The PIN is never included in the prepare response.
    if (mode === 'authorization-pin') {
      if (!transactionId) {
        return new Response(
          JSON.stringify({ error: 'Transaction required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: txn } = await supabase
        .from('nfc_payment_transactions')
        .select('id, driver_id, organization_card_id, payment_status, nfc_activated_at, otp_verified_at')
        .eq('id', transactionId)
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!txn || !['nfc_ready', 'transmitting'].includes(txn.payment_status) || !txn.organization_card_id || !txn.otp_verified_at) {
        return new Response(
          JSON.stringify({ error: 'Payment is not ready' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const activatedAt = txn.nfc_activated_at ? new Date(txn.nfc_activated_at).getTime() : 0;
      if (!activatedAt || Date.now() - activatedAt > 5 * 60 * 1000) {
        return new Response(
          JSON.stringify({ error: 'Payment session expired' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: card } = await supabase
        .from('organization_payment_cards')
        .select('id, organization_id, pin_encrypted, iv_pin, encryption_keys(key_encrypted)')
        .eq('id', txn.organization_card_id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (!card || !card.pin_encrypted) {
        return new Response(
          JSON.stringify({ error: 'Card PIN not available' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pinKey = await decryptKey(masterEncryptionKey, (card as any).encryption_keys.key_encrypted);
      const authorizationPin = await decryptField(pinKey, card.pin_encrypted, card.iv_pin);

      return new Response(
        JSON.stringify({ success: true, cardPin: authorizationPin }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!pin || !amount || !organizationId) {
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
        .eq('organization_id', organizationId)
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

      // Create NFC payment transaction record. Card payments start in
      // awaiting_otp: the WhatsApp code must be confirmed before the card
      // details are armed for NFC transmission.
      const { data: nfcTransaction, error: nfcError } = await supabase
        .from('nfc_payment_transactions')
        .insert({
          driver_id: driverId,
          organization_card_id: paymentCard.id,
          amount,
          payment_status: 'awaiting_otp',
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

      // Send the one-time authorization code to the driver's WhatsApp number.
      const { data: otpDriver } = await supabase
        .from('drivers')
        .select('phone_number, name, surname')
        .eq('id', driverId)
        .maybeSingle();

      const otpSent = await sendWhatsAppOtp({
        supabaseUrl,
        transactionId: nfcTransaction.id,
        phone: otpDriver?.phone_number || '',
        driverName: [otpDriver?.name, otpDriver?.surname].filter(Boolean).join(' ') || 'Driver',
        amount,
        lastFour: paymentCard.last_four_digits || '',
      });

      if (!otpSent) {
        await supabase
          .from('nfc_payment_transactions')
          .update({ payment_status: 'failed', failure_code: 'otp_send_failed' })
          .eq('id', nfcTransaction.id);
        return new Response(
          JSON.stringify({ error: 'Could not send the verification code. Please check that your phone number is up to date and try again.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      displayInfo = {
        success: true,
        transactionId: nfcTransaction.id,
        paymentType: 'card',
        cardBrand: paymentCard.card_brand,
        lastFourDigits: paymentCard.last_four_digits,
        hasCardPin: Boolean(paymentCard.pin_encrypted),
        otpRequired: true,
        otpSentTo: maskPhoneNumber(otpDriver?.phone_number || ''),
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

  // Only the ciphertext leaves the server. The session key is never shipped
  // next to the data it protects.
  return JSON.stringify({
    data: btoa(String.fromCharCode(...combined)),
  });
}

// Send the one-time card authorization code to the driver's WhatsApp number
// using the Meta WhatsApp Cloud API. Returns false when the integration is
// not configured or the message could not be delivered, so the payment
// fails closed rather than proceeding without verification.
async function sendWhatsAppOtp(opts: {
  supabaseUrl: string;
  transactionId: string;
  phone: string;
  driverName: string;
  amount: number;
  lastFour: string;
}): Promise<boolean> {
  const whatsappToken = Deno.env.get('WHATSAPP_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  if (!whatsappToken || !phoneNumberId) {
    console.error('WhatsApp OTP not sent: WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured');
    return false;
  }

  if (!opts.phone) {
    console.error('WhatsApp OTP not sent: driver has no phone number on record');
    return false;
  }

  // Generate the 6-digit code and store only a bcrypt hash of it. The plain
  // code exists solely in the WhatsApp message and is never persisted.
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  // Hash and store against the transaction created by the caller. Only the
  // hash is persisted, so the code cannot be read back from the database.
  const otpHash = bcrypt.hashSync(otp, 10);
  const { error: otpStoreError } = await supabase
    .from('nfc_payment_transactions')
    .update({ whatsapp_otp_hash: otpHash, otp_attempts: 0 })
    .eq('id', opts.transactionId);

  if (otpStoreError) {
    console.error('WhatsApp OTP not sent: failed to store code hash');
    return false;
  }

  const message =
    `Hi ${opts.driverName}, your card authorization code is *${otp}*. ` +
    `Enter this code in the driver app to approve paying R${opts.amount.toFixed(2)} ` +
    `with your card ending in ${opts.lastFour}. The code expires in 5 minutes. ` +
    `If you did not request this, ignore this message.`;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: opts.phone.replace(/[^0-9]/g, ''),
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      console.error('WhatsApp API error:', response.status, await response.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error('WhatsApp API request failed:', err);
    return false;
  }
}

function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 4) return '****';
  return `*** *** ${digits.slice(-4)}`;
}
