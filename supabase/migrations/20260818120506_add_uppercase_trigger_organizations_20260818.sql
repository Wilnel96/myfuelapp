-- Auto-uppercase text fields on organizations table for every INSERT and UPDATE
-- Covers: address, city, postal code, country, registration/VAT numbers, bank details,
-- phone numbers, entity type, etc. Leaves website and email untouched (case-sensitive).

CREATE OR REPLACE FUNCTION public.uppercase_organization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Uppercase text fields that should be uppercase (exclude website, email, province, dropdowns)
  NEW.name := UPPER(NEW.name);
  NEW.company_registration_number := UPPER(NEW.company_registration_number);
  NEW.vat_number := UPPER(NEW.vat_number);
  NEW.address_line_1 := UPPER(NEW.address_line_1);
  NEW.address_line_2 := UPPER(NEW.address_line_2);
  NEW.city := UPPER(NEW.city);
  NEW.postal_code := UPPER(NEW.postal_code);
  NEW.country := UPPER(NEW.country);
  NEW.bank_name := UPPER(NEW.bank_name);
  NEW.bank_account_holder := UPPER(NEW.bank_account_holder);
  NEW.bank_account_number := UPPER(NEW.bank_account_number);
  NEW.bank_branch_code := UPPER(NEW.bank_branch_code);
  NEW.bank_name_2 := UPPER(NEW.bank_name_2);
  NEW.bank_account_holder_2 := UPPER(NEW.bank_account_holder_2);
  NEW.bank_account_number_2 := UPPER(NEW.bank_account_number_2);
  NEW.bank_branch_code_2 := UPPER(NEW.bank_branch_code_2);
  NEW.phone_number := UPPER(NEW.phone_number);
  NEW.entity_type_other := UPPER(NEW.entity_type_other);
  -- website is intentionally left as-is (case-sensitive URLs)
  -- province, bank_account_type, payment_method, etc. are dropdown values, leave as-is
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uppercase_organizations ON public.organizations;

CREATE TRIGGER trg_uppercase_organizations
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_organization_fields();
