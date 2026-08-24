/*
# Auto-uppercase text fields on vehicle_maintenance_records

## Summary
Adds a BEFORE INSERT OR UPDATE trigger that uppercases the description and workshop
fields on every maintenance record, matching the pattern already used for organizations.

## Changes
1. New function: uppercase_maintenance_fields()
2. New trigger: trg_uppercase_maintenance on vehicle_maintenance_records
*/

CREATE OR REPLACE FUNCTION public.uppercase_maintenance_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.description := UPPER(NEW.description);
  NEW.workshop := UPPER(NEW.workshop);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uppercase_maintenance ON public.vehicle_maintenance_records;

CREATE TRIGGER trg_uppercase_maintenance
  BEFORE INSERT OR UPDATE ON public.vehicle_maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_maintenance_fields();
