/*
  # Fix Invoice Numbering System

  ## Overview
  This migration fixes the invoice numbering system to use a global sequence instead of per-organization sequences, preventing duplicate invoice numbers.

  ## Changes
  1. Create a global invoice sequence table
  2. Renumber existing invoices with unique sequential numbers
  3. Drop the old per-organization sequence table
  4. Add unique constraint on invoice_number

  ## Details
  - Invoice numbers will be globally unique across all organizations
  - Existing invoices are renumbered starting from 000001
  - The new system ensures data integrity and prevents duplicates
*/

-- Create global invoice sequence table
CREATE TABLE IF NOT EXISTS invoice_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_number integer NOT NULL DEFAULT 0,
  prefix text NOT NULL DEFAULT 'INV-',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row_check CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Insert the initial global sequence record
INSERT INTO invoice_sequence (id, current_number, prefix)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 0, 'INV-')
ON CONFLICT (id) DO NOTHING;

-- Renumber existing invoices with unique sequential numbers
DO $$
DECLARE
  inv_record RECORD;
  counter integer := 0;
BEGIN
  -- Loop through all invoices ordered by created_at
  FOR inv_record IN 
    SELECT id 
    FROM invoices 
    ORDER BY created_at, id
  LOOP
    counter := counter + 1;
    
    -- Update invoice with new unique number
    UPDATE invoices 
    SET invoice_number = 'INV-' || LPAD(counter::text, 6, '0')
    WHERE id = inv_record.id;
  END LOOP;
  
  -- Update the global sequence to the last used number
  UPDATE invoice_sequence 
  SET current_number = counter
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
END $$;

-- Add unique constraint to invoice_number if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_invoice_number_unique'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);
  END IF;
END $$;

-- Drop the old per-organization sequences table
DROP TABLE IF EXISTS invoice_sequences CASCADE;

-- Create function to get next invoice number
CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num integer;
  invoice_num text;
  prefix_val text;
BEGIN
  -- Lock the row to prevent concurrent access
  SELECT current_number, prefix INTO next_num, prefix_val
  FROM invoice_sequence
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
  FOR UPDATE;
  
  -- Increment the number
  next_num := next_num + 1;
  
  -- Update the sequence
  UPDATE invoice_sequence
  SET current_number = next_num,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
  
  -- Format and return the invoice number
  invoice_num := prefix_val || LPAD(next_num::text, 6, '0');
  
  RETURN invoice_num;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_next_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_invoice_number() TO service_role;
