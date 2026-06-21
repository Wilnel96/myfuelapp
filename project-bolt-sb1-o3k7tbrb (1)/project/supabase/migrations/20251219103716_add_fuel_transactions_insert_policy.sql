/*
  # Add INSERT Policy for Fuel Transactions

  1. Changes
    - Add INSERT policy to allow authenticated users to create fuel transactions
    - Policy allows users to insert transactions for their organization
    - Also allows management org users to insert any transaction
  
  2. Security
    - Users can only create transactions for their own organization
    - Management org users can create transactions for any organization
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fuel_transactions' 
    AND policyname = 'fuel_transactions_insert_policy'
  ) THEN
    CREATE POLICY "fuel_transactions_insert_policy"
      ON fuel_transactions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- User belongs to the organization
        organization_id IN (
          SELECT organization_id 
          FROM profiles 
          WHERE id = auth.uid()
        )
        OR
        -- Or user is from management organization
        EXISTS (
          SELECT 1 
          FROM profiles p
          JOIN organizations o ON p.organization_id = o.id
          WHERE p.id = auth.uid() 
          AND o.is_management_org = true
        )
      );
  END IF;
END $$;
