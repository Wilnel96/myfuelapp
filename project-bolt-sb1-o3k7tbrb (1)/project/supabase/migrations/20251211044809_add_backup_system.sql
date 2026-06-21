/*
  # Add Backup System

  1. New Tables
    - `backup_logs`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `created_by` (uuid, references auth.users)
      - `backup_type` (text) - 'full' or 'partial'
      - `tables_included` (text array) - list of tables backed up
      - `file_size` (bigint) - size in bytes
      - `status` (text) - 'pending', 'completed', 'failed'
      - `error_message` (text) - if failed
      - `download_url` (text) - signed URL for download
      
  2. Security
    - Enable RLS on `backup_logs` table
    - Only super admins can create and view backups
*/

CREATE TABLE IF NOT EXISTS backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  backup_type text NOT NULL CHECK (backup_type IN ('full', 'partial')),
  tables_included text[] NOT NULL DEFAULT '{}',
  file_size bigint DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message text,
  download_url text,
  expires_at timestamptz
);

ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view backups
CREATE POLICY "Super admins can view all backups"
  ON backup_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

-- Only super admins can create backups
CREATE POLICY "Super admins can create backups"
  ON backup_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

-- Only super admins can update backup status
CREATE POLICY "Super admins can update backups"
  ON backup_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );