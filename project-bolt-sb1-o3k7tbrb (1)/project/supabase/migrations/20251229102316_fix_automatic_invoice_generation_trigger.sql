/*
  # Fix Automatic Invoice Generation Trigger
  
  1. Changes
    - Updates the trigger function to include missing columns
    - Adds items_subtotal_excl_vat, items_vat_amount, items_total_incl_vat columns
    - These columns were missing and causing silent failures
    
  2. Security
    - Maintains SECURITY DEFINER for proper permissions
    - Improves error handling with better logging
*/

-- Update the trigger function to include all required columns
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
    COALESCE(address_line_1 || ', ' || COALESCE(address_line_2 || ', ', '') || city || ', ' || province || ' ' || postal_code, 'Not recorded'),
    COALESCE(vat_number, '')
  INTO v_garage_name, v_garage_address, v_garage_vat_number
  FROM garages
  WHERE id = NEW.garage_id;

  -- Get organization billing email
  SELECT billing_contact_email INTO v_billing_email
  FROM organizations
  WHERE id = NEW.organization_id;

  -- Calculate amounts
  v_fuel_amount := NEW.liters * NEW.price_per_liter;
  v_oil_vat_amount := CASE 
    WHEN COALESCE(NEW.oil_quantity, 0) > 0 
    THEN NEW.oil_total_amount - (NEW.oil_total_amount / 1.15)
    ELSE 0
  END;

  -- Generate invoice number
  v_invoice_number := generate_fuel_invoice_number();

  -- Insert invoice with all required columns
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
    oil_brand
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
    NEW.oil_brand
  )
  RETURNING id INTO v_new_invoice_id;

  -- Update the fuel transaction with the invoice ID
  NEW.invoice_id := v_new_invoice_id;

  RAISE NOTICE 'Auto-generated invoice % for transaction %', v_invoice_number, NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log detailed error information
    RAISE WARNING 'Failed to auto-generate invoice for transaction %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Verify trigger still exists
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'trigger_auto_generate_fuel_invoice';
