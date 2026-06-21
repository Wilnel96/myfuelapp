/*
  # Add Organization Payment Cards Table

  1. New Tables
    - `organization_payment_cards`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `encrypted_card_number` (text) - Encrypted full card number
      - `encrypted_cvv` (text) - Encrypted CVV
      - `card_holder_name` (text) - Name on card
      - `expiry_month` (text) - Card expiry month (MM)
      - `expiry_year` (text) - Card expiry year (YYYY)
      - `card_type` (text) - Visa, Mastercard, etc.
      - `last_four_digits` (text) - Last 4 digits for display only
      - `is_active` (boolean) - Whether this card is currently active
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `created_by` (uuid) - User who added the card

  2. Security
    - Enable RLS on `organization_payment_cards` table
    - Add policies for super admin and organization users to manage cards
    - Add policy for drivers to read encrypted card data (after PIN verification in app)
    
  3. Indexes
    - Index on organization_id for fast lookups
    - Index on is_active for filtering active cards
*/

-- Create organization_payment_cards table
CREATE TABLE IF NOT EXISTS organization_payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  encrypted_card_number text NOT NULL,
  encrypted_cvv text NOT NULL,
  card_holder_name text NOT NULL,
  expiry_month text NOT NULL,
  expiry_year text NOT NULL,
  card_type text,
  last_four_digits text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT valid_expiry_month CHECK (expiry_month ~ '^(0[1-9]|1[0-2])$'),
  CONSTRAINT valid_expiry_year CHECK (expiry_year ~ '^[0-9]{4}$'),
  CONSTRAINT valid_last_four CHECK (last_four_digits ~ '^[0-9]{4}$')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_payment_cards_org_id ON organization_payment_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_payment_cards_active ON organization_payment_cards(is_active);

-- Enable RLS
ALTER TABLE organization_payment_cards ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
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

-- Organization users can manage their own organization's cards
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

CREATE POLICY "Organization users can insert their org payment cards"
  ON organization_payment_cards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_users
      WHERE user_id = auth.uid()
      AND organization_users.is_active = true
      AND (can_edit_financial_info = true OR is_main_user = true OR is_secondary_main_user = true)
    )
  );

CREATE POLICY "Organization users can update their org payment cards"
  ON organization_payment_cards
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_users
      WHERE user_id = auth.uid()
      AND organization_users.is_active = true
      AND (can_edit_financial_info = true OR is_main_user = true OR is_secondary_main_user = true)
    )
  );

CREATE POLICY "Organization users can delete their org payment cards"
  ON organization_payment_cards
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_users
      WHERE user_id = auth.uid()
      AND organization_users.is_active = true
      AND (can_edit_financial_info = true OR is_main_user = true OR is_secondary_main_user = true)
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

-- Anonymous drivers (not logged in as auth users) can also read cards
CREATE POLICY "Anonymous drivers can read org payment cards"
  ON organization_payment_cards
  FOR SELECT
  TO anon
  USING (true);
