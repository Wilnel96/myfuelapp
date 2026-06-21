/*
  # Add billing contact mobile phone to organizations

  1. Changes
    - Add `billing_contact_phone_mobile` column to organizations table
    - This field stores the mobile phone number for billing contacts
    - Nullable to allow for gradual data population
*/

-- Add billing contact mobile phone column
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS billing_contact_phone_mobile text;
