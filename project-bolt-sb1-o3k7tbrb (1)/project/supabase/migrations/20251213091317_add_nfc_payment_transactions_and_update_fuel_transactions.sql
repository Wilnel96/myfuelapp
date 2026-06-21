/*
  # NFC Payment Transactions Tracking and Fuel Transaction Updates

  1. New Tables
    - `nfc_payment_transactions`
      - `id` (uuid, primary key)
      - `fuel_transaction_id` (uuid, foreign key to fuel_transactions, nullable initially)
      - `driver_id` (uuid, foreign key to drivers)
      - `organization_card_id` (uuid, foreign key to organization_payment_cards)
      - `amount` (decimal) - Payment amount
      - `payment_status` (text) - Status of payment
      - `pin_entered_at` (timestamptz) - When PIN was entered
      - `pin_verified_at` (timestamptz) - When PIN was verified
      - `nfc_activated_at` (timestamptz) - When NFC was activated
      - `nfc_data_transmitted_at` (timestamptz) - When data sent to card machine
      - `payment_completed_at` (timestamptz) - When payment completed
      - `device_info` (jsonb) - Device information for security
      - `location_lat` (decimal) - GPS latitude
      - `location_lng` (decimal) - GPS longitude
      - `failure_reason` (text) - Reason for failure
      - `failure_code` (text) - Error code
      - `retry_count` (integer) - Number of retries
      - `created_at` (timestamptz)

  2. Updates to fuel_transactions
    - Add `payment_method` column ('eft_batch' or 'nfc_instant')
    - Add `payment_status` column ('pending', 'authorized', 'completed', 'failed')
    - Add `nfc_payment_transaction_id` column (foreign key)
    - Add `payment_completed_at` column

  3. Security
    - Enable RLS on nfc_payment_transactions
    - Organization users can view their payment transactions
    - Drivers can view their own transactions
    - Management org can view all

  4. Indexes
    - Index on payment_status and created_at
    - Index on driver_id
    - Index on fuel_transaction_id
    - Composite index on payment_status and created_at for monitoring
*/

