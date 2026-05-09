/*
  # Add missing columns to credit_notes table

  The credit_notes table was created with a minimal schema. This migration adds
  the columns needed by the full credit note management UI:
  - subtotal, vat_rate, total_amount (financial breakdown)
  - issued_by (alias-style — added as column, created_by already exists)
  - notes (internal notes)
  - issued_at (timestamp when issued)

  We keep the existing `amount` and `created_by` columns intact.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_notes' AND column_name = 'subtotal') THEN
    ALTER TABLE credit_notes ADD COLUMN subtotal numeric(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_notes' AND column_name = 'vat_rate') THEN
    ALTER TABLE credit_notes ADD COLUMN vat_rate numeric(6,4) NOT NULL DEFAULT 0.15;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_notes' AND column_name = 'total_amount') THEN
    ALTER TABLE credit_notes ADD COLUMN total_amount numeric(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_notes' AND column_name = 'issued_by') THEN
    ALTER TABLE credit_notes ADD COLUMN issued_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_notes' AND column_name = 'notes') THEN
    ALTER TABLE credit_notes ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_notes' AND column_name = 'issued_at') THEN
    ALTER TABLE credit_notes ADD COLUMN issued_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Backfill total_amount and subtotal from existing amount column
UPDATE credit_notes
SET
  total_amount = COALESCE(amount, 0),
  subtotal = ROUND(COALESCE(amount, 0) / 1.15, 2),
  vat_amount = ROUND(COALESCE(amount, 0) - ROUND(COALESCE(amount, 0) / 1.15, 2), 2)
WHERE total_amount = 0 AND amount IS NOT NULL AND amount > 0;
