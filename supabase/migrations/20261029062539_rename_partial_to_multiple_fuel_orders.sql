/*
# Rename partial fuel orders to multiple refuel orders

1. Plain-English summary
- The "Partial refuel" order type is renamed to "Multiple refuel".
- A multiple refuel order can now be used for several fill-ups and only closes once its ordered litres have been used.
- Single refuel orders are unchanged and still close after one fill-up.

2. Modified tables
- `fuel_orders.order_type`: the allowed values change from ('single', 'partial') to ('single', 'multiple'). Existing 'partial' rows are converted to 'multiple'.

3. Security
- No RLS, policy or grant changes.

4. Notes
- The existing check constraint on order_type is found and dropped dynamically so the name does not need to be known in advance.
- Rows are updated before the new constraint is added so the constraint cannot fail on legacy data.
*/

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.fuel_orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%order_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.fuel_orders DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

UPDATE public.fuel_orders SET order_type = 'multiple' WHERE order_type = 'partial';

ALTER TABLE public.fuel_orders
  ADD CONSTRAINT fuel_orders_order_type_check CHECK (order_type IN ('single', 'multiple'));
