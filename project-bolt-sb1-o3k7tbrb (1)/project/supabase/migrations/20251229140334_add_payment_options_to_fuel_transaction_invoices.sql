/*
  # Add Payment Options to Fuel Transaction Invoices

  ## Overview
  This migration adds payment option tracking fields to the fuel_transaction_invoices table
  to record the payment configuration that was in effect when the invoice was generated.

  ## New Columns
  1. `payment_option` (text, nullable)
     - Values: 'EFT Payment', 'Card Payment', 'Local Account'
     - Records which payment option was configured for the organization at invoice creation
  
  2. `fuel_payment_terms` (text, nullable)
     - Values: 'Same Day', 'Next Day', '30-Days'
     - Only applicable when payment_option is 'EFT Payment'
     - Records the fuel payment terms from the organization
  
  3. `fuel_payment_interest_rate` (numeric, nullable)
     - Percentage value for interest charges
     - Only applicable when fuel_payment_terms requires interest
     - Records the interest rate from the organization

  ## Changes
  - Add payment_option column with check constraint
  - Add fuel_payment_terms column with check constraint
  - Add fuel_payment_interest_rate column
  - Add helpful column comments

  ## Notes
  - These fields are historical records - they capture the payment configuration at the time of invoice generation
  - Changes to organization payment settings don't affect existing invoices
  - Null values indicate invoices created before this feature was implemented
*/

-- Add payment_option column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transaction_invoices' AND column_name = 'payment_option'
  ) THEN
    ALTER TABLE fuel_transaction_invoices ADD COLUMN payment_option text CHECK (
      payment_option IN ('EFT Payment', 'Card Payment', 'Local Account')
    );
    
    COMMENT ON COLUMN fuel_transaction_invoices.payment_option IS 
      'Payment option that was configured for the organization at the time of invoice generation';
  END IF;
END $$;

-- Add fuel_payment_terms column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transaction_invoices' AND column_name = 'fuel_payment_terms'
  ) THEN
    ALTER TABLE fuel_transaction_invoices ADD COLUMN fuel_payment_terms text CHECK (
      fuel_payment_terms IN ('Same Day', 'Next Day', '30-Days')
    );
    
    COMMENT ON COLUMN fuel_transaction_invoices.fuel_payment_terms IS 
      'Fuel payment terms for EFT Payment option at the time of invoice generation';
  END IF;
END $$;

-- Add fuel_payment_interest_rate column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fuel_transaction_invoices' AND column_name = 'fuel_payment_interest_rate'
  ) THEN
    ALTER TABLE fuel_transaction_invoices ADD COLUMN fuel_payment_interest_rate numeric(5,2);
    
    COMMENT ON COLUMN fuel_transaction_invoices.fuel_payment_interest_rate IS 
      'Interest rate percentage that was configured at the time of invoice generation';
  END IF;
END $$;
