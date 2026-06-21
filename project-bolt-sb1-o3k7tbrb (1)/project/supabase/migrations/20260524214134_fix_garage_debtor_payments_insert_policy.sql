/*
  # Fix garage_debtor_payments INSERT RLS policy

  ## Problem
  The "Garages can insert own payments" policy for authenticated users checks
  `garages.id = auth.uid()`, which is never true — auth.uid() is a user UUID,
  not a garage UUID. This caused every payment insert to fail with an RLS
  violation for any logged-in garage user.

  ## Fix
  Drop the broken policy and replace it with one that correctly checks
  membership via organization_users (same pattern used by garage_statements).
  Also covers management/back-office users who record payments on behalf of
  a garage account.
*/

-- Drop the broken policy
DROP POLICY IF EXISTS "Garages can insert own payments" ON garage_debtor_payments;

-- Garage users: can insert payments for their own garage
CREATE POLICY "Garage users can insert own payments"
  ON garage_debtor_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
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

-- Management/client org users: can insert payments for garages linked to their org
CREATE POLICY "Org users can insert payments for their garage accounts"
  ON garage_debtor_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.organization_id = garage_debtor_payments.organization_id
        AND ou.is_active = true
    )
  );
