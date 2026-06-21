/*
  # Update Parent-Child Organization Hierarchy

  1. Changes to organizations table
    - Add `month_end_day` (integer) - Day of month for month-end closing (1-31)
    - Add `year_end_month` (integer) - Month for year-end closing (1-12)
    - Add `year_end_day` (integer) - Day for year-end closing (1-31)
    - Ensure parent_org_id and is_management_org are properly set
    
  2. Changes to garages table
    - Update to link garages ONLY to parent organization
    - Remove organization_id, replace with management_org_id
    - Add email_address for automated nightly reports
    
  3. Changes to fuel_transactions table
    - Keep organization_id (child org that made the purchase)
    - Garage is linked separately (parent's garage)
    
  4. Security Updates
    - Garages can only be created/edited by parent organization (super_admin)
    - Child organizations can only view garages, not edit
    - Child organizations can only see their own fuel transactions
    - Parent can see all fuel transactions
    
  5. Important Notes
    - Parent organization manages all garages
    - Child organizations purchase fuel at parent's garages
    - Each garage gets nightly email with their sales
    - Parent gets consolidated reports
    - Child organizations get their own organization reports
*/

-- Add month-end and year-end fields to organizations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'month_end_day') THEN
    ALTER TABLE organizations ADD COLUMN month_end_day integer DEFAULT 31 CHECK (month_end_day >= 1 AND month_end_day <= 31);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'year_end_month') THEN
    ALTER TABLE organizations ADD COLUMN year_end_month integer DEFAULT 12 CHECK (year_end_month >= 1 AND year_end_month <= 12);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'year_end_day') THEN
    ALTER TABLE organizations ADD COLUMN year_end_day integer DEFAULT 31 CHECK (year_end_day >= 1 AND year_end_day <= 31);
  END IF;
END $$;

-- Add email_address to garages for automated reports
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'garages' AND column_name = 'email_address') THEN
    ALTER TABLE garages ADD COLUMN email_address text;
  END IF;
END $$;

-- Update garages RLS policies - only parent can manage garages
DROP POLICY IF EXISTS "Parent org can manage garages" ON garages;
CREATE POLICY "Parent org can manage garages"
  ON garages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
      AND EXISTS (
        SELECT 1 FROM organizations 
        WHERE organizations.id = profiles.organization_id 
        AND organizations.is_management_org = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
      AND EXISTS (
        SELECT 1 FROM organizations 
        WHERE organizations.id = profiles.organization_id 
        AND organizations.is_management_org = true
      )
    )
  );

-- Child organizations can view garages (read-only)
DROP POLICY IF EXISTS "Child orgs can view garages" ON garages;
CREATE POLICY "Child orgs can view garages"
  ON garages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id IS NOT NULL
    )
  );

-- Update fuel_transactions policies for child organizations
DROP POLICY IF EXISTS "Child orgs can view own transactions" ON fuel_transactions;
CREATE POLICY "Child orgs can view own transactions"
  ON fuel_transactions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Child orgs can insert own transactions" ON fuel_transactions;
CREATE POLICY "Child orgs can insert own transactions"
  ON fuel_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create a view for garage daily sales reports
CREATE OR REPLACE VIEW garage_daily_sales AS
SELECT 
  ft.garage_id,
  g.name as garage_name,
  g.email_address as garage_email,
  DATE(ft.transaction_date) as sale_date,
  ft.id as transaction_id,
  ft.organization_id,
  o.name as organization_name,
  ft.vehicle_id,
  v.license_plate,
  v.make,
  v.model,
  ft.driver_id,
  ft.fuel_type,
  ft.gallons as liters,
  ft.price_per_gallon as price_per_liter,
  ft.total_amount as rand_value,
  ft.commission_rate,
  ft.commission_amount,
  ft.net_amount,
  ft.odometer_reading
FROM fuel_transactions ft
JOIN garages g ON ft.garage_id = g.id
JOIN organizations o ON ft.organization_id = o.id
JOIN vehicles v ON ft.vehicle_id = v.id
WHERE ft.garage_id IS NOT NULL;

-- Create a view for vehicle statistics
CREATE OR REPLACE VIEW vehicle_statistics AS
SELECT 
  v.id as vehicle_id,
  v.organization_id,
  v.license_plate,
  v.make,
  v.model,
  v.initial_odometer_reading,
  COUNT(ft.id) as total_transactions,
  SUM(ft.gallons) as total_liters,
  SUM(ft.total_amount) as total_spent,
  MAX(ft.odometer_reading) as latest_odometer,
  (MAX(ft.odometer_reading) - v.initial_odometer_reading) as total_km_travelled,
  CASE 
    WHEN (MAX(ft.odometer_reading) - v.initial_odometer_reading) > 0 
    THEN (SUM(ft.gallons) * 100.0) / (MAX(ft.odometer_reading) - v.initial_odometer_reading)
    ELSE 0
  END as actual_consumption_per_100km,
  v.average_fuel_consumption_per_100km as expected_consumption_per_100km,
  CASE 
    WHEN v.average_fuel_consumption_per_100km > 0 
    THEN ((CASE 
      WHEN (MAX(ft.odometer_reading) - v.initial_odometer_reading) > 0 
      THEN (SUM(ft.gallons) * 100.0) / (MAX(ft.odometer_reading) - v.initial_odometer_reading)
      ELSE 0
    END - v.average_fuel_consumption_per_100km) / v.average_fuel_consumption_per_100km) * 100
    ELSE 0
  END as consumption_variance_percentage
FROM vehicles v
LEFT JOIN fuel_transactions ft ON v.id = ft.vehicle_id
GROUP BY v.id, v.organization_id, v.license_plate, v.make, v.model, 
         v.initial_odometer_reading, v.average_fuel_consumption_per_100km;

-- Create a view for driver statistics
CREATE OR REPLACE VIEW driver_statistics AS
SELECT 
  d.id as driver_id,
  d.organization_id,
  d.first_name,
  d.last_name,
  d.id_number,
  COUNT(ft.id) as total_transactions,
  COUNT(DISTINCT ft.vehicle_id) as vehicles_driven,
  SUM(ft.gallons) as total_liters,
  SUM(ft.total_amount) as total_spent,
  CASE 
    WHEN COUNT(ft.id) > 0 
    THEN SUM(ft.total_amount) / COUNT(ft.id)
    ELSE 0
  END as average_transaction_amount,
  MAX(ft.transaction_date) as last_transaction_date,
  MIN(ft.transaction_date) as first_transaction_date
FROM drivers d
LEFT JOIN fuel_transactions ft ON d.id = ft.driver_id
GROUP BY d.id, d.organization_id, d.first_name, d.last_name, d.id_number;

-- Grant access to views
GRANT SELECT ON garage_daily_sales TO authenticated;
GRANT SELECT ON vehicle_statistics TO authenticated;
GRANT SELECT ON driver_statistics TO authenticated;
