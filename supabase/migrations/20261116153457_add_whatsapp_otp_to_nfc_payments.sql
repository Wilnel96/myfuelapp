/*
# WhatsApp OTP authorization for card payments

1. Purpose
When a driver pays with the organization's debit/credit card, a one-time PIN
(OTP) is now sent to the driver's WhatsApp number. The driver must enter that
OTP in the app before the card details are transmitted over NFC. This means a
lost or stolen card alone can no longer be used to pay — the driver must also
be in possession of the driver's own phone.

2. Modified tables
- `nfc_payment_transactions`
  - `whatsapp_otp_hash` (text, nullable): bcrypt hash of the OTP sent to the
    driver. Never stores the OTP itself.
  - `otp_attempts` (integer, not null, default 0): failed OTP entries for this
    transaction. After 5 failures the transaction fails.
  - `otp_verified_at` (timestamp with time zone, nullable): when the correct
    OTP was confirmed.
- `payment_status` check constraint extended with a new state
  `awaiting_otp` (between pin_verified and nfc_ready).

3. Security
- RLS: no new policies needed; the table already has org/driver-scoped
  policies. The new columns follow the same access rules.
- Grants: the existing table grants already cover anon/authenticated columns.
- The OTP is stored only as a bcrypt hash; delivery uses the WhatsApp Cloud
  API with a server-side secret.
*/

ALTER TABLE nfc_payment_transactions
  ADD COLUMN IF NOT EXISTS whatsapp_otp_hash text,
  ADD COLUMN IF NOT EXISTS otp_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nfc_payment_transactions_payment_status_check'
      AND conrelid = 'nfc_payment_transactions'::regclass
  ) THEN
    ALTER TABLE nfc_payment_transactions
      DROP CONSTRAINT nfc_payment_transactions_payment_status_check;
  END IF;

  ALTER TABLE nfc_payment_transactions
    ADD CONSTRAINT nfc_payment_transactions_payment_status_check
    CHECK (payment_status = ANY (ARRAY[
      'initiated', 'pin_verified', 'awaiting_otp', 'nfc_ready',
      'transmitting', 'completed', 'failed', 'timeout', 'cancelled',
      'fallback_to_eft'
    ]));
END $$;
