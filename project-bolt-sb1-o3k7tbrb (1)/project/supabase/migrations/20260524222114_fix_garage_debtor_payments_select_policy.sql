/*
  # Fix garage_debtor_payments SELECT RLS policy

  ## Problem
  The "Garages can view own payments" policy checks `garages.id = auth.uid()`
  which is never true — auth.uid() is a user UUID, not a garage UUID.
  This means garage users get zero rows back when querying payments.

  ## Fix
  Replace the broken policy with one that checks membership via
  organization_users (same pattern used by garage_statements).
*/

DROP POLICY IF EXISTS "Garages can view own payments" ON garage_debtor_payments;

CREATE POLICY "Garage users can view own payments"
  ON garage_debtor_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_users ou
      JOIN garages g ON g.organization_id = ou.organization_id
      WHERE ou.user_id = auth.uid()
        AND ou.role = 'garage_user'
        AND ou.is_active = true
        AND g.id = garage_debtor_payments.garage_id
    )
  );
