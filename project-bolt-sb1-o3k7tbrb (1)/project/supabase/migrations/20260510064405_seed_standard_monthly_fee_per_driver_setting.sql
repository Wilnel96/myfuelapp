/*
  # Seed standard_monthly_fee_per_driver global setting

  Adds the standard_monthly_fee_per_driver key to global_settings so it appears
  in the Client Standard Financial Settings screen alongside the vehicle fee.
  Default is 0 to avoid accidental charges before the rate is configured.
*/

INSERT INTO global_settings (key, value, description)
VALUES ('standard_monthly_fee_per_driver', '0', 'Standard monthly fee charged per active driver')
ON CONFLICT (key) DO NOTHING;
