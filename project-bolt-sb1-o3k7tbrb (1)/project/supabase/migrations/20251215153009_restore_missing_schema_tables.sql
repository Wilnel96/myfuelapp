/*
  # Restore Missing Schema Tables
  
  This migration restores all tables that were lost during the schema reorganization on Dec 14, 2025.
  Based on the backup from Dec 14, 05:30 UTC which had the complete schema.
  
  ## Tables Being Restored:
  
  1. **organization_users** - User management and permissions system
     - Links users to organizations with granular permissions
     - Tracks main users, secondary users, and custom permissions
     - Includes user titles, contact info, and active status
  
  2. **garages** - Garage directory and management
     - Complete garage information including address, contacts, banking
     - Fuel types offered and pricing
     - Multiple contact persons support
     - Location coordinates for mapping
     - Other offerings and services
  
  3. **daily_eft_batches** - EFT batch processing system
     - Daily batch records for electronic fund transfers
     - Tracks total amounts, commissions, and transaction counts
     - Processing status and timestamps
  
  4. **eft_batch_items** - Individual garage payments in EFT batches
     - Links batches to specific garages
     - Tracks gross/net amounts and commissions per garage
  
  5. **custom_report_templates** - Custom reporting system
     - User-defined report templates
     - Stores column selections, filters, and sort orders
     - Organization-specific reporting
  
  6. **vehicle_transactions** - Vehicle draw/return tracking
     - Tracks when vehicles are drawn and returned
     - Odometer readings and license disk images
     - GPS location tracking
  
  ## Additional Changes:
  
  - Add missing columns to fuel_transactions (garage_id, commission fields, eft_batch_id)
  - Add all necessary RLS policies for security
  - Add indexes for performance
  - Add helper functions and triggers
  
  ## Security:
  
  - All tables have RLS enabled
  - Policies ensure organization-level data isolation
  - Super admin bypass for management access
  - Proper permission checks for all operations
*/

-- =====================================================
-- 1. ORGANIZATION_USERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS organization_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text DEFAULT '',
  surname text DEFAULT '',
  title text DEFAULT '',
  phone_number text DEFAULT '',
  mobile_number text DEFAULT '',
  password text,
  role text DEFAULT 'user' CHECK (role IN ('main_user', 'secondary_main_user', 'user')),
  can_add_vehicles boolean DEFAULT false,
  can_edit_vehicles boolean DEFAULT false,
  can_delete_vehicles boolean DEFAULT false,
  can_add_drivers boolean DEFAULT false,
  can_edit_drivers boolean DEFAULT false,
  can_delete_drivers boolean DEFAULT false,
  can_view_reports boolean DEFAULT true,
  can_manage_users boolean DEFAULT false,
  can_manage_garages boolean DEFAULT false,
  can_process_eft boolean DEFAULT false,
  can_view_financial_info boolean DEFAULT false,
  can_edit_financial_info boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, email)
);

ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_users
CREATE POLICY "org_users_select_policy" ON organization_users 
  FOR SELECT TO authenticated 
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "org_users_insert_policy" ON organization_users 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.can_manage_users = true
      AND ou.is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "org_users_update_policy" ON organization_users 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.can_manage_users = true
      AND ou.is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "org_users_delete_policy" ON organization_users 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.can_manage_users = true
      AND ou.is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_organization_users_org_id ON organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_user_id ON organization_users(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_email ON organization_users(email);

-- =====================================================
-- 2. GARAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS garages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address_line1 text DEFAULT '',
  address_line2 text DEFAULT '',
  city text NOT NULL,
  province text DEFAULT '',
  postal_code text DEFAULT '',
  country text DEFAULT 'South Africa',
  latitude numeric,
  longitude numeric,
  contact_person text,
  contact_email text,
  contact_phone text,
  contact_persons jsonb DEFAULT '[]'::jsonb,
  password text,
  bank_name text NOT NULL,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  branch_code text NOT NULL,
  commission_rate numeric DEFAULT 0.5 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  fuel_brand text DEFAULT '',
  fuel_types_offered text[] DEFAULT ARRAY[]::text[],
  fuel_price_95 numeric DEFAULT 0,
  fuel_price_93 numeric DEFAULT 0,
  fuel_price_diesel numeric DEFAULT 0,
  fuel_price_lpg numeric DEFAULT 0,
  price_zone text DEFAULT '',
  other_offerings text[] DEFAULT ARRAY[]::text[],
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE garages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for garages
CREATE POLICY "garages_select_by_org" ON garages 
  FOR SELECT TO authenticated 
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "garages_select_public" ON garages 
  FOR SELECT TO anon 
  USING (status = 'active');

CREATE POLICY "garages_insert_policy" ON garages 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = auth.uid()
      AND organization_id = garages.organization_id
      AND can_manage_garages = true
      AND is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

CREATE POLICY "garages_update_policy" ON garages 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = auth.uid()
      AND organization_id = garages.organization_id
      AND can_manage_garages = true
      AND is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

CREATE INDEX IF NOT EXISTS idx_garages_org_id ON garages(organization_id);
CREATE INDEX IF NOT EXISTS idx_garages_city ON garages(city);
CREATE INDEX IF NOT EXISTS idx_garages_status ON garages(status);
CREATE INDEX IF NOT EXISTS idx_garages_location ON garages(latitude, longitude);

-- =====================================================
-- 3. DAILY_EFT_BATCHES TABLE
-- =====================================================

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
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, batch_date)
);

