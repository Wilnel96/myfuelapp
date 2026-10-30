/*
# Compulsory fuel orders per garage account and oil / other goods on fuel orders

1. Modified Tables
- `organization_garage_accounts`
  - New `order_required` boolean (default false). When true, drivers of the client
    must have an open fuel order for the vehicle before filling up at that garage.
- `fuel_orders`
  - New `item_type` text: 'fuel' (default), 'oil' or 'other'.
  - New `item_description` text, nullable: oil type or free-text description for oil/other orders.

2. Security
- No policy changes. Existing RLS on both tables still applies to the new columns.
- Column privileges are granted to the roles that already write these tables.

3. Important Notes
- Existing rows default to item_type 'fuel' and order_required false, so nothing changes for them.
*/

ALTER TABLE organization_garage_accounts
  ADD COLUMN IF NOT EXISTS order_required boolean NOT NULL DEFAULT false;

ALTER TABLE fuel_orders
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'fuel'
    CHECK (item_type IN ('fuel', 'oil', 'other')),
  ADD COLUMN IF NOT EXISTS item_description text;
