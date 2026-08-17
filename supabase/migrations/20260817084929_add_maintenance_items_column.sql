/*
# Add maintenance_items column to vehicle_maintenance_records

## Purpose
Stores an array of selected maintenance sub-item types (e.g. "Oil Change", "Brake Pads", "Tire Replacement")
so users can tag each record with the specific work performed, with multiple selections allowed.

## Changes
- New column: maintenance_items (text[], nullable, default NULL)
  Stores a Postgres array of selected item labels.
- No RLS policy changes needed — the column is accessed through existing policies.
*/

ALTER TABLE vehicle_maintenance_records
  ADD COLUMN IF NOT EXISTS maintenance_items text[] DEFAULT NULL;
