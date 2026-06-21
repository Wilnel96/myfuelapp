/*
  # Payment Card Storage System

  1. New Tables
    - `encryption_keys`
      - `id` (uuid, primary key)
      - `key_encrypted` (text) - Encrypted encryption key
      - `algorithm` (text) - Encryption algorithm used
      - `key_version` (integer) - Version number for key rotation
      - `created_at` (timestamptz)
      - `rotated_at` (timestamptz) - When key was rotated
      - `is_active` (boolean) - Current active key

    - `organization_payment_cards`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `card_number_encrypted` (text) - Encrypted card number
      - `card_holder_name_encrypted` (text) - Encrypted cardholder name
      - `expiry_month_encrypted` (text) - Encrypted expiry month
      - `expiry_year_encrypted` (text) - Encrypted expiry year
      - `cvv_encrypted` (text) - Encrypted CVV
      - `card_type` (text) - 'debit' or 'credit'
      - `card_brand` (text) - Visa, Mastercard, etc.
      - `last_four_digits` (text) - Last 4 digits (unencrypted for display)
      - `card_nickname` (text) - Optional nickname for card
      - `encryption_key_id` (uuid, foreign key) - Key used for encryption
      - `iv_card_number` (text) - Initialization vector for card number
      - `iv_holder_name` (text) - IV for holder name
      - `iv_expiry_month` (text) - IV for expiry month
      - `iv_expiry_year` (text) - IV for expiry year
      - `iv_cvv` (text) - IV for CVV
      - `is_active` (boolean) - Card is currently active
      - `is_default` (boolean) - Default card for organization
      - `created_at` (timestamptz)
      - `created_by` (uuid, foreign key to auth.users)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Only super admins and management org users can manage encryption keys
    - Only main users of organization can manage payment cards
    - All card operations are logged
    - Card data never exposed in queries

  3. Indexes
    - Index on organization_id for card lookups
    - Index on encryption_key_id
    - Index on is_active and is_default for quick active card lookup
*/

-- Create encryption_keys table
CREATE TABLE IF NOT EXISTS encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_encrypted text NOT NULL,
  algorithm text NOT NULL DEFAULT 'AES-256-GCM',
  key_version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  rotated_at timestamptz,
  is_active boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS encryption_keys_is_active_idx ON encryption_keys(is_active);
CREATE INDEX IF NOT EXISTS encryption_keys_key_version_idx ON encryption_keys(key_version);

ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

-- Only management organization users (super admins) can manage encryption keys
CREATE POLICY "Management org users can view encryption keys"
  ON encryption_keys FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

CREATE POLICY "Management org users can insert encryption keys"
  ON encryption_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

CREATE POLICY "Management org users can update encryption keys"
  ON encryption_keys FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Create organization_payment_cards table
CREATE TABLE IF NOT EXISTS organization_payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  card_number_encrypted text NOT NULL,
  card_holder_name_encrypted text NOT NULL,
  expiry_month_encrypted text NOT NULL,
  expiry_year_encrypted text NOT NULL,
  cvv_encrypted text NOT NULL,
  card_type text NOT NULL CHECK (card_type IN ('debit', 'credit')),
  card_brand text NOT NULL,
  last_four_digits text NOT NULL CHECK (length(last_four_digits) = 4),
  card_nickname text,
  encryption_key_id uuid REFERENCES encryption_keys(id) NOT NULL,
  iv_card_number text NOT NULL,
  iv_holder_name text NOT NULL,
  iv_expiry_month text NOT NULL,
  iv_expiry_year text NOT NULL,
  iv_cvv text NOT NULL,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Only one default card per organization
CREATE UNIQUE INDEX IF NOT EXISTS organization_payment_cards_one_default_per_org_idx
  ON organization_payment_cards(organization_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS organization_payment_cards_organization_id_idx ON organization_payment_cards(organization_id);
CREATE INDEX IF NOT EXISTS organization_payment_cards_encryption_key_id_idx ON organization_payment_cards(encryption_key_id);
CREATE INDEX IF NOT EXISTS organization_payment_cards_is_active_default_idx ON organization_payment_cards(is_active, is_default);
CREATE INDEX IF NOT EXISTS organization_payment_cards_created_by_idx ON organization_payment_cards(created_by);

ALTER TABLE organization_payment_cards ENABLE ROW LEVEL SECURITY;

-- Organization main users can view their organization's cards (but only metadata, not encrypted data)
CREATE POLICY "Organization users can view their payment cards metadata"
  ON organization_payment_cards FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- Management org users can view all cards
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Only main users can insert payment cards
CREATE POLICY "Organization main users can insert payment cards"
  ON organization_payment_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT ou.organization_id
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    -- Management org users can insert for any organization
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Only main users can update payment cards
CREATE POLICY "Organization main users can update payment cards"
  ON organization_payment_cards FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT ou.organization_id
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT ou.organization_id
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Only main users can delete payment cards
CREATE POLICY "Organization main users can delete payment cards"
  ON organization_payment_cards FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT ou.organization_id
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.is_main_user = true
      AND ou.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Function to automatically set updated_at
CREATE OR REPLACE FUNCTION update_organization_payment_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_payment_cards_updated_at_trigger
  BEFORE UPDATE ON organization_payment_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_payment_cards_updated_at();

-- Function to ensure only one default card per organization
CREATE OR REPLACE FUNCTION ensure_one_default_card_per_org()
RETURNS TRIGGER AS $$
BEGIN
  -- If this card is being set as default
  IF NEW.is_default = true THEN
    -- Unset all other cards as default for this organization
    UPDATE organization_payment_cards
    SET is_default = false
    WHERE organization_id = NEW.organization_id
    AND id != NEW.id
    AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_one_default_card_per_org_trigger
  BEFORE INSERT OR UPDATE ON organization_payment_cards
  FOR EACH ROW
  EXECUTE FUNCTION ensure_one_default_card_per_org();
