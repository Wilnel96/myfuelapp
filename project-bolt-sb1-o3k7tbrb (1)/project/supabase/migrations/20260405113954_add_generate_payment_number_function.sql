/*
  # Add Payment Number Generation Function

  1. New Function
    - `generate_payment_number` - Generates unique payment numbers for garage debtor payments
      - Format: PAY-{garage_id_prefix}-{org_id_prefix}-{sequential_number}
      - Ensures uniqueness per garage-organization combination
  
  2. Purpose
    - Provides auto-incrementing payment reference numbers
    - Makes it easy to track and reference payments
    - Follows similar pattern to invoice numbering
*/

-- Function to generate unique payment numbers
CREATE OR REPLACE FUNCTION generate_payment_number(
  p_garage_id uuid,
  p_organization_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_number text;
  v_next_number integer;
  v_garage_prefix text;
  v_org_prefix text;
BEGIN
  -- Get the count of existing payments for this garage-org combination
  SELECT COUNT(*) + 1
  INTO v_next_number
  FROM garage_debtor_payments
  WHERE garage_id = p_garage_id
    AND organization_id = p_organization_id;

  -- Create prefixes from UUIDs (first 4 chars)
  v_garage_prefix := SUBSTRING(p_garage_id::text, 1, 4);
  v_org_prefix := SUBSTRING(p_organization_id::text, 1, 4);

  -- Generate payment number: PAY-{garage}-{org}-{number}
  v_payment_number := 'PAY-' || UPPER(v_garage_prefix) || '-' || UPPER(v_org_prefix) || '-' || LPAD(v_next_number::text, 6, '0');

  -- Ensure uniqueness (in case of race conditions)
  WHILE EXISTS (
    SELECT 1 
    FROM garage_debtor_payments 
    WHERE payment_number = v_payment_number
  ) LOOP
    v_next_number := v_next_number + 1;
    v_payment_number := 'PAY-' || UPPER(v_garage_prefix) || '-' || UPPER(v_org_prefix) || '-' || LPAD(v_next_number::text, 6, '0');
  END LOOP;

  RETURN v_payment_number;
END;
$$;

-- Grant execute permission to authenticated users and anon
GRANT EXECUTE ON FUNCTION generate_payment_number(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payment_number(uuid, uuid) TO anon;