-- Add VIN number column to trailers table
ALTER TABLE trailers ADD COLUMN IF NOT EXISTS vin_number TEXT;

-- VIN is optional since not all trailers may have it recorded yet
-- Create index for VIN lookups
CREATE INDEX IF NOT EXISTS idx_trailers_vin_number ON trailers(vin_number) WHERE vin_number IS NOT NULL;
