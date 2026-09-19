-- F4: stored card records (encrypted PAN/CVV/PIN and key ids) were readable by any anonymous caller.

DROP POLICY IF EXISTS "Anonymous drivers can read org payment cards" ON public.organization_payment_cards;

CREATE POLICY "payment_cards_select_driver_own_org_anon"
  ON public.organization_payment_cards
  FOR SELECT
  TO anon
  USING (organization_id = public.current_driver_org_id());
