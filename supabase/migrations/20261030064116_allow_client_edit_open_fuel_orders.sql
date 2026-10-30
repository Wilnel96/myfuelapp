/*
# Allow clients to edit open fuel orders

1. Plain-English summary
- Clients can change the details of an order (vehicle, garage, order type, litres, client order number) while it is still open.
- An order can only be edited while no fuel has been drawn against it (liters_used = 0) and it has not been marked exceeded.
- Editing is for the client portal only. Drivers still only read open orders.

2. Modified tables
- `fuel_orders`: authenticated users get UPDATE on the editable columns only. status, liters_used, exceeded, fulfilled_at and system_order_number stay locked to the existing rules.

3. Security
- New policy `update_fuel_orders_edit` (FOR UPDATE, TO authenticated). USING and WITH CHECK both require:
  - the user is a manager of the order's organization (can_manage_fuel_orders)
  - the order is open, unused and not exceeded
  - the vehicle belongs to the same organization
- The existing `update_fuel_orders_cancel` policy is unchanged.
- Column grants are additive: the existing UPDATE (status) grant remains.

4. Notes
- Idempotent: the policy is dropped before it is created and GRANT is safe to repeat.
- No rows are changed by this migration.
*/

GRANT UPDATE (vehicle_id, garage_id, fuel_type, order_type, liters_ordered, price_per_liter, client_order_number)
  ON fuel_orders TO authenticated;

DROP POLICY IF EXISTS "update_fuel_orders_edit" ON fuel_orders;
CREATE POLICY "update_fuel_orders_edit" ON fuel_orders FOR UPDATE
  TO authenticated
  USING (
    can_manage_fuel_orders(organization_id)
    AND status = 'open'
    AND liters_used = 0
    AND exceeded = false
  )
  WITH CHECK (
    can_manage_fuel_orders(organization_id)
    AND status = 'open'
    AND liters_used = 0
    AND exceeded = false
    AND EXISTS (
      SELECT 1 FROM vehicles v
      WHERE v.id = fuel_orders.vehicle_id
        AND v.organization_id = fuel_orders.organization_id
    )
  );
