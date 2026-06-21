
-- Change default spending limits to NULL (unlimited) so new drivers have no restrictions by default
ALTER TABLE driver_payment_settings 
  ALTER COLUMN daily_spending_limit SET DEFAULT NULL,
  ALTER COLUMN monthly_spending_limit SET DEFAULT NULL;
