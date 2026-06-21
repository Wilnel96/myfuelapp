/*
  # Update Payment Model for Garage EFT System

  1. New Tables
    - `garages`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `name` (text)
      - `address` (text)
      - `contact_person` (text)
      - `contact_email` (text)
      - `contact_phone` (text)
      - `bank_name` (text)
      - `account_holder` (text)
      - `account_number` (text)
      - `branch_code` (text)
      - `commission_rate` (numeric, default 0.5)
      - `status` (text, default 'active')
      - `created_at` (timestamptz)
    
    - `daily_eft_batches`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `batch_date` (date)
      - `total_amount` (numeric)
      - `total_commission` (numeric)
      - `total_transactions` (integer)
      - `status` (text, default 'pending')
      - `processed_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `eft_batch_items`
      - `id` (uuid, primary key)
      - `batch_id` (uuid, references daily_eft_batches)
      - `garage_id` (uuid, references garages)
      - `transaction_count` (integer)
      - `gross_amount` (numeric)
      - `commission_amount` (numeric)
      - `net_amount` (numeric)
      - `created_at` (timestamptz)

  2. Changes to `fuel_transactions`
    - Add `garage_id` column (references garages)
    - Add `commission_rate` column (numeric)
    - Add `commission_amount` column (numeric)
    - Add `net_amount` column (numeric)
    - Add `eft_batch_id` column (references daily_eft_batches)
    - Add `authorized_at` column (timestamptz)
    - Make `fuel_card_id` nullable

  3. Security
    - Enable RLS on all new tables
    - Add policies for organization-based access
*/

CREATE TABLE IF NOT EXISTS garages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address text,
  contact_person text,
  contact_email text,
  contact_phone text,
  bank_name text NOT NULL,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  branch_code text NOT NULL,
  commission_rate numeric DEFAULT 0.5 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE garages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization garages"
  ON garages FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert garages"
  ON garages FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can update garages"
  ON garages FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE TABLE IF NOT EXISTS daily_eft_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  batch_date date NOT NULL,
  total_amount numeric DEFAULT 0,
  total_commission numeric DEFAULT 0,
  total_transactions integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, batch_date)
);

ALTER TABLE daily_eft_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization EFT batches"
  ON daily_eft_batches FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can manage EFT batches"
  ON daily_eft_batches FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE TABLE IF NOT EXISTS eft_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES daily_eft_batches(id) ON DELETE CASCADE NOT NULL,
  garage_id uuid REFERENCES garages(id) ON DELETE CASCADE NOT NULL,
  transaction_count integer DEFAULT 0,
  gross_amount numeric DEFAULT 0,
  commission_amount numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eft_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view EFT batch items"
  ON eft_batch_items FOR SELECT
  TO authenticated
  USING (
    batch_id IN (
      SELECT id FROM daily_eft_batches 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'garage_id'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN garage_id uuid REFERENCES garages(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN commission_rate numeric DEFAULT 0.5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'commission_amount'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN commission_amount numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN net_amount numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'eft_batch_id'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN eft_batch_id uuid REFERENCES daily_eft_batches(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'authorized_at'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN authorized_at timestamptz;
  END IF;

  ALTER TABLE fuel_transactions ALTER COLUMN fuel_card_id DROP NOT NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_garage_id ON fuel_transactions(garage_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_eft_batch_id ON fuel_transactions(eft_batch_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_transaction_date ON fuel_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_eft_batch_items_batch_id ON eft_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_eft_batch_items_garage_id ON eft_batch_items(garage_id);
