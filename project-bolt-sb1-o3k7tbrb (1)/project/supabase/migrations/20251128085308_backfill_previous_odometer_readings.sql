/*
  # Backfill Previous Odometer Readings
  
  1. Purpose
    - Populate `previous_odometer_reading` for existing fuel transactions
    - Uses chronological order per vehicle to determine previous readings
    
  2. Logic
    - For each vehicle, order transactions by date
    - Set previous_odometer_reading to the odometer_reading of the prior transaction
    - First transaction for each vehicle will have NULL (no previous reading)
    
  3. Notes
    - Only updates records where previous_odometer_reading is currently NULL
    - Uses a window function (LAG) to efficiently get previous values
    - Processes all existing transactions in one operation
*/

-- Update previous_odometer_reading for existing transactions
UPDATE fuel_transactions
SET previous_odometer_reading = subquery.prev_reading
FROM (
  SELECT 
    id,
    LAG(odometer_reading) OVER (
      PARTITION BY vehicle_id 
      ORDER BY transaction_date, created_at
    ) as prev_reading
  FROM fuel_transactions
  WHERE previous_odometer_reading IS NULL
) AS subquery
WHERE fuel_transactions.id = subquery.id
  AND subquery.prev_reading IS NOT NULL;
