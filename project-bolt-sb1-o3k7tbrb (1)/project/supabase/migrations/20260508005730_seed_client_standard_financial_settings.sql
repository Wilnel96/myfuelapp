/*
  # Seed Client Standard Financial Settings

  Adds default/standard financial settings for client organizations into
  global_settings. These act as system-wide defaults; individual clients
  can have overrides negotiated separately.

  New keys:
  - standard_monthly_fee_per_vehicle   — monthly fee per active vehicle (ZAR)
  - standard_payment_method            — default fee invoice payment method
  - standard_payment_terms             — default payment terms
  - standard_payment_date              — default day-of-month payment is due
  - standard_debit_order_lead_days     — lead days before debit order runs
  - standard_late_payment_interest_rate — annual interest rate on overdue invoices (%)
*/

INSERT INTO global_settings (key, value, description)
VALUES
  ('standard_monthly_fee_per_vehicle',    '10',           'Standard monthly fee charged per active vehicle (ZAR)'),
  ('standard_payment_method',             'Debit Order',  'Standard fee invoice payment method for client organizations'),
  ('standard_payment_terms',              '30-Days',      'Standard payment terms for client fee invoices'),
  ('standard_payment_date',               '1',            'Standard day-of-month on which payment is due (1–31)'),
  ('standard_debit_order_lead_days',      '3',            'Standard number of days before month-end that debit orders are submitted'),
  ('standard_late_payment_interest_rate', '2.5',          'Standard annual interest rate (%) applied to overdue client invoices')
ON CONFLICT (key) DO NOTHING;
