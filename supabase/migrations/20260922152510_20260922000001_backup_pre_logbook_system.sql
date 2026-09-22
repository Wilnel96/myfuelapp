/*
# Backup snapshot before Logbook system changes

1. Purpose
- This migration creates a backup record of the current database schema state
  before introducing the trip_logbook_entries table and related changes.
- No data is modified or deleted. This is a metadata-only backup for revert purposes.

2. What is backed up
- Records the current table list and column definitions for vehicle_transactions,
  drivers, and vehicles tables in a backup_log table for reference.

3. Notes
- This does NOT modify any existing tables or data.
- To revert the logbook changes, simply drop the trip_logbook_entries table.
*/

-- Create a backup metadata table to store schema snapshot
CREATE TABLE IF NOT EXISTS _schema_backup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_name text NOT NULL,
  table_name text NOT NULL,
  column_info jsonb,
  created_at timestamptz DEFAULT now()
);

-- Snapshot vehicle_transactions columns
INSERT INTO _schema_backup_log (backup_name, table_name, column_info)
SELECT
  'pre_logbook_system_20260922',
  'vehicle_transactions',
  jsonb_agg(jsonb_build_object(
    'column', column_name,
    'type', data_type,
    'nullable', is_nullable,
    'default', column_default
  ))
FROM information_schema.columns
WHERE table_name = 'vehicle_transactions';

-- Snapshot drivers columns
INSERT INTO _schema_backup_log (backup_name, table_name, column_info)
SELECT
  'pre_logbook_system_20260922',
  'drivers',
  jsonb_agg(jsonb_build_object(
    'column', column_name,
    'type', data_type,
    'nullable', is_nullable,
    'default', column_default
  ))
FROM information_schema.columns
WHERE table_name = 'drivers';

-- Snapshot vehicles columns
INSERT INTO _schema_backup_log (backup_name, table_name, column_info)
SELECT
  'pre_logbook_system_20260922',
  'vehicles',
  jsonb_agg(jsonb_build_object(
    'column', column_name,
    'type', data_type,
    'nullable', is_nullable,
    'default', column_default
  ))
FROM information_schema.columns
WHERE table_name = 'vehicles';
