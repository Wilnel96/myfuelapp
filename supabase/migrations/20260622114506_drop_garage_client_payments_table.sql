/*
  Drop the legacy garage_client_payments table.
  All data has been migrated to garage_debtor_payments.
  All application code now references garage_debtor_payments exclusively.
*/
DROP TABLE IF EXISTS garage_client_payments;