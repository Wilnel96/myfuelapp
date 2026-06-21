/*
  # Add Payment Options to Organizations

  ## Overview
  This migration adds payment configuration fields to the organizations table to
  track how each client organization pays for fuel.

  ## New Columns
  1. `payment_option` (text, nullable)
     - Values: 'EFT Payment', 'Card Payment', 'Local Account'
     - Records which payment method the organization uses

  2. `fuel_payment_terms` (text, nullable)
     - Values: 'Same Day', 'Next Day', '30-Days'
     - Only applicable when payment_option is 'EFT Payment'

  3. `fuel_payment_interest_rate` (numeric, nullable)
     - Percentage value for interest charges
     - Only applicable when fuel_payment_terms requires interest (not 'Same Day')

  ## Changes
  - Add payment_option column with check constraint
  - Add fuel_payment_terms column with check constraint
  - Add fuel_payment_interest_rate column
  - Create index for filtering organizations by payment option

  ## Notes
  - All columns are nullable to allow for gradual data population
  - Existing organizations will have NULL values until updated
*/

-- Add payment_option column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'payment_option'
  ) THEN
    ALTER TABLE organizations ADD COLUMN payment_option text CHECK (
      payment_option IN ('EFT Payment', 'Card Payment', 'Local Account')
    );

    COMMENT ON COLUMN organizations.payment_option IS
      'Payment method used by the organization: EFT Payment, Card Payment, or Local Account';
  END IF;
END $$;

-- Add fuel_payment_terms column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'fuel_payment_terms'
  ) THEN
    ALTER TABLE organizations ADD COLUMN fuel_payment_terms text CHECK (
      fuel_payment_terms IN ('Same Day', 'Next Day', '30-Days')
    );

    COMMENT ON COLUMN organizations.fuel_payment_terms IS
      'Fuel payment terms for EFT Payment option. Only applicable when payment_option is EFT Payment';
  END IF;
END $$;

-- Add fuel_payment_interest_rate column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'fuel_payment_interest_rate'
  ) THEN
    ALTER TABLE organizations ADD COLUMN fuel_payment_interest_rate numeric(5,2);

    COMMENT ON COLUMN organizations.fuel_payment_interest_rate IS
      'Interest rate percentage applied to fuel payments when terms are not Same Day';
  END IF;
END $$;

-- Create index for payment option queries
CREATE INDEX IF NOT EXISTS organizations_payment_option_idx ON organizations(payment_option)
WHERE payment_option IS NOT NULL;