-- Create nfc_payment_transactions table
CREATE TABLE IF NOT EXISTS nfc_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_transaction_id uuid REFERENCES fuel_transactions(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
  organization_card_id uuid REFERENCES organization_payment_cards(id) ON DELETE SET NULL NOT NULL,
  amount decimal(10,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'initiated' CHECK (
    payment_status IN ('initiated', 'pin_verified', 'nfc_ready', 'transmitting', 'completed', 'failed', 'timeout', 'cancelled', 'fallback_to_eft')
  ),
  pin_entered_at timestamptz,
  pin_verified_at timestamptz,
  nfc_activated_at timestamptz,
  nfc_data_transmitted_at timestamptz,
  payment_completed_at timestamptz,
  device_info jsonb,
  location_lat decimal(10,8),
  location_lng decimal(11,8),
  failure_reason text,
  failure_code text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nfc_payment_transactions_fuel_transaction_id_idx ON nfc_payment_transactions(fuel_transaction_id);
CREATE INDEX IF NOT EXISTS nfc_payment_transactions_driver_id_idx ON nfc_payment_transactions(driver_id);
CREATE INDEX IF NOT EXISTS nfc_payment_transactions_organization_card_id_idx ON nfc_payment_transactions(organization_card_id);
CREATE INDEX IF NOT EXISTS nfc_payment_transactions_payment_status_idx ON nfc_payment_transactions(payment_status);
CREATE INDEX IF NOT EXISTS nfc_payment_transactions_status_created_idx ON nfc_payment_transactions(payment_status, created_at);
CREATE INDEX IF NOT EXISTS nfc_payment_transactions_created_at_idx ON nfc_payment_transactions(created_at);

ALTER TABLE nfc_payment_transactions ENABLE ROW LEVEL SECURITY;

-- Organization users can view their payment transactions
CREATE POLICY "Organization users can view their nfc payment transactions"
  ON nfc_payment_transactions FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT d.id FROM drivers d
      WHERE d.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    -- Drivers can view their own
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
    OR
    -- Management org can view all
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Drivers and system can insert NFC payment transactions
CREATE POLICY "Drivers can insert their nfc payment transactions"
  ON nfc_payment_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
    OR
    -- Organization users can insert for their drivers
    driver_id IN (
      SELECT d.id FROM drivers d
      WHERE d.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    -- Management org can insert for any driver
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Drivers and system can update their transactions
CREATE POLICY "Drivers can update their nfc payment transactions"
  ON nfc_payment_transactions FOR UPDATE
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
    OR
    driver_id IN (
      SELECT d.id FROM drivers d
      WHERE d.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
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
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
    OR
    driver_id IN (
      SELECT d.id FROM drivers d
      WHERE d.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON p.organization_id = o.id
      WHERE p.id = auth.uid()
      AND o.is_management_org = true
    )
  );

-- Update fuel_transactions table to support multiple payment methods
DO $$
BEGIN
  -- Add payment_method column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN payment_method text DEFAULT 'eft_batch' CHECK (
      payment_method IN ('eft_batch', 'nfc_instant')
    );
  END IF;

  -- Add payment_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN payment_status text DEFAULT 'pending' CHECK (
      payment_status IN ('pending', 'authorized', 'completed', 'failed')
    );
  END IF;

  -- Add nfc_payment_transaction_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'nfc_payment_transaction_id'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN nfc_payment_transaction_id uuid REFERENCES nfc_payment_transactions(id) ON DELETE SET NULL;
  END IF;

  -- Add payment_completed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'payment_completed_at'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN payment_completed_at timestamptz;
  END IF;
END $$;

-- Create indexes for new fuel_transactions columns
CREATE INDEX IF NOT EXISTS fuel_transactions_payment_method_idx ON fuel_transactions(payment_method);
CREATE INDEX IF NOT EXISTS fuel_transactions_payment_status_idx ON fuel_transactions(payment_status);
CREATE INDEX IF NOT EXISTS fuel_transactions_nfc_payment_transaction_id_idx ON fuel_transactions(nfc_payment_transaction_id);
CREATE INDEX IF NOT EXISTS fuel_transactions_payment_method_status_idx ON fuel_transactions(payment_method, payment_status);

-- Function to update payment_completed_at when payment status changes to completed
CREATE OR REPLACE FUNCTION update_fuel_transaction_payment_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN
    NEW.payment_completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fuel_transaction_payment_completed_at_trigger
  BEFORE UPDATE ON fuel_transactions
  FOR EACH ROW
  WHEN (NEW.payment_status = 'completed' AND OLD.payment_status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION update_fuel_transaction_payment_completed_at();

-- Function to link NFC payment to fuel transaction
CREATE OR REPLACE FUNCTION link_nfc_payment_to_fuel_transaction(
  p_nfc_payment_id uuid,
  p_fuel_transaction_id uuid
)
RETURNS void AS $$
BEGIN
  -- Update fuel transaction with NFC payment link
  UPDATE fuel_transactions
  SET 
    nfc_payment_transaction_id = p_nfc_payment_id,
    payment_method = 'nfc_instant',
    payment_status = 'authorized'
  WHERE id = p_fuel_transaction_id;

  -- Update NFC payment transaction with fuel transaction link
  UPDATE nfc_payment_transactions
  SET fuel_transaction_id = p_fuel_transaction_id
  WHERE id = p_nfc_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark NFC payment as completed
CREATE OR REPLACE FUNCTION complete_nfc_payment(
  p_nfc_payment_id uuid
)
RETURNS void AS $$
DECLARE
  v_fuel_transaction_id uuid;
  v_driver_id uuid;
  v_amount decimal;
BEGIN
  -- Get transaction details
  SELECT fuel_transaction_id, driver_id, amount
  INTO v_fuel_transaction_id, v_driver_id, v_amount
  FROM nfc_payment_transactions
  WHERE id = p_nfc_payment_id;

  -- Update NFC payment status
  UPDATE nfc_payment_transactions
  SET 
    payment_status = 'completed',
    payment_completed_at = now()
  WHERE id = p_nfc_payment_id;

  -- Update fuel transaction status
  IF v_fuel_transaction_id IS NOT NULL THEN
    UPDATE fuel_transactions
    SET payment_status = 'completed'
    WHERE id = v_fuel_transaction_id;
  END IF;

  -- Increment driver spending
  PERFORM increment_driver_spending(v_driver_id, v_amount);

  -- Update last payment time
  UPDATE driver_payment_settings
  SET last_payment_at = now()
  WHERE driver_id = v_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark NFC payment as failed and fallback to EFT
CREATE OR REPLACE FUNCTION fail_nfc_payment_fallback_to_eft(
  p_nfc_payment_id uuid,
  p_failure_reason text,
  p_failure_code text
)
RETURNS void AS $$
DECLARE
  v_fuel_transaction_id uuid;
BEGIN
  -- Get fuel transaction ID
  SELECT fuel_transaction_id
  INTO v_fuel_transaction_id
  FROM nfc_payment_transactions
  WHERE id = p_nfc_payment_id;

  -- Update NFC payment status
  UPDATE nfc_payment_transactions
  SET 
    payment_status = 'fallback_to_eft',
    failure_reason = p_failure_reason,
    failure_code = p_failure_code
  WHERE id = p_nfc_payment_id;

  -- Update fuel transaction to use EFT batch
  IF v_fuel_transaction_id IS NOT NULL THEN
    UPDATE fuel_transactions
    SET 
      payment_method = 'eft_batch',
      payment_status = 'pending',
      nfc_payment_transaction_id = NULL
    WHERE id = v_fuel_transaction_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
