/*
  # Make credit_notes.amount nullable

  The amount column was the original single-value field before subtotal/vat_amount/total_amount
  were added. Since the new columns carry the financial data, amount is now redundant and
  should be nullable to avoid insert failures.
*/

ALTER TABLE credit_notes ALTER COLUMN amount DROP NOT NULL;
