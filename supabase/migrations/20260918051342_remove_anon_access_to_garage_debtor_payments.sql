-- F13 and F33: anonymous callers could insert payments against any garage account and read
-- every garage's payment history. The garage portal signs in with real authentication,
-- so no anonymous access to this table is needed.

DROP POLICY IF EXISTS "Garages can insert own payments (anon)" ON public.garage_debtor_payments;
DROP POLICY IF EXISTS "Garages can view own payments (anon)" ON public.garage_debtor_payments;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.garage_debtor_payments FROM anon;
