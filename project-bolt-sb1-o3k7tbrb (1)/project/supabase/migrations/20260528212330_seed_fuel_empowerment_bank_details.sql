/*
  # Seed Fuel Empowerment Systems bank details into global_settings

  Adds the following keys if they do not already exist:
  - company_name: Legal entity name for debit order authorisation
  - bank_name
  - bank_account_holder
  - bank_account_number
  - bank_branch_code
  - bank_account_type

  These are displayed on the client signup form so new clients know
  who to authorise the debit order to.
*/

INSERT INTO global_settings (key, value, description)
VALUES
  ('company_name',         'Fuel Empowerment Systems (Pty) Ltd', 'Legal company name used on debit order authorisations'),
  ('bank_name',            'FNB',                                'Bank name for debit order collections'),
  ('bank_account_holder',  'Fuel Empowerment Systems (Pty) Ltd', 'Bank account holder name'),
  ('bank_account_number',  '',                                   'Bank account number for debit order collections'),
  ('bank_branch_code',     '',                                   'Universal branch code for debit order collections'),
  ('bank_account_type',    'Cheque',                             'Bank account type (Cheque / Savings)')
ON CONFLICT (key) DO NOTHING;
