/*
  # Fix auto-generate fuel invoice trigger

  ## Problem
  The trigger was failing silently because it referenced `billing_contact_email`
  on the organizations table, which no longer exists (removed in a prior migration).
  This caused every fuel transaction to be created without an invoice.

  ## Fix
  - Replace the broken email lookup with a query against organization_users,
    fetching the main user's email (same pattern used elsewhere in the app).
  - Also include payment_option, fuel_payment_terms, fuel_payment_interest_rate
    from organizations so invoices have complete payment info.
  - Use ROUND(..., 2) on calculated amounts to prevent floating-point artifacts.
*/

CREATE OR REPLACE FUNCTION auto_generate_fuel_transaction_invoice()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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
  -- Only proceed if invoice hasn't been generated yet
  IF NEW.invoice_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get vehicle registration
  SELECT registration_number INTO v_vehicle_registration
  FROM vehicles
  WHERE id = NEW.vehicle_id;

  -- Get driver name
  SELECT first_name || ' ' || surname INTO v_driver_name
  FROM drivers
  WHERE id = NEW.driver_id;

  -- Get garage information
  SELECT
    name,
    COALESCE(
      address_line_1 || COALESCE(', ' || address_line_2, '') || ', ' || city,
      'Not recorded'
    ),
    COALESCE(vat_number, '')
  INTO v_garage_name, v_garage_address, v_garage_vat_number
  FROM garages
  WHERE id = NEW.garage_id;

  -- Get billing email from main user of the organization
  SELECT email INTO v_billing_email
  FROM organization_users
  WHERE organization_id = NEW.organization_id
    AND is_main_user = true
  LIMIT 1;

  -- Fallback to any active user if no main user found
  IF v_billing_email IS NULL THEN
    SELECT email INTO v_billing_email
    FROM organization_users
    WHERE organization_id = NEW.organization_id
      AND (active IS NULL OR active = true)
    LIMIT 1;
  END IF;

  -- Get organization payment settings
  SELECT payment_option, fuel_payment_terms, fuel_payment_interest_rate
  INTO v_payment_option, v_fuel_payment_terms, v_fuel_payment_interest_rate
  FROM organizations
  WHERE id = NEW.organization_id;

  -- Calculate amounts with proper rounding to avoid floating-point artifacts
  v_fuel_amount := ROUND((NEW.liters * NEW.price_per_liter)::numeric, 2);
  v_oil_vat_amount := CASE
    WHEN COALESCE(NEW.oil_quantity, 0) > 0
    THEN ROUND((NEW.oil_total_amount - (NEW.oil_total_amount / 1.15))::numeric, 2)
    ELSE 0
  END;

  -- Generate invoice number
  v_invoice_number := generate_fuel_invoice_number();

  -- Insert invoice
  INSERT INTO fuel_transaction_invoices (
    fuel_transaction_id,
    organization_id,
    invoice_number,
    invoice_date,
    fuel_type,
    liters,
    price_per_liter,
    fuel_amount,
    subtotal,
    vat_rate,
    vat_amount,
    items_subtotal_excl_vat,
    items_vat_amount,
    items_total_incl_vat,
    total_amount,
    vehicle_registration,
    driver_name,
    garage_name,
    garage_address,
    garage_vat_number,
    odometer_reading,
    transaction_date,
    email_recipient,
    oil_quantity,
    oil_unit_price,
    oil_total_amount,
    oil_type,
    oil_brand,
    payment_option,
    fuel_payment_terms,
    fuel_payment_interest_rate
  ) VALUES (
    NEW.id,
    NEW.organization_id,
    v_invoice_number,
    NOW(),
    NEW.fuel_type,
    NEW.liters,
    NEW.price_per_liter,
    v_fuel_amount,
    v_fuel_amount,
    0,
    v_oil_vat_amount,
    COALESCE(NEW.items_subtotal_excl_vat, 0),
    COALESCE(NEW.items_vat_amount, 0),
    COALESCE(NEW.items_total_incl_vat, 0),
    NEW.total_amount,
    v_vehicle_registration,
    v_driver_name,
    COALESCE(v_garage_name, 'Not recorded'),
    COALESCE(v_garage_address, 'Not recorded'),
    COALESCE(v_garage_vat_number, ''),
    NEW.odometer_reading,
    NEW.transaction_date,
    v_billing_email,
    COALESCE(NEW.oil_quantity, 0),
    COALESCE(NEW.oil_unit_price, 0),
    COALESCE(NEW.oil_total_amount, 0),
    NEW.oil_type,
    NEW.oil_brand,
    v_payment_option,
    v_fuel_payment_terms,
    v_fuel_payment_interest_rate
  )
  RETURNING id INTO v_new_invoice_id;

  -- Link invoice back to fuel transaction
  NEW.invoice_id := v_new_invoice_id;

  RAISE NOTICE 'Auto-generated invoice % for transaction %', v_invoice_number, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to auto-generate invoice for transaction %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;