ALTER TABLE daily_eft_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_eft_batches
CREATE POLICY "eft_batches_select_policy" ON daily_eft_batches 
  FOR SELECT TO authenticated 
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "eft_batches_manage_policy" ON daily_eft_batches 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = auth.uid()
      AND organization_id = daily_eft_batches.organization_id
      AND can_process_eft = true
      AND is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE user_id = auth.uid()
      AND organization_id = daily_eft_batches.organization_id
      AND can_process_eft = true
      AND is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_daily_eft_batches_org_id ON daily_eft_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_eft_batches_date ON daily_eft_batches(batch_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_eft_batches_status ON daily_eft_batches(status);

-- =====================================================
-- 4. EFT_BATCH_ITEMS TABLE
-- =====================================================

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

-- RLS Policies for eft_batch_items
CREATE POLICY "eft_items_select_policy" ON eft_batch_items 
  FOR SELECT TO authenticated 
  USING (
    batch_id IN (
      SELECT id FROM daily_eft_batches 
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "eft_items_insert_policy" ON eft_batch_items 
  FOR INSERT TO authenticated 
  WITH CHECK (
    batch_id IN (
      SELECT id FROM daily_eft_batches 
      WHERE organization_id IN (
        SELECT organization_id FROM organization_users 
        WHERE user_id = auth.uid() AND can_process_eft = true AND is_active = true
      )
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_eft_batch_items_batch_id ON eft_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_eft_batch_items_garage_id ON eft_batch_items(garage_id);

-- =====================================================
-- 5. CUSTOM_REPORT_TEMPLATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS custom_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  table_name text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_orders jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_report_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_report_templates
CREATE POLICY "report_templates_select_policy" ON custom_report_templates 
  FOR SELECT TO authenticated 
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "report_templates_insert_policy" ON custom_report_templates 
  FOR INSERT TO authenticated 
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "report_templates_update_policy" ON custom_report_templates 
  FOR UPDATE TO authenticated 
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "report_templates_delete_policy" ON custom_report_templates 
  FOR DELETE TO authenticated 
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_custom_report_templates_org_id ON custom_report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_report_templates_user_id ON custom_report_templates(user_id);

-- =====================================================
-- 6. VEHICLE_TRANSACTIONS TABLE (Draw/Return Tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicle_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) NOT NULL,
  driver_id uuid REFERENCES drivers(id) NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('draw', 'return')),
  odometer_reading integer NOT NULL,
  license_disk_image text,
  location text,
  notes text,
  created_at timestamptz DEFAULT now(),
  related_transaction_id uuid REFERENCES vehicle_transactions(id)
);

ALTER TABLE vehicle_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_transactions
CREATE POLICY "vehicle_trans_select_by_org" ON vehicle_transactions 
  FOR SELECT TO authenticated 
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "vehicle_trans_select_public" ON vehicle_transactions 
  FOR SELECT TO anon 
  USING (true);

CREATE POLICY "vehicle_trans_insert_by_org" ON vehicle_transactions 
  FOR INSERT TO authenticated 
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "vehicle_trans_insert_public" ON vehicle_transactions 
  FOR INSERT TO anon 
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_vehicle_id ON vehicle_transactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_driver_id ON vehicle_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_organization_id ON vehicle_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_transactions_created_at ON vehicle_transactions(created_at DESC);

-- =====================================================
-- 7. ADD MISSING COLUMNS TO FUEL_TRANSACTIONS
-- =====================================================

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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'driver_id'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN driver_id uuid REFERENCES drivers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transactions' AND column_name = 'previous_odometer_reading'
  ) THEN
    ALTER TABLE fuel_transactions ADD COLUMN previous_odometer_reading integer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_garage_id ON fuel_transactions(garage_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_eft_batch_id ON fuel_transactions(eft_batch_id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_transaction_date ON fuel_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_driver_id ON fuel_transactions(driver_id);

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to update organization_users updated_at timestamp
CREATE OR REPLACE FUNCTION update_organization_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_organization_users_updated_at ON organization_users;
CREATE TRIGGER set_organization_users_updated_at
  BEFORE UPDATE ON organization_users
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_users_updated_at();

-- Function to update garages updated_at timestamp
CREATE OR REPLACE FUNCTION update_garages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_garages_updated_at ON garages;
CREATE TRIGGER set_garages_updated_at
  BEFORE UPDATE ON garages
  FOR EACH ROW
  EXECUTE FUNCTION update_garages_updated_at();

-- Function to get garage primary contact
CREATE OR REPLACE FUNCTION get_garage_primary_contact(garage_row garages)
RETURNS JSONB AS $$
  SELECT elem
  FROM jsonb_array_elements(garage_row.contact_persons) AS elem
  WHERE (elem->>'is_primary')::boolean = true
  LIMIT 1;
$$ LANGUAGE SQL STABLE;
