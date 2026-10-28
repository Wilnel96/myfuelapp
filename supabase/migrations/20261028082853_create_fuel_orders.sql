/*
# Create fuel orders (pre-refuel purchase orders for client organizations)

1. New Tables
- `fuel_orders`: a purchase order a client creates before a vehicle is refuelled.
  - `system_order_number` is always generated (FO-000001, FO-000002, ...) from a sequence.
  - `client_order_number` is optional; when set it is printed on the invoice instead of the system number.
  - `garage_id` ties the order to one garage so the price per litre is guaranteed.
  - `price_per_liter` is captured from the garage's fuel prices when the order is created.
  - `order_type` is `single` or `partial`. Both are consumed by one refuel.
  - `status`: `open` (usable), `fulfilled` (refuel recorded), `cancelled` (withdrawn by the client).
  - `exceeded` is true when the refuel used more litres than were ordered (the refuel is still allowed).
2. Modified Tables
- `fuel_transactions`: new nullable `fuel_order_id` linking a refuel to the order it used.
- `fuel_transaction_invoices`: new nullable `order_number` holding the number printed on the invoice.
3. Functions and Triggers
- `can_manage_fuel_orders(org)`: true when the signed-in user is an active member of the organization who is a main user, secondary main user, or has invoice management access.
- `set_fuel_invoice_order_number()`: BEFORE INSERT trigger on `fuel_transaction_invoices` that copies the client order number (or system order number) from the linked order.
4. Security
- RLS enabled on `fuel_orders`.
- Clients (authenticated) can read, create, and cancel orders for their own organization only when `can_manage_fuel_orders` allows it. Cancel is the only update allowed, and only on open orders.
- Drivers (anon) can read only open orders belonging to their own organization so the refuel screen can show them.
- Edge functions (service_role) manage orders and mark them fulfilled.
- Sequence usage granted to authenticated so the system order number can be generated on insert.

## Important Notes
1. Order numbers are never reused because they come from a sequence.
2. Orders are not time-limited; they stay open until used, cancelled, or fulfilled.
3. No rows are deleted or altered destructively by this migration.
*/

CREATE SEQUENCE IF NOT EXISTS fuel_order_number_seq START 1;

CREATE TABLE IF NOT EXISTS fuel_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  garage_id uuid NOT NULL REFERENCES garages(id),
  fuel_type text NOT NULL,
  order_type text NOT NULL CHECK (order_type IN ('single', 'partial')),
  liters_ordered numeric(10,2) NOT NULL CHECK (liters_ordered > 0),
  liters_used numeric(10,2) NOT NULL DEFAULT 0 CHECK (liters_used >= 0),
  price_per_liter numeric(10,2) NOT NULL CHECK (price_per_liter >= 0),
  system_order_number text NOT NULL UNIQUE
    DEFAULT ('FO-' || lpad(nextval('fuel_order_number_seq')::text, 6, '0')),
  client_order_number text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'cancelled')),
  exceeded boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_fuel_orders_org_status ON fuel_orders (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_fuel_orders_vehicle_status ON fuel_orders (vehicle_id, status);

ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS fuel_order_id uuid REFERENCES fuel_orders(id);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_fuel_order_id ON fuel_transactions (fuel_order_id);

ALTER TABLE fuel_transaction_invoices ADD COLUMN IF NOT EXISTS order_number text;

ALTER TABLE fuel_orders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION can_manage_fuel_orders(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = target_org_id
      AND ou.is_active
      AND (ou.is_main_user OR ou.is_secondary_main_user OR ou.can_view_invoice_management)
  );
$$;

REVOKE EXECUTE ON FUNCTION can_manage_fuel_orders(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION can_manage_fuel_orders(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION set_fuel_invoice_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL AND NEW.fuel_transaction_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(fo.client_order_number), ''), fo.system_order_number)
      INTO NEW.order_number
      FROM fuel_transactions ft
      JOIN fuel_orders fo ON fo.id = ft.fuel_order_id
      WHERE ft.id = NEW.fuel_transaction_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_fuel_invoice_order_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_fuel_invoice_order_number ON fuel_transaction_invoices;
CREATE TRIGGER trg_set_fuel_invoice_order_number
  BEFORE INSERT ON fuel_transaction_invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_fuel_invoice_order_number();

GRANT USAGE ON SEQUENCE fuel_order_number_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE (status) ON fuel_orders TO authenticated;
GRANT SELECT ON fuel_orders TO anon;
GRANT ALL ON fuel_orders TO service_role;

DROP POLICY IF EXISTS "select_fuel_orders_managers" ON fuel_orders;
CREATE POLICY "select_fuel_orders_managers" ON fuel_orders FOR SELECT
  TO authenticated
  USING (can_manage_fuel_orders(organization_id));

DROP POLICY IF EXISTS "insert_fuel_orders_managers" ON fuel_orders;
CREATE POLICY "insert_fuel_orders_managers" ON fuel_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    can_manage_fuel_orders(organization_id)
    AND status = 'open'
    AND exceeded = false
    AND liters_used = 0
    AND EXISTS (
      SELECT 1 FROM vehicles v
      WHERE v.id = fuel_orders.vehicle_id
        AND v.organization_id = fuel_orders.organization_id
    )
  );

DROP POLICY IF EXISTS "update_fuel_orders_cancel" ON fuel_orders;
CREATE POLICY "update_fuel_orders_cancel" ON fuel_orders FOR UPDATE
  TO authenticated
  USING (can_manage_fuel_orders(organization_id) AND status = 'open')
  WITH CHECK (can_manage_fuel_orders(organization_id) AND status = 'cancelled');

DROP POLICY IF EXISTS "select_open_fuel_orders_drivers" ON fuel_orders;
CREATE POLICY "select_open_fuel_orders_drivers" ON fuel_orders FOR SELECT
  TO anon
  USING (status = 'open' AND organization_id = current_driver_org_id());
