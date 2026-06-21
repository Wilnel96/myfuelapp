/*
  # Add PrDP Requirements to Vehicles

  1. New Columns
    - `prdp_required` (boolean, default false) - Whether this vehicle requires a Professional Driving Permit
    - `prdp_categories` (text[]) - Array of required PrDP categories (Passengers, Goods, Dangerous Goods)
  
  2. Valid PrDP Categories
    - PrDP - Passengers
    - PrDP - Goods
    - PrDP - Dangerous Goods
  
  3. Notes
    - A vehicle can require one or more PrDP categories
    - If prdp_required is true, at least one category must be selected
    - This helps ensure only drivers with the appropriate PrDP are assigned to these vehicles
*/

-- Add prdp_required column
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS prdp_required boolean NOT NULL DEFAULT false;

-- Add prdp_categories column (array of text)
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS prdp_categories text[];

-- Add check constraint to ensure only valid categories
ALTER TABLE vehicles 
ADD CONSTRAINT vehicles_prdp_categories_check 
CHECK (
  prdp_categories IS NULL OR 
  (
    prdp_categories <@ ARRAY[
      'PrDP - Passengers',
      'PrDP - Goods',
      'PrDP - Dangerous Goods'
    ]::text[] AND
    array_length(prdp_categories, 1) > 0
  )
);

-- Add check constraint: if prdp_required is true, prdp_categories must have at least one value
ALTER TABLE vehicles 
ADD CONSTRAINT vehicles_prdp_required_check 
CHECK (
  (prdp_required = false) OR 
  (prdp_required = true AND prdp_categories IS NOT NULL AND array_length(prdp_categories, 1) > 0)
);

-- Add comments for documentation
COMMENT ON COLUMN vehicles.prdp_required IS 'Whether this vehicle requires a Professional Driving Permit (PrDP)';
COMMENT ON COLUMN vehicles.prdp_categories IS 'Array of required PrDP categories: Passengers, Goods, Dangerous Goods. At least one must be selected if prdp_required is true.';
