/*
# Fix fuel invoice trigger to write invoice_id back to the transaction

1. Problem
- The `trigger_auto_generate_fuel_invoice` trigger on `fuel_transactions` was changed
  from BEFORE to AFTER (migration 20260606170228). An AFTER trigger cannot modify the
  NEW row, so the `NEW.invoice_id := v_new_invoice_id` assignment is silently discarded
  and `fuel_transactions.invoice_id` stays NULL.
- `create-fuel-transaction` then thinks no invoice exists, calls the
  `generate-fuel-transaction-invoice` fallback, which tries to insert a second invoice
  for the same transaction. The unique index
  `fuel_transaction_invoices_fuel_transaction_id_key` rejects it, so the fallback fails,
  no invoice is returned, and the instant email send never runs.
- Result: every invoice since 2026-10-18 has `email_sent_at = NULL` — no instant
  fuel invoice emails were ever delivered, even though the invoices themselves exist.

2. Changes
- Modified function: `public.auto_generate_fuel_transaction_invoice()` (trigger function,
  no signature change). After inserting the invoice row, it now explicitly runs
  `UPDATE fuel_transactions SET invoice_id = v_new_invoice_id WHERE id = NEW.id`
  so the transaction row keeps its link to the invoice. This works for AFTER triggers.
- The UPDATE only fires the INSERT trigger never (it is INSERT-only), so no recursion.
- No tables, columns, policies or grants are changed.

3. Security
- No RLS changes. The trigger runs with the privileges of the acting role
  (service_role from the edge function), which already bypasses RLS.

4. Notes
- Existing rows with NULL `fuel_transactions.invoice_id` are NOT backfilled here;
  the corrected fallback logic in the generate function now resolves duplicates,
  and a follow-up data fix can be applied separately if needed.
*/

CREATE OR REPLACE FUNCTION public.auto_generate_fuel_transaction_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_invoice_number TEXT;
v_vehicle_registration TEXT;
v_driver_name TEXT;
v_garage_name TEXT;
v_garage_address TEXT;
v_garage_vat_number TEXT;
v_billing_email TEXT;
v_payment_option TEXT;
v_fuel_payment_terms TEXT;
v_fuel_payment_interest_rate NUMERIC;
v_fuel_amount NUMERIC;
v_oil_vat_amount NUMERIC;
v_new_invoice_id UUID;
BEGIN
IF NEW.invoice_id IS NOT NULL THEN
RETURN NEW;
END IF;

SELECT registration_number INTO v_vehicle_registration
FROM vehicles WHERE id = NEW.vehicle_id;

SELECT first_name || ' ' || surname INTO v_driver_name
FROM drivers WHERE id = NEW.driver_id;

SELECT
name,
COALESCE(
address_line_1 || COALESCE(', ' || address_line_2, '') || ', ' || city,
'Not recorded'
),
COALESCE(vat_number, '')
INTO v_garage_name, v_garage_address, v_garage_vat_number
FROM garages WHERE id = NEW.garage_id;

SELECT email INTO v_billing_email
FROM organization_users
WHERE organization_id = NEW.organization_id
AND title = 'Billing User'
AND (is_active IS NULL OR is_active = true)
LIMIT 1;

IF v_billing_email IS NULL THEN
SELECT email INTO v_billing_email
FROM organization_users
WHERE organization_id = NEW.organization_id
AND is_main_user = true
AND (is_active IS NULL OR is_active = true)
LIMIT 1;
END IF;

IF v_billing_email IS NULL THEN
SELECT email INTO v_billing_email
FROM organization_users
WHERE organization_id = NEW.organization_id
AND (is_active IS NULL OR is_active = true)
LIMIT 1;
END IF;

SELECT payment_option, fuel_payment_terms, fuel_payment_interest_rate
INTO v_payment_option, v_fuel_payment_terms, v_fuel_payment_interest_rate
FROM organizations WHERE id = NEW.organization_id;

v_fuel_amount := ROUND((NEW.liters * NEW.price_per_liter)::numeric, 2);
v_oil_vat_amount := CASE
WHEN COALESCE(NEW.oil_quantity, 0) > 0
THEN ROUND((NEW.oil_total_amount - (NEW.oil_total_amount / 1.15))::numeric, 2)
ELSE 0
END;

v_invoice_number := generate_fuel_invoice_number();

INSERT INTO fuel_transaction_invoices (
fuel_transaction_id, organization_id, invoice_number, invoice_date,
fuel_type, liters, price_per_liter, fuel_amount, subtotal, vat_rate,
vat_amount, items_subtotal_excl_vat, items_vat_amount, items_total_incl_vat,
total_amount, vehicle_registration, driver_name, garage_name, garage_address,
garage_vat_number, odometer_reading, transaction_date, email_recipient,
oil_quantity, oil_unit_price, oil_total_amount, oil_type, oil_brand,
payment_option, fuel_payment_terms, fuel_payment_interest_rate
) VALUES (
NEW.id, NEW.organization_id, v_invoice_number, NOW(),
NEW.fuel_type, NEW.liters, NEW.price_per_liter, v_fuel_amount, v_fuel_amount, 0,
v_oil_vat_amount, COALESCE(NEW.items_subtotal_excl_vat, 0),
COALESCE(NEW.items_vat_amount, 0), COALESCE(NEW.items_total_incl_vat, 0),
NEW.total_amount, v_vehicle_registration, v_driver_name,
COALESCE(v_garage_name, 'Not recorded'),
COALESCE(v_garage_address, 'Not recorded'),
COALESCE(v_garage_vat_number, ''),
NEW.odometer_reading, NEW.transaction_date, v_billing_email,
COALESCE(NEW.oil_quantity, 0), COALESCE(NEW.oil_unit_price, 0),
COALESCE(NEW.oil_total_amount, 0), NEW.oil_type, NEW.oil_brand,
v_payment_option, v_fuel_payment_terms, v_fuel_payment_interest_rate
)
RETURNING id INTO v_new_invoice_id;

-- AFTER triggers cannot write NEW back to the table; set the link explicitly.
UPDATE fuel_transactions
SET invoice_id = v_new_invoice_id
WHERE id = NEW.id;

RAISE NOTICE 'Auto-generated invoice % for transaction %', v_invoice_number, NEW.id;

RETURN NEW;
EXCEPTION
WHEN OTHERS THEN
RAISE WARNING 'Failed to auto-generate invoice for transaction %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
RETURN NEW;
END;
$$;
