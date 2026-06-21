/*
  # Add PIN Storage to Organization Payment Cards

  1. Changes
    - Add `pin_encrypted` column to store the encrypted card PIN
    - Add `iv_pin` column to store the initialization vector for PIN encryption
    - The PIN is provided during card registration and stored encrypted
    - The PIN is retrieved and displayed to drivers during NFC payments
    - Drivers enter this PIN on the garage's physical card reader to authorize transactions

  2. Security
    - PIN is encrypted using AES-256-GCM with unique IV
    - PIN is only decrypted when needed for active payment transactions
    - PIN remains encrypted at rest in the database
*/

-- Add pin_encrypted column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_payment_cards' AND column_name = 'pin_encrypted'
  ) THEN
    ALTER TABLE organization_payment_cards ADD COLUMN pin_encrypted text;
  END IF;
END $$;

-- Add iv_pin column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_payment_cards' AND column_name = 'iv_pin'
  ) THEN
    ALTER TABLE organization_payment_cards ADD COLUMN iv_pin text;
  END IF;
END $$;
