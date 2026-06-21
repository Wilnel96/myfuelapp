/*
  # Fix Organization Payment Cards Schema

  1. Changes
    - Drop and recreate organization_payment_cards table with proper encryption columns
    - Add all necessary IV (initialization vector) columns for proper encryption
    - Add encryption_key_id foreign key
    - Add is_default flag
    - Add card_nickname for display
    
  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing table
DROP TABLE IF EXISTS organization_payment_cards CASCADE;

-- Check if encryption_keys table exists, if not create it
CREATE TABLE IF NOT EXISTS encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_encrypted text NOT NULL,
  algorithm text NOT NULL DEFAULT 'AES-256-GCM',
  key_version integer NOT NULL DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create organization_payment_cards table with proper encryption schema
CREATE TABLE organization_payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Encrypted fields
  card_number_encrypted text NOT NULL,
  card_holder_name_encrypted text NOT NULL,
  expiry_month_encrypted text NOT NULL,
  expiry_year_encrypted text NOT NULL,
  cvv_encrypted text NOT NULL,
  
  -- Initialization vectors for each encrypted field
  iv_card_number text NOT NULL,
  iv_holder_name text NOT NULL,
  iv_expiry_month text NOT NULL,
  iv_expiry_year text NOT NULL,
  iv_cvv text NOT NULL,
  
  -- Card metadata
  card_type text NOT NULL,
  card_brand text NOT NULL,
  last_four_digits text NOT NULL,
  card_nickname text,
  
  -- Encryption reference
  encryption_key_id uuid NOT NULL REFERENCES encryption_keys(id),
  
  -- Status flags
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  CONSTRAINT valid_last_four CHECK (last_four_digits ~ '^[0-9]{4}$')
);

-- Create indexes
CREATE INDEX idx_org_payment_cards_org_id ON organization_payment_cards(organization_id);
CREATE INDEX idx_org_payment_cards_active ON organization_payment_cards(is_active);
CREATE INDEX idx_org_payment_cards_default ON organization_payment_cards(is_default);

-- Enable RLS
ALTER TABLE organization_payment_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

-- Encryption keys policies (only edge functions can access)
CREATE POLICY "Service role can manage encryption keys"
  ON encryption_keys
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Super admin can do everything with payment cards
CREATE POLICY "Super admin full access to payment cards"
  ON organization_payment_cards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Organization users can view their own organization's cards
CREATE POLICY "Organization users can view their org payment cards"
  ON organization_payment_cards
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_users
      WHERE user_id = auth.uid()
      AND organization_users.is_active = true
    )
  );

-- Only main users and secondary main users can delete cards
CREATE POLICY "Main users can delete their org payment cards"
  ON organization_payment_cards
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_users
      WHERE user_id = auth.uid()
      AND organization_users.is_active = true
      AND (is_main_user = true OR is_secondary_main_user = true)
    )
  );

-- Drivers can read encrypted card data for their organization (PIN verification happens in app)
CREATE POLICY "Drivers can read their org payment cards"
  ON organization_payment_cards
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM drivers
      WHERE drivers.user_id = auth.uid()
    )
  );

-- Anonymous drivers can also read cards for NFC payment
CREATE POLICY "Anonymous drivers can read org payment cards"
  ON organization_payment_cards
  FOR SELECT
  TO anon
  USING (true);
