/*
  # Add is_main_user column to organization_users

  1. Changes
    - Add `is_main_user` boolean column to organization_users table
    - Default to false for existing records
    - Add constraint to ensure only one main user per organization

  2. Purpose
    - Track which user is the primary/main user for an organization
    - Enable main user functionality in the edge function
*/

-- Add is_main_user column
ALTER TABLE organization_users 
ADD COLUMN IF NOT EXISTS is_main_user boolean DEFAULT false;

-- Create unique index to ensure only one main user per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_main_user_per_org 
ON organization_users (organization_id) 
WHERE is_main_user = true;
