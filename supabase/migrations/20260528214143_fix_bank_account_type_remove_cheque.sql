/*
  # Fix bank_account_type in global_settings

  Removes the incorrect "Cheque" value — South Africa does not use cheque accounts.
  The account type will be updated through the Back Office financial settings UI.
*/
UPDATE global_settings SET value = '' WHERE key = 'bank_account_type' AND value = 'Cheque';
