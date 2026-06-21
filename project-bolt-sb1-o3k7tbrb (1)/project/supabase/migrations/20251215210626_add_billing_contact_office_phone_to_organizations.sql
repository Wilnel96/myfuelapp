/*
  # Add billing contact office phone to organizations

  1. Changes
    - Add `billing_contact_phone_office` column to organizations table
    - This field stores the office phone number for billing contacts
    - Nullable to allow for gradual data population
*/

-- Add billing contact office phone column
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS billing_contact_phone_office text;
