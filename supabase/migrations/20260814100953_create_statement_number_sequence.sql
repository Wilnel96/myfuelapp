/*
# Create Statement Number Sequence

1. New Tables
- `statement_sequence`: Single-row counter table for statement numbering, mirrors `invoice_sequence`.

2. New Functions
- `get_next_statement_number()`: SECURITY DEFINER function that increments and returns the next statement number in format STMT-YYYYMM-000001.

3. Security
- Function is SECURITY DEFINER, search_path = public, pg_temp.
- Execute granted to authenticated and service_role only.
*/

CREATE TABLE IF NOT EXISTS statement_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_number integer NOT NULL DEFAULT 0,
  prefix text NOT NULL DEFAULT 'STMT'
);

INSERT INTO statement_sequence (current_number, prefix)
SELECT 0, 'STMT'
WHERE NOT EXISTS (SELECT 1 FROM statement_sequence);

CREATE OR REPLACE FUNCTION public.get_next_statement_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_number INTEGER;
  stmt_number TEXT;
  current_year TEXT;
  current_month TEXT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  current_month := TO_CHAR(NOW(), 'MM');
  
  UPDATE public.statement_sequence
  SET current_number = current_number + 1
  WHERE id = (SELECT id FROM public.statement_sequence LIMIT 1)
  RETURNING current_number INTO next_number;
  
  IF next_number IS NULL THEN
    INSERT INTO public.statement_sequence (current_number, prefix)
    VALUES (1, 'STMT')
    RETURNING current_number INTO next_number;
  END IF;
  
  stmt_number := 'STMT-' || current_year || current_month || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN stmt_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_next_statement_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_statement_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_statement_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_statement_number() TO service_role;
