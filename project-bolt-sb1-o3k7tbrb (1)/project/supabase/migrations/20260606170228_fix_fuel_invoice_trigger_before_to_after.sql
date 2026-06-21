
-- Drop the broken BEFORE INSERT trigger
DROP TRIGGER IF EXISTS trigger_auto_generate_fuel_invoice ON fuel_transactions;

-- Update the function to use UPDATE instead of NEW.invoice_id assignment
-- (AFTER triggers cannot modify the row via NEW)
CREATE OR REPLACE FUNCTION public.auto_generate_fuel_transaction_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
v_client_name TEXT;
v_client_address TEXT;
v_fuel_amount NUMERIC;
v_oil_vat_amount NUMERIC;
v_new_invoice_id UUID;
BEGIN
-- Skip if invoice already assigned
IF NEW.invoice_id IS NOT NULL THEN
  RETURN NEW;
END IF;

SELECT registration_number INTO v_vehicle_registration
FROM vehicles WHERE id = NEW.vehicle_id;

SELECT first_name || ' ' || surname INTO v_driver_name
FROM drivers WHERE id = NEW.driver_id;

SELECT
  name,
  TRIM(
    COALESCE(address_line_1, '') ||
    CASE WHEN COALESCE(address_line_2, '') <> '' THEN E'\n' || address_line_2 ELSE '' END ||
    CASE WHEN COALESCE(city, '') <> '' THEN E'\n' || city ELSE '' END ||
    CASE WHEN COALESCE(province, '') <> '' THEN E'\n' || province ELSE '' END ||
    CASE WHEN COALESCE(postal_code, '') <> '' THEN ' ' || postal_code ELSE '' END
  ),
  COALESCE(vat_number, '')
INTO v_garage_name, v_garage_address, v_garage_vat_number
FROM garages WHERE id = NEW.garage_id;

SELECT
  name,
  TRIM(
    COALESCE(address_line_1, '') ||
    CASE WHEN COALESCE(address_line_2, '') <> '' THEN E'\n' || address_line_2 ELSE '' END ||
    CASE WHEN COALESCE(city, '') <> '' THEN E'\n' || city ELSE '' END ||
    CASE WHEN COALESCE(province, '') <> '' THEN E'\n' || province ELSE '' END ||
    CASE WHEN COALESCE(postal_code, '') <> '' THEN ' ' || postal_code ELSE '' END
  )
INTO v_client_name, v_client_address
FROM organizations WHERE id = NEW.organization_id;

SELECT email INTO v_billing_email
FROM organization_users
WHERE organization_id = NEW.organization_id AND is_main_user = true
LIMIT 1;

IF v_billing_email IS NULL THEN
  SELECT email INTO v_billing_email
  FROM organization_users
  WHERE organization_id = NEW.organization_id AND (is_active IS NULL OR is_active = true)
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
  fuel_type, liters, price_per_liter, fuel_amount, subtotal,
  vat_rate, vat_amount,
  items_subtotal_excl_vat, items_vat_amount, items_total_incl_vat,
  total_amount, vehicle_registration, driver_name,
  garage_name, garage_address, garage_vat_number,
  client_name, client_address,
  odometer_reading, transaction_date, email_recipient,
  oil_quantity, oil_unit_price, oil_total_amount, oil_type, oil_brand,
  payment_option, fuel_payment_terms, fuel_payment_interest_rate
) VALUES (
  NEW.id, NEW.organization_id, v_invoice_number, NOW(),
  NEW.fuel_type, NEW.liters, NEW.price_per_liter, v_fuel_amount, v_fuel_amount,
  0, v_oil_vat_amount,
  COALESCE(NEW.items_subtotal_excl_vat, 0), COALESCE(NEW.items_vat_amount, 0), COALESCE(NEW.items_total_incl_vat, 0),
  NEW.total_amount, v_vehicle_registration, v_driver_name,
  COALESCE(v_garage_name, 'Not recorded'), COALESCE(v_garage_address, 'Not recorded'), COALESCE(v_garage_vat_number, ''),
  v_client_name, v_client_address,
  NEW.odometer_reading, NEW.transaction_date, v_billing_email,
  COALESCE(NEW.oil_quantity, 0), COALESCE(NEW.oil_unit_price, 0), COALESCE(NEW.oil_total_amount, 0),
  NEW.oil_type, NEW.oil_brand,
  v_payment_option, v_fuel_payment_terms, v_fuel_payment_interest_rate
)
RETURNING id INTO v_new_invoice_id;

-- Update the parent row with the new invoice_id
UPDATE fuel_transactions SET invoice_id = v_new_invoice_id WHERE id = NEW.id;

RAISE NOTICE 'Auto-generated invoice % for transaction %', v_invoice_number, NEW.id;

RETURN NULL;
EXCEPTION
WHEN OTHERS THEN
  RAISE WARNING 'Failed to auto-generate invoice for transaction %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NULL;
END;
$function$;

-- Recreate as AFTER INSERT trigger so the parent row exists when the invoice FK is checked
CREATE TRIGGER trigger_auto_generate_fuel_invoice
  AFTER INSERT ON fuel_transactions
  FOR EACH ROW EXECUTE FUNCTION auto_generate_fuel_transaction_invoice();
