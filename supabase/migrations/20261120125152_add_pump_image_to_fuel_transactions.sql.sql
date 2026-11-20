/*
# Add pump display photo to fuel transactions

1. Modified Tables
- `fuel_transactions`: new nullable `pump_image` column (text).
  - Stores a compressed JPEG data-URL of the photo the driver took of the
    pump display during the "Scan Pump" flow, as proof of the refuel.
  - Follows the same storage pattern as the existing `license_disk_image`
    column. Nullable: transactions created without a pump scan stay null.

2. Security
- No policy changes. The table's existing RLS policies and grants apply to
  the new column automatically.
*/

ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS pump_image text;
