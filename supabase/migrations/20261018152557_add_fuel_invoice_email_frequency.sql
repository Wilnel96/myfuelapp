/*
# Add fuel invoice email frequency setting to organizations

## Purpose
Allows each client organization to choose how quickly the billing user
receives fuel invoice emails after a driver fuels up.

## Options
- `instant`  — email is sent immediately when each fuel transaction is recorded
- `daily`    — all invoices for the day are batched and sent once per day
- `weekly`   — all invoices for the week are batched and sent once per week
- `monthly`  — all invoices for the month are batched and sent once per month
- NULL       — no automatic fuel invoice emails (default, preserves existing behaviour)

## Changes
1. Adds `fuel_invoice_email_frequency TEXT` column to `organizations`.
2. Adds a CHECK constraint limiting the column to the allowed values above.
3. Backfills existing rows to NULL (no emails) so current behaviour is unchanged.
4. Updates the existing organization UPDATE RLS policies are unchanged — the
   column is writable by anyone who can already update the organization row.
*/

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS fuel_invoice_email_frequency TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_fuel_invoice_email_frequency_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_fuel_invoice_email_frequency_check
      CHECK (
        fuel_invoice_email_frequency IS NULL
        OR fuel_invoice_email_frequency IN ('instant', 'daily', 'weekly', 'monthly')
      );
  END IF;
END $$;
