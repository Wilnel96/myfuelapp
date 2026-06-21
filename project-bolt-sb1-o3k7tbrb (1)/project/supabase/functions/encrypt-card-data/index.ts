import { createClient } from 'npm:@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EncryptCardRequest {
  organizationId: string;
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardPin: string;
  cardType: 'debit' | 'credit';
  cardBrand: string;
  cardNickname?: string;
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
          error: 'Payment card encryption is not configured on the server. Please contact your system administrator to configure the MASTER_ENCRYPTION_KEY in Supabase project settings.',
          errorCode: 'ENCRYPTION_KEY_NOT_CONFIGURED'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: EncryptCardRequest = await req.json();

    const {
      organizationId,
      cardNumber,
      cardHolderName,
      expiryMonth,
      expiryYear,
      cvv,
      cardPin,
      cardType,
      cardBrand,
      cardNickname,
    } = requestData;

    // Check if user is super admin (bypass all checks)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === 'super_admin';

    if (!isSuperAdmin) {
      // Validate user is main user or secondary main user of organization
      const { data: orgUser } = await supabase
        .from('organization_users')
        .select('is_main_user, is_secondary_main_user, is_active')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (!orgUser || !orgUser.is_active) {
        return new Response(
          JSON.stringify({ error: 'Access Denied: Only Main Users and Secondary Main Users can manage payment cards' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user is main user or secondary main user
      if (!orgUser.is_main_user && !orgUser.is_secondary_main_user) {
        return new Response(
          JSON.stringify({ error: 'Access Denied: Only Main Users and Secondary Main Users can manage payment cards' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate card number (basic Luhn algorithm)
    if (!validateCardNumber(cardNumber)) {
      return new Response(
        JSON.stringify({ error: 'Invalid card number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate card PIN (4-6 digits)
    if (!cardPin || !/^\d{4,6}$/.test(cardPin)) {
      return new Response(
        JSON.stringify({ error: 'Card PIN must be 4-6 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create encryption key
    const { data: encryptionKey } = await supabase
      .from('encryption_keys')
      .select('*')
      .eq('is_active', true)
      .order('key_version', { ascending: false })
      .limit(1)
      .maybeSingle();

    let keyId: string;
    let dataKey: string;

    if (!encryptionKey) {
      // Create first encryption key
      dataKey = crypto.randomUUID();
      const newKeyData = await encryptKey(masterEncryptionKey, dataKey);
      const { data: newKey, error: keyError } = await supabase
        .from('encryption_keys')
        .insert({
          key_encrypted: newKeyData.encrypted,
          algorithm: 'AES-256-GCM',
          key_version: 1,
          is_active: true,
        })
        .select()
        .single();

      if (keyError || !newKey) {
        throw new Error('Failed to create encryption key');
      }
      keyId = newKey.id;
    } else {
      keyId = encryptionKey.id;
      // Decrypt the existing encryption key
      dataKey = await decryptKey(masterEncryptionKey, encryptionKey.key_encrypted);
    }

    // Encrypt each field separately with unique IVs
    const encryptedCardNumber = await encryptField(dataKey, cardNumber);
    const encryptedHolderName = await encryptField(dataKey, cardHolderName);
    const encryptedExpiryMonth = await encryptField(dataKey, expiryMonth);
    const encryptedExpiryYear = await encryptField(dataKey, expiryYear);
    const encryptedCvv = await encryptField(dataKey, cvv);
    const encryptedPin = await encryptField(dataKey, cardPin);

    // Get last 4 digits
    const lastFourDigits = cardNumber.slice(-4);

    // Delete any existing cards for this organization
    await supabase
      .from('organization_payment_cards')
      .delete()
      .eq('organization_id', organizationId);

    // Insert encrypted card
    const { data: card, error: cardError } = await supabase
      .from('organization_payment_cards')
      .insert({
        organization_id: organizationId,
        card_number_encrypted: encryptedCardNumber.encrypted,
        card_holder_name_encrypted: encryptedHolderName.encrypted,
        expiry_month_encrypted: encryptedExpiryMonth.encrypted,
        expiry_year_encrypted: encryptedExpiryYear.encrypted,
        cvv_encrypted: encryptedCvv.encrypted,
        pin_encrypted: encryptedPin.encrypted,
        card_type: cardType,
        card_brand: cardBrand,
        last_four_digits: lastFourDigits,
        card_nickname: cardNickname || `${cardBrand} •••• ${lastFourDigits}`,
        encryption_key_id: keyId,
        iv_card_number: encryptedCardNumber.iv,
        iv_holder_name: encryptedHolderName.iv,
        iv_expiry_month: encryptedExpiryMonth.iv,
        iv_expiry_year: encryptedExpiryYear.iv,
        iv_cvv: encryptedCvv.iv,
        iv_pin: encryptedPin.iv,
        is_active: true,
        is_default: true,
        created_by: user.id,
      })
      .select('id, card_brand, last_four_digits, card_nickname, is_default')
      .single();

    if (cardError) {
      throw cardError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        card,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Encryption error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Validate card number using Luhn algorithm
function validateCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// Encrypt a key using master key
async function encryptKey(masterKey: string, dataKey: string): Promise<{ encrypted: string }> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey.padEnd(32, '0').slice(0, 32)),
    'AES-GCM',
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encoder.encode(dataKey)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return {
    encrypted: btoa(String.fromCharCode(...combined)),
  };
}

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

// Encrypt a field with unique IV
async function encryptField(key: string, plaintext: string): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    'AES-GCM',
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encoder.encode(plaintext)
  );

  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}
