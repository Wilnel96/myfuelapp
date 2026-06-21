/*
  # Fix Payment Method Constraint

  1. Changes
    - Update payment_method check constraint to accept lowercase values that match frontend
    - Allow: 'eft', 'cash', 'cheque', 'card', 'other'
*/

-- Drop the existing constraint
ALTER TABLE garage_debtor_payments 
  DROP CONSTRAINT IF EXISTS garage_debtor_payments_payment_method_check;

-- Add new constraint with lowercase values
ALTER TABLE garage_debtor_payments
  ADD CONSTRAINT garage_debtor_payments_payment_method_check
  CHECK (payment_method IN ('eft', 'cash', 'cheque', 'card', 'other'));