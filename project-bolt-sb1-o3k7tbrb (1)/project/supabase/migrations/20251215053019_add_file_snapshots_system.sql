/*
  # Add File Snapshots System

  1. New Tables
    - `file_snapshots`
      - `id` (uuid, primary key) - Unique identifier
      - `snapshot_group_id` (uuid) - Groups files from the same snapshot session
      - `file_path` (text) - Relative path of the file
      - `file_content` (text) - The actual file content
      - `file_size` (bigint) - Size of the file in bytes
      - `created_at` (timestamptz) - When the snapshot was created

    - `snapshot_groups`
      - `id` (uuid, primary key) - Unique identifier for the snapshot group
      - `name` (text) - Name/label for this snapshot
      - `description` (text) - Optional description
      - `total_files` (integer) - Number of files in this snapshot
      - `total_size` (bigint) - Total size in bytes
      - `created_by` (uuid) - User who created the snapshot
      - `created_at` (timestamptz) - When the snapshot was created

  2. Security
    - Enable RLS on both tables
    - Super admins and admins can manage all snapshots
*/

-- Create snapshot groups table
CREATE TABLE IF NOT EXISTS snapshot_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  total_files integer DEFAULT 0,
  total_size bigint DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create file snapshots table
CREATE TABLE IF NOT EXISTS file_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_group_id uuid NOT NULL REFERENCES snapshot_groups(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_content text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_file_snapshots_group_id ON file_snapshots(snapshot_group_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_groups_created_at ON snapshot_groups(created_at DESC);

-- Enable RLS
ALTER TABLE snapshot_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies for snapshot_groups
CREATE POLICY "Super admins and admins can view all snapshot groups"
  ON snapshot_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins and admins can create snapshot groups"
  ON snapshot_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins can delete snapshot groups"
  ON snapshot_groups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policies for file_snapshots
CREATE POLICY "Super admins and admins can view all file snapshots"
  ON file_snapshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins and admins can create file snapshots"
  ON file_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins can delete file snapshots"
  ON file_snapshots FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );