/*
  # Initial Base Schema
  
  Creates the foundational tables that the system needs:
  - organizations: Client companies using the fleet management system
  - profiles: User accounts linked to auth.users
  - vehicles: Fleet vehicles
  - fuel_transactions: Fuel purchase records
  - fuel_cards: Payment cards for fuel purchases
  
  All tables have RLS enabled for security.
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'manager', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  registration_number text NOT NULL UNIQUE,
  driver_name text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Create fuel_cards table
CREATE TABLE IF NOT EXISTS fuel_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  card_number text NOT NULL UNIQUE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'lost', 'stolen')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fuel_cards ENABLE ROW LEVEL SECURITY;

-- Create fuel_transactions table
CREATE TABLE IF NOT EXISTS fuel_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  fuel_card_id uuid REFERENCES fuel_cards(id) ON DELETE SET NULL,
  transaction_date timestamptz DEFAULT now(),
  fuel_type text NOT NULL,
  liters numeric NOT NULL CHECK (liters > 0),
  price_per_liter numeric NOT NULL CHECK (price_per_liter > 0),
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  odometer_reading integer,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (will be enhanced by later migrations)
CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "organizations_select_policy" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles_select_policy" ON vehicles FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "fuel_transactions_select_policy" ON fuel_transactions FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "fuel_cards_select_policy" ON fuel_cards FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);