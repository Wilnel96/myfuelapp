/*
# Add email_sent_at tracking column to fuel_transaction_invoices

## Purpose
Tracks whether and when a fuel transaction invoice was emailed to the billing
user. Used by the instant-sending path and the daily/weekly/monthly digest
function to avoid sending the same invoice twice.

## Changes
1. Adds `email_sent_at timestamptz` (nullable) to `fuel_transaction_invoices`.
   NULL means the invoice has not been emailed yet.
*/

ALTER TABLE fuel_transaction_invoices
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
