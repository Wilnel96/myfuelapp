/*
  # Remove blanket read access to card payment records

  1. Problem
     - "Users can view nfc transactions" was `USING (true)` for authenticated, so any
       signed-in account could read every card payment attempt, including amounts,
       locations and device details.

  2. Changes
     - Drop it. The remaining policy already limits access to the driver who owns the
       transaction, their organization's reporting users and platform operators.
*/

DROP POLICY IF EXISTS "Users can view nfc transactions" ON nfc_payment_transactions;
