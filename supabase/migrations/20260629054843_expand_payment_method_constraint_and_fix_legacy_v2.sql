-- Expand the payment_method constraint to include card and local_account
ALTER TABLE fuel_transactions 
  DROP CONSTRAINT IF EXISTS fuel_transactions_payment_method_check;

ALTER TABLE fuel_transactions
  ADD CONSTRAINT fuel_transactions_payment_method_check
  CHECK (payment_method = ANY (ARRAY['eft_batch', 'nfc_instant', 'card', 'local_account']));

-- Drop the old fuel_cards FK if it exists (old NFC system used fuel_cards, new system uses organization_payment_cards)
ALTER TABLE fuel_transactions
  DROP CONSTRAINT IF EXISTS fuel_transactions_fuel_card_id_fkey;

-- Re-add FK pointing to organization_payment_cards (the current card system)
ALTER TABLE fuel_transactions
  ADD CONSTRAINT fuel_transactions_fuel_card_id_fkey
  FOREIGN KEY (fuel_card_id) REFERENCES organization_payment_cards(id) ON DELETE SET NULL;

-- Fix legacy eft_batch for card-paying organizations, linking to their default card
UPDATE fuel_transactions ft
SET 
  payment_method = 'card',
  fuel_card_id = (
    SELECT opc.id
    FROM organization_payment_cards opc
    WHERE opc.organization_id = ft.organization_id
      AND opc.is_active = true
      AND opc.is_default = true
    LIMIT 1
  )
FROM organizations o
WHERE ft.organization_id = o.id
  AND ft.payment_method = 'eft_batch'
  AND o.payment_option IN ('Card Payment', 'Both');

-- Fix legacy eft_batch for local account organizations
UPDATE fuel_transactions ft
SET payment_method = 'local_account',
    fuel_card_id = NULL
FROM organizations o
WHERE ft.organization_id = o.id
  AND ft.payment_method = 'eft_batch'
  AND o.payment_option = 'Local Account';

-- Backfill card_last_four_digits on invoices where we now have a linked card
UPDATE fuel_transaction_invoices fti
SET card_last_four_digits = opc.last_four_digits
FROM fuel_transactions ft
JOIN organization_payment_cards opc ON opc.id = ft.fuel_card_id
WHERE fti.fuel_transaction_id = ft.id
  AND opc.last_four_digits IS NOT NULL
  AND fti.card_last_four_digits IS NULL;
