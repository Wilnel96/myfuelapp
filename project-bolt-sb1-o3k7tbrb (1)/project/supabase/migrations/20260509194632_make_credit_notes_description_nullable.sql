/*
  # Make credit_notes.description nullable

  The description column has no default and is NOT NULL, but the credit note
  management UI uses line items for item-level descriptions rather than a single
  top-level description field. Making it nullable allows inserts without it.
*/

ALTER TABLE credit_notes ALTER COLUMN description DROP NOT NULL;